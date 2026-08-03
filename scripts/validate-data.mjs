#!/usr/bin/env node
/**
 * validate-data.mjs — check every file in `the-side-quest/data/` against
 * `the-side-quest/data/schema.md`.
 *
 * Read-only. Exits 0 when the data is sound, 1 when it is not, and lists the
 * offending records either way. Safe to run as a pre-push sanity check:
 *
 *   node scripts/validate-data.mjs && git push origin update
 *
 * Usage:
 *   node scripts/validate-data.mjs [options]
 *
 * Options:
 *   --quiet        print nothing when everything passes
 *   --no-warnings  hide advisory warnings, show errors only
 *   --strict       treat warnings as failures too
 *   --json         machine-readable output
 *   -h, --help     this text
 */

import { loadDataset, validateDataset, FILES, rel, DRAFT_MODEL_INDEX } from './lib/data-schema.mjs';

const HELP = `validate-data.mjs — check the-side-quest/data/ against schema.md

  node scripts/validate-data.mjs [--quiet] [--no-warnings] [--strict] [--json]

Exits 0 when the data is sound, 1 when it is not.

  --quiet        print nothing when everything passes
  --no-warnings  hide advisory warnings, show errors only
  --strict       treat warnings as failures too
  --json         machine-readable output
  -h, --help     this text
`;

/** Unwinds to main(), which sets process.exitCode. See add-entry.mjs. */
class Abort extends Error {
  constructor(code) {
    super(`abort(${code})`);
    this.code = code;
  }
}

function parseArgs(argv) {
  const opts = { quiet: false, warnings: true, strict: false, json: false };
  for (const a of argv) {
    switch (a) {
      case '-h': case '--help': process.stdout.write(HELP); throw new Abort(0);
      case '--quiet': case '-q': opts.quiet = true; break;
      case '--no-warnings': opts.warnings = false; break;
      case '--strict': opts.strict = true; break;
      case '--json': opts.json = true; break;
      default:
        process.stderr.write(`validate-data: unknown option ${a}\n\n${HELP}`);
        throw new Abort(2);
    }
  }
  return opts;
}

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const red = (s) => (COLOR ? `\u001b[31m${s}\u001b[0m` : s);
const yellow = (s) => (COLOR ? `\u001b[33m${s}\u001b[0m` : s);
const green = (s) => (COLOR ? `\u001b[32m${s}\u001b[0m` : s);
const dim = (s) => (COLOR ? `\u001b[2m${s}\u001b[0m` : s);

function groupByFile(items) {
  const map = new Map();
  for (const it of items) {
    if (!map.has(it.file)) map.set(it.file, []);
    map.get(it.file).push(it);
  }
  return map;
}

function printGroup(title, items, paint) {
  if (items.length === 0) return;
  process.stdout.write(`\n${title}\n`);
  for (const [file, list] of groupByFile(items)) {
    process.stdout.write(`  ${file}\n`);
    for (const it of list) {
      const where = it.id ? ` ${dim(it.id)}` : '';
      process.stdout.write(`    ${paint('•')}${where} ${it.message}\n`);
    }
  }
}

function counts(ds) {
  const out = [];
  for (const [name, spec] of Object.entries(FILES)) {
    const payload = ds.files[name]?.data?.[spec.payload];
    out.push(`${rel(spec.file)}: ${Array.isArray(payload) ? `${payload.length} records` : 'unreadable'}`);
  }
  const versions = ds.files.draftIndex?.data?.versions;
  out.push(`${rel(DRAFT_MODEL_INDEX)}: ${Array.isArray(versions) ? `${versions.length} model version(s)` : 'unreadable'}`);
  return out;
}

function run() {
  const opts = parseArgs(process.argv.slice(2));
  const ds = loadDataset();
  const report = validateDataset(ds);

  const failed = report.errors.length > 0 || (opts.strict && report.warnings.length > 0);

  if (opts.json) {
    process.stdout.write(`${JSON.stringify({
      ok: !failed,
      errors: report.errors,
      warnings: opts.warnings ? report.warnings : [],
      files: counts(ds),
    }, null, 2)}\n`);
    throw new Abort(failed ? 1 : 0);
  }

  if (!failed && opts.quiet) throw new Abort(0);

  if (!opts.quiet) {
    process.stdout.write('the-side-quest/data — validating against schema.md\n');
    for (const line of counts(ds)) process.stdout.write(`  ${dim(line)}\n`);
  }

  printGroup(red(`${report.errors.length} error(s)`), report.errors, red);
  if (opts.warnings) printGroup(yellow(`${report.warnings.length} warning(s)`), report.warnings, yellow);

  process.stdout.write('\n');
  if (failed) {
    const why = report.errors.length > 0
      ? `${report.errors.length} error(s)`
      : `${report.warnings.length} warning(s) under --strict`;
    process.stdout.write(`${red('FAIL')} — ${why}. Fix the records listed above; nothing was written.\n`);
    throw new Abort(1);
  }

  const tail = report.warnings.length > 0 && opts.warnings
    ? ` (${report.warnings.length} advisory warning(s), not blocking)`
    : '';
  process.stdout.write(`${green('PASS')} — every record carries a date and a source, and matches schema.md${tail}.\n`);
  throw new Abort(0);
}

function main() {
  try {
    run();
    process.exitCode = 0;
  } catch (err) {
    if (err instanceof Abort) {
      process.exitCode = err.code;
      return;
    }
    process.stderr.write(`validate-data: unexpected failure — ${err?.stack ?? err}\n`);
    process.exitCode = 2;
  }
}

main();

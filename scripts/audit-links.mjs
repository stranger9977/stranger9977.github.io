#!/usr/bin/env node
/* Link + asset auditor for The Side Quest.
 *
 * Pass 1 - static markup: every href/src/url() that appears in the HTML body
 *          (script blocks stripped, so JS template strings are not mistaken
 *          for URLs) is resolved against the running server and must be 200.
 *          In-page #anchors must match an id, or a [role=tab] data-hash.
 * Pass 2 - runtime refs: every URL the page's JS builds out of a data file
 *          (model source_posts[].path, wire/snaps/battles source_url) is
 *          resolved the same way. External hosts are reported, not fetched.
 *
 * Usage: node scripts/audit-links.mjs [origin]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ORIGIN = process.argv[2] || 'http://127.0.0.1:8731';
const ROOT = '/Users/nick/stranger9977.github.io';

const PAGES = [
  'the-side-quest/index.html',
  'the-side-quest/blog/index.html',
  'the-side-quest/posts/draft-board/index.html',
  'the-side-quest/posts/camp-dashboard/index.html'
];

const ATTR = /(?:href|src)\s*=\s*"([^"]*)"/gi;
const CSSURL = /url\(\s*["']?(?!data:)([^"')]+)["']?\s*\)/gi;

const stripScripts = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

function classify(ref) {
  if (!ref) return 'empty';
  if (/^(https?:)?\/\//i.test(ref)) return 'external';
  if (/^(mailto:|tel:|javascript:|data:)/i.test(ref)) return 'scheme';
  if (ref.startsWith('#')) return 'anchor';
  return 'internal';
}

function resolve(pageFile, ref) {
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) return null;
  if (clean.startsWith('/')) return clean;
  return path.posix.normalize(path.posix.join(path.posix.dirname('/' + pageFile), clean));
}

const results = { ok: 0, fail: 0, skipped: 0 };
const failures = [];

async function check(label, pageFile, ref, note) {
  const url = resolve(pageFile, ref);
  if (url === null) return;
  let status;
  try { status = (await fetch(ORIGIN + url)).status; }
  catch (e) { status = 'ERR ' + e.message; }
  const ok = status === 200;
  ok ? results.ok++ : results.fail++;
  if (!ok) failures.push(`${pageFile}  ${ref} -> ${url} (${status})`);
  console.log(`  ${ok ? ' OK ' : 'FAIL'} ${String(status).padEnd(5)} ${label.padEnd(9)} ${ref}${note ? '   ' + note : ''}`);
}

/* ------------------------------------------------ pass 1: static markup */
console.log('PASS 1 — static href/src/url() in markup (script blocks excluded)');
for (const page of PAGES) {
  console.log('\n=== ' + page + ' ===');
  const raw = readFileSync(path.join(ROOT, page), 'utf8');
  const markup = stripScripts(raw);
  const ids = new Set([...raw.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map(m => m[1]));
  const tabHashes = new Set([...raw.matchAll(/data-hash\s*=\s*"([^"]+)"/g)].map(m => m[1]));

  const refs = new Set();
  for (const m of markup.matchAll(ATTR)) refs.add(m[1]);
  for (const m of markup.matchAll(CSSURL)) refs.add(m[1]);

  for (const ref of [...refs].sort()) {
    const kind = classify(ref);
    if (kind === 'external' || kind === 'scheme' || kind === 'empty') {
      results.skipped++;
      console.log(`  skip      ${kind.padEnd(9)} ${ref}`);
      continue;
    }
    if (kind === 'anchor') {
      const id = ref.slice(1);
      const viaId = ids.has(id), viaTab = tabHashes.has(id);
      const ok = viaId || viaTab;
      ok ? results.ok++ : results.fail++;
      if (!ok) failures.push(`${page}  ${ref} (no element with that id, no tab with that data-hash)`);
      console.log(`  ${ok ? ' OK ' : 'FAIL'}       anchor    ${ref}${viaTab && !viaId ? '   (resolved by tab data-hash)' : ''}`);
      continue;
    }
    await check('markup', page, ref);
  }
}

/* --------------------------------------------- pass 2: runtime data refs */
console.log('\n\nPASS 2 — links the JS builds from the data files');

const model = JSON.parse(readFileSync(path.join(ROOT, 'the-side-quest/data/draft-model/v1.json'), 'utf8'));
console.log('\n=== draft-board: model.source_posts[].path (rendered into #m-sources) ===');
for (const s of model.source_posts || []) {
  await check('data', 'the-side-quest/posts/draft-board/index.html', s.path, '(' + s.issue + ')');
}

const buzz = ['wire', 'snaps', 'battles'].map(n => ({
  name: n,
  json: JSON.parse(readFileSync(path.join(ROOT, `the-side-quest/data/buzz/${n}.json`), 'utf8'))
}));
console.log('\n=== camp-dashboard: source_url on every wire/snap/battle record ===');
const hosts = {};
let missingUrl = 0, total = 0;
for (const { name, json } of buzz) {
  const rows = json.entries || json.records || json.battles || [];
  for (const r of rows) {
    total++;
    if (!r.source_url) { missingUrl++; failures.push(`${name}.json ${r.id || r.player} has no source_url`); continue; }
    if (classify(r.source_url) !== 'external') {
      await check('data', 'the-side-quest/posts/camp-dashboard/index.html', r.source_url, `(${name} ${r.id || ''})`);
    } else {
      let h;
      try { h = new URL(r.source_url).host; } catch { h = 'MALFORMED: ' + r.source_url; }
      hosts[h] = (hosts[h] || 0) + 1;
    }
  }
}
console.log(`  ${total} records, ${missingUrl} without a source_url.`);
console.log('  external hosts (not fetched, network is out of scope):');
for (const h of Object.keys(hosts).sort()) console.log(`    ${String(hosts[h]).padStart(4)}  ${h}`);
if (missingUrl) results.fail += missingUrl; else results.ok += 0;

console.log('\n---------------------------------------------');
console.log(`ok: ${results.ok}   failures: ${results.fail}   skipped (external/scheme): ${results.skipped}`);
if (failures.length) { console.log('FAILURES:'); failures.forEach(f => console.log('  ' + f)); }
process.exit(results.fail ? 1 : 0);

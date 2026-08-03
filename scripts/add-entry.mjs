#!/usr/bin/env node
/**
 * add-entry.mjs — append one record to the right file in
 * `the-side-quest/data/`, from command-line flags.
 *
 * What it guarantees:
 *   • It refuses to write a record with no date or no source. That is rule 1
 *     of schema.md and there is no flag to switch it off.
 *   • It validates the whole dataset — not just the new record — before
 *     touching disk. If the result would not pass `validate-data.mjs`, nothing
 *     is written.
 *   • It writes in the repo's house style and inserts in sort order, so a
 *     one-record addition shows up as a one-record diff.
 *   • Re-running the same command is a no-op. Identical record, same id, no
 *     second copy.
 *
 * Node builtins only. Run it from anywhere; paths resolve off this file.
 */

import {
  FILES, WIRE_FIELDS, SNAP_FIELDS, BATTLE_FIELDS, CONTENDER_FIELDS,
  STATUSES, DIRECTIONS, DIRECTION_FOR_STATUS, STATUS_FOR_DIRECTION,
  SNAP_UNITS, YEAR_PRECISION_LABEL, YEAR_PRECISION_MMDD,
  loadDataset, validateProposed, writeDataFile, stringifyData,
  wireIdBase, battleId, dayLabel, isIsoDate, todayIso, isNonEmptyString,
  orderFields, deepEqual, compareWire, compareBattles, insertionIndex,
  buildTeamIndex, rel,
} from './lib/data-schema.mjs';

const HELP = `add-entry.mjs — add one record to the-side-quest/data/

  node scripts/add-entry.mjs wire    [flags]   → buzz/wire.json    (a camp mention)
  node scripts/add-entry.mjs snap    [flags]   → buzz/snaps.json   (a snap-share reading)
  node scripts/add-entry.mjs battle  [flags]   → buzz/battles.json (a position-battle meter)

Every command refuses to write without a date and a source, revalidates the
whole dataset before saving, and is a no-op when the record already exists.

WIRE — a camp mention
  --player NAME          required
  --team ABBR            required; "none" for a free agent with no club
  --position CODE        required; QB RB WR TE, or a pair such as WR/CB
  --status BUZZING|STUNG required (or --direction positive|negative)
  --quote TEXT           required; paste it, do not retype it
  --source "TITLE · PUB" required; verbatim, the two halves split on " · "
  --url URL              required
  --date YYYY-MM-DD      required unless --camp
  --camp                 the source never dated it: date_precision "year",
                         date <season>-${YEAR_PRECISION_MMDD}, label "${YEAR_PRECISION_LABEL}"
  --season YYYY          only needed with --camp
  --id ID                override the generated id
  --date-label TEXT      override the generated label ("Aug 3")

  node scripts/add-entry.mjs wire \\
    --player "Jaxson Dart" --team NYG --position QB --status BUZZING \\
    --date 2026-08-03 \\
    --quote "“took every first-team rep”" \\
    --source "Giants camp report, Day 9 · The Athletic" \\
    --url "https://example.com/giants-day-9"

SNAP — only when the source states a number
  --mention WIRE_ID      required; the wire record this reading comes from.
                         date, season, team, player, position, quote, source
                         and url are inherited from it unless overridden.
  --unit UNIT            required; ${SNAP_UNITS.join(' | ')}
  --basis TEXT           required; what the percentage is a percentage of
  --pct N.N              the source stated the percentage outright
  --num N --den N        the source stated both counts; the percentage and
                         derived:true are computed from them
  --quote / --source / --url / --player / --team / --position / --date
                         override an inherited field
  --update               replace an existing reading with the same id

  node scripts/add-entry.mjs snap \\
    --mention 2026-0803-jaxson-dart --num 34 --den 56 \\
    --unit starter_unit_share \\
    --basis "34 of the 56 snaps taken with the first-team offence."

BATTLE — only when the source names every contender and gives numbers
  --team ABBR --position CODE --season YYYY   required
  --date YYYY-MM-DD      required; when the split was reported
  --updated YYYY-MM-DD   defaults to --date
  --contender SPEC       required, at least twice. Two forms:
                           "Phillip Lindsay=0.8"
                           "player=Johnson; share=0.2; snaps=2; note=surname only"
                         Omit every share and give every snaps count and the
                         shares are computed from the counts.
  --basis TEXT           required; what the shares are a share of
  --quote / --source / --url                  required
  --mention WIRE_ID      repeatable backlink into wire.json
  --stated               the source published the shares itself (derived:false)
  --update               a battle already exists for this season/team/position;
                         move the meter instead of adding a second record

  node scripts/add-entry.mjs battle \\
    --team HOU --position RB --season 2026 --date 2026-08-12 \\
    --contender "player=Nick Chubb; snaps=8" \\
    --contender "player=Woody Marks; snaps=2" \\
    --basis "First-quarter snap split, 8 to 2, as reported." \\
    --quote "“played eight first quarter snaps to Marks' two”" \\
    --source "Texans camp notebook · Houston Chronicle" \\
    --url "https://example.com/texans-notebook" \\
    --mention 2026-0812-nick-chubb

COMMON
  --dry-run              print the record and the file changes, write nothing
  --keep-generated       do not move the file's "generated" date to today
  --quiet                only print on failure
  -h, --help             this text
`;

/* ------------------------------------------------------------------ output */

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const red = (s) => (COLOR ? `\u001b[31m${s}\u001b[0m` : s);
const green = (s) => (COLOR ? `\u001b[32m${s}\u001b[0m` : s);
const dim = (s) => (COLOR ? `\u001b[2m${s}\u001b[0m` : s);

/**
 * Unwinds to main(), which sets process.exitCode and returns. Calling
 * process.exit() here would risk truncating stdout when it is a pipe.
 */
class Abort extends Error {
  constructor(code) {
    super(`abort(${code})`);
    this.code = code;
  }
}

function die(message, { usage = false } = {}) {
  process.stderr.write(`${red('add-entry: refusing to write')} — ${message}\n`);
  if (usage) process.stderr.write(`\nRun \`node scripts/add-entry.mjs --help\` for the flag list.\n`);
  throw new Abort(1);
}

/* ------------------------------------------------------------ arg parsing */

const REPEATABLE = new Set(['contender', 'mention']);
const BOOLEANS = new Set(['dry-run', 'keep-generated', 'quiet', 'update', 'camp', 'stated']);

function parseArgs(argv) {
  const flags = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) die(`unexpected argument ${JSON.stringify(token)}`, { usage: true });
    let name = token.slice(2);
    let value = null;
    const eq = name.indexOf('=');
    if (eq !== -1) {
      value = name.slice(eq + 1);
      name = name.slice(0, eq);
    }
    if (BOOLEANS.has(name)) {
      flags.set(name, true);
      continue;
    }
    if (value === null) {
      value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) die(`--${name} needs a value`, { usage: true });
      i += 1;
    }
    if (REPEATABLE.has(name)) {
      if (!flags.has(name)) flags.set(name, []);
      flags.get(name).push(value);
    } else if (flags.has(name)) {
      die(`--${name} was given twice`);
    } else {
      flags.set(name, value);
    }
  }
  return flags;
}

function checkKnownFlags(flags, allowed) {
  const known = new Set([...allowed, 'dry-run', 'keep-generated', 'quiet']);
  for (const name of flags.keys()) {
    if (!known.has(name)) die(`unknown flag --${name} for this command`, { usage: true });
  }
}

function str(flags, name) {
  const v = flags.get(name);
  return typeof v === 'string' ? v : undefined;
}

function requireStr(flags, name, why) {
  const v = str(flags, name);
  if (!isNonEmptyString(v)) die(`--${name} is required${why ? ` — ${why}` : ''}`);
  return v;
}

function num(flags, name) {
  const v = str(flags, name);
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) die(`--${name} must be a number, got ${JSON.stringify(v)}`);
  return n;
}

/* ---------------------------------------------------------------- helpers */

function splitSource(source) {
  const sep = ' · ';
  const at = source.lastIndexOf(sep);
  if (at === -1) {
    die(`--source must read "<headline> · <publisher>" with a middot separator, got ${JSON.stringify(source)}`);
  }
  return { title: source.slice(0, at).trim(), publisher: source.slice(at + sep.length).trim() };
}

function resolveDate(flags, { allowCamp }) {
  const camp = flags.get('camp') === true && allowCamp;
  const date = str(flags, 'date');
  let season = num(flags, 'season');

  if (camp) {
    if (season === undefined) {
      if (!date) die('--camp needs --season (or a --date to take the year from)');
      season = Number(date.slice(0, 4));
    }
    if (!Number.isInteger(season)) die('--season must be a four-digit year');
    return { date: `${season}-${YEAR_PRECISION_MMDD}`, precision: 'year', season, label: YEAR_PRECISION_LABEL };
  }

  if (!date) die('--date is required — rule 1 of schema.md: a record with no date does not go in the file');
  if (!isIsoDate(date)) die(`--date must be a real YYYY-MM-DD date, got ${JSON.stringify(date)}`);
  const y = Number(date.slice(0, 4));
  if (season !== undefined && season !== y) die(`--season ${season} does not match the year in --date ${date}`);
  return { date, precision: 'day', season: y, label: dayLabel(date) };
}

/** Bump the envelope counters after a payload change. */
function refreshEnvelope(fileData, payloadKey, flags) {
  fileData.count = fileData[payloadKey].length;
  if (flags.get('keep-generated') !== true) fileData.generated = todayIso();
}

function recountSeasons(wireData) {
  const counts = {};
  for (const e of wireData.entries) {
    if (Number.isInteger(e.season)) counts[String(e.season)] = (counts[String(e.season)] ?? 0) + 1;
  }
  wireData.seasons = counts;
}

/* ----------------------------------------------------------- record builds */

function buildWireRecord(flags, teamIndex) {
  checkKnownFlags(flags, [
    'player', 'team', 'position', 'status', 'direction', 'quote', 'source',
    'source-title', 'source-publisher', 'url', 'date', 'camp', 'season', 'id', 'date-label',
  ]);

  const player = requireStr(flags, 'player');
  const teamRaw = requireStr(flags, 'team', 'pass "none" if the source names no club');
  const team = /^(none|null|-)$/i.test(teamRaw) ? null : teamRaw.toUpperCase();
  if (team !== null && !teamIndex.has(team)) {
    die(`--team ${team} is not in teams.json (abbrs or aliases). Use a current abbreviation, a historical one such as OAK, or "none".`);
  }

  const position = requireStr(flags, 'position').toUpperCase();

  let status = str(flags, 'status');
  let direction = str(flags, 'direction');
  if (status) status = status.toUpperCase();
  if (direction) direction = direction.toLowerCase();
  if (!status && !direction) die(`--status (${STATUSES.join(' | ')}) or --direction (${DIRECTIONS.join(' | ')}) is required`);
  if (status && !STATUSES.includes(status)) die(`--status must be one of ${STATUSES.join(' | ')}`);
  if (direction && !DIRECTIONS.includes(direction)) die(`--direction must be one of ${DIRECTIONS.join(' | ')}`);
  if (!status) status = STATUS_FOR_DIRECTION[direction];
  if (!direction) direction = DIRECTION_FOR_STATUS[status];
  if (DIRECTION_FOR_STATUS[status] !== direction) die(`--status ${status} and --direction ${direction} say opposite things`);

  const quote = requireStr(flags, 'quote', 'paste the source text verbatim');
  const source = requireStr(flags, 'source', 'rule 1 of schema.md: a record with no source does not go in the file');
  const sourceUrl = requireStr(flags, 'url');
  if (!/^https?:\/\//.test(sourceUrl)) die('--url must be an http(s) URL');

  const split = splitSource(source);
  const sourceTitle = str(flags, 'source-title') ?? split.title;
  const sourcePublisher = str(flags, 'source-publisher') ?? split.publisher;
  if (`${sourceTitle} · ${sourcePublisher}` !== source) {
    die(`--source-title and --source-publisher must recompose --source exactly; got "${sourceTitle} · ${sourcePublisher}"`);
  }

  const when = resolveDate(flags, { allowCamp: true });

  return orderFields({
    id: str(flags, 'id') ?? null,
    date: when.date,
    date_precision: when.precision,
    date_label: str(flags, 'date-label') ?? when.label,
    season: when.season,
    player,
    team,
    position,
    status,
    direction,
    quote,
    source,
    source_title: sourceTitle,
    source_publisher: sourcePublisher,
    source_url: sourceUrl,
  }, WIRE_FIELDS);
}

function buildSnapRecord(flags, wireById) {
  checkKnownFlags(flags, [
    'mention', 'unit', 'basis', 'pct', 'num', 'den', 'quote', 'source', 'url',
    'player', 'team', 'position', 'date', 'season', 'update',
  ]);

  const mentionIds = flags.get('mention');
  const mentionId = Array.isArray(mentionIds) ? mentionIds[mentionIds.length - 1] : mentionIds;
  if (!isNonEmptyString(mentionId)) die('--mention is required — a snap reading hangs off a wire record');
  const mention = wireById.get(mentionId);
  if (!mention) die(`--mention ${mentionId} is not in wire.json. Add the camp mention first, then the reading.`);

  const unit = requireStr(flags, 'unit');
  if (!SNAP_UNITS.includes(unit)) die(`--unit must be one of ${SNAP_UNITS.join(' | ')}`);
  const basis = requireStr(flags, 'basis', 'say what the percentage is a percentage of; it is rendered in the tooltip');

  const pct = num(flags, 'pct');
  const numerator = num(flags, 'num');
  const denominator = num(flags, 'den');
  const hasCounts = numerator !== undefined || denominator !== undefined;

  if (hasCounts && pct !== undefined) die('give either --pct (the source stated the percentage) or --num/--den (the source stated the counts), not both');
  if (!hasCounts && pct === undefined) die('a reading needs a number: --pct, or --num and --den. "Took first-team reps" is not a reading — skip it.');

  let snapPct;
  let derived;
  if (hasCounts) {
    if (numerator === undefined || denominator === undefined) die('--num and --den go together');
    if (!Number.isInteger(numerator) || numerator < 0) die('--num must be a non-negative whole number');
    if (!Number.isInteger(denominator) || denominator <= 0) die('--den must be a positive whole number');
    if (numerator > denominator) die(`--num ${numerator} cannot exceed --den ${denominator}`);
    snapPct = Math.round((numerator / denominator) * 1000) / 10;
    derived = true;
  } else {
    if (pct < 0 || pct > 100) die('--pct must be between 0 and 100');
    if (Math.round(pct * 10) !== pct * 10) die(`--pct carries more than one decimal place (${pct})`);
    snapPct = pct;
    derived = false;
  }

  const date = str(flags, 'date') ?? mention.date;
  if (!isIsoDate(date)) die('--date must be a real YYYY-MM-DD date');
  const source = str(flags, 'source') ?? mention.source;
  if (!isNonEmptyString(source)) die('the reading has no source — pass --source');
  const url = str(flags, 'url') ?? mention.source_url;
  if (!/^https?:\/\//.test(url ?? '')) die('--url must be an http(s) URL');

  return orderFields({
    id: `snap-${mentionId}`,
    mention_id: mentionId,
    date,
    date_precision: mention.date_precision,
    season: num(flags, 'season') ?? mention.season,
    team: (str(flags, 'team') ?? mention.team ?? '').toUpperCase(),
    player: str(flags, 'player') ?? mention.player,
    position: (str(flags, 'position') ?? mention.position).toUpperCase(),
    snap_pct: snapPct,
    numerator: hasCounts ? numerator : null,
    denominator: hasCounts ? denominator : null,
    unit,
    basis,
    derived,
    quote: str(flags, 'quote') ?? mention.quote,
    source,
    source_url: url,
  }, SNAP_FIELDS);
}

function parseContender(spec) {
  const looksKeyed = /^\s*(player|share|snaps|note)\s*=/i.test(spec);
  if (!looksKeyed) {
    const at = spec.lastIndexOf('=');
    if (at === -1) die(`--contender ${JSON.stringify(spec)} needs a share, e.g. "Phillip Lindsay=0.8"`);
    return {
      player: spec.slice(0, at).trim(),
      share: parseShare(spec.slice(at + 1).trim(), spec),
      snaps: null,
      note: null,
    };
  }

  const out = { player: null, share: null, snaps: null, note: null };
  for (const part of spec.split(';')) {
    if (part.trim() === '') continue;
    const at = part.indexOf('=');
    if (at === -1) die(`--contender ${JSON.stringify(spec)}: "${part.trim()}" is not key=value`);
    const key = part.slice(0, at).trim().toLowerCase();
    const value = part.slice(at + 1).trim();
    switch (key) {
      case 'player': out.player = value; break;
      case 'share': out.share = parseShare(value, spec); break;
      case 'snaps': {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 0) die(`--contender ${JSON.stringify(spec)}: snaps must be a non-negative whole number`);
        out.snaps = n;
        break;
      }
      case 'note': out.note = value === '' ? null : value; break;
      default: die(`--contender ${JSON.stringify(spec)}: unknown key "${key}" (player, share, snaps, note)`);
    }
  }
  if (!isNonEmptyString(out.player)) die(`--contender ${JSON.stringify(spec)} has no player=`);
  return out;
}

function parseShare(raw, spec) {
  const pct = raw.endsWith('%');
  const n = Number(pct ? raw.slice(0, -1) : raw);
  if (!Number.isFinite(n)) die(`--contender ${JSON.stringify(spec)}: share ${JSON.stringify(raw)} is not a number`);
  const share = pct ? n / 100 : n;
  if (share < 0 || share > 1) die(`--contender ${JSON.stringify(spec)}: share must be between 0 and 1 (or use a % suffix)`);
  return share;
}

function buildBattleRecord(flags, teamIndex) {
  checkKnownFlags(flags, [
    'team', 'position', 'season', 'date', 'updated', 'contender', 'basis',
    'quote', 'source', 'url', 'mention', 'stated', 'camp', 'update',
  ]);

  const team = requireStr(flags, 'team').toUpperCase();
  if (!teamIndex.has(team)) die(`--team ${team} is not in teams.json`);
  const position = requireStr(flags, 'position').toUpperCase();
  const when = resolveDate(flags, { allowCamp: true });

  const updated = str(flags, 'updated') ?? when.date;
  if (!isIsoDate(updated)) die('--updated must be a real YYYY-MM-DD date');
  if (updated < when.date) die(`--updated ${updated} is earlier than --date ${when.date}`);

  const specs = flags.get('contender');
  if (!Array.isArray(specs) || specs.length < 2) {
    die('--contender is required at least twice — a battle only goes in the file when the source names every contender');
  }
  const contenders = specs.map(parseContender);

  const missingShare = contenders.filter((c) => c.share === null);
  if (missingShare.length > 0) {
    if (missingShare.length !== contenders.length) {
      die('give a share for every contender, or a snaps count for every contender — not a mix');
    }
    if (contenders.some((c) => c.snaps === null)) {
      die('no shares given, so every contender needs snaps= to compute the split from');
    }
    const total = contenders.reduce((a, c) => a + c.snaps, 0);
    if (total <= 0) die('cannot compute shares: the snap counts add up to zero');
    for (const c of contenders) c.share = Math.round((c.snaps / total) * 1000) / 1000;
    const drift = 1 - contenders.reduce((a, c) => a + c.share, 0);
    if (Math.abs(drift) > 1e-9) {
      const biggest = contenders.reduce((a, b) => (b.share > a.share ? b : a));
      biggest.share = Math.round((biggest.share + drift) * 1e6) / 1e6;
    }
  }

  const sum = contenders.reduce((a, c) => a + c.share, 0);
  if (Math.abs(sum - 1) > 1e-6) {
    die(`contender shares add up to ${Number(sum.toFixed(6))}; they must sum to 1`);
  }

  const basis = requireStr(flags, 'basis', 'say what the shares are a share of, and how small the sample is');
  const quote = requireStr(flags, 'quote', 'paste the source text verbatim');
  const source = requireStr(flags, 'source', 'rule 1 of schema.md: a record with no source does not go in the file');
  const url = requireStr(flags, 'url');
  if (!/^https?:\/\//.test(url)) die('--url must be an http(s) URL');

  const mentions = flags.get('mention');

  return orderFields({
    id: battleId({ season: when.season, team, position }),
    team,
    position,
    season: when.season,
    updated,
    date: when.date,
    date_precision: when.precision,
    contenders: contenders.map((c) => orderFields(c, CONTENDER_FIELDS)),
    basis,
    derived: flags.get('stated') !== true,
    mention_ids: Array.isArray(mentions) ? mentions : [],
    quote,
    source,
    source_url: url,
  }, BATTLE_FIELDS);
}

/* ------------------------------------------------------------- the gate */

/** Rule 1, enforced on every path, with no flag to turn it off. */
function assertDateAndSource(record) {
  if (!isIsoDate(record.date)) die('the record has no usable date. schema.md rule 1: every record carries a date.');
  if (!isNonEmptyString(record.source)) die('the record has no source. schema.md rule 1: every record carries a source.');
}

/* ------------------------------------------------------------ apply + save */

function report(lines, flags) {
  if (flags.get('quiet') === true) return;
  for (const l of lines) process.stdout.write(`${l}\n`);
}

function finish(target, ds, flags, record, action, index) {
  // action: { past: 'added camp mention', future: 'add camp mention' }
  const file = ds.files[target];
  const spec = FILES[target];

  const check = validateProposed(ds);
  if (!check.ok) {
    process.stderr.write(`${red('add-entry: refusing to write')} — the result would not pass validate-data.mjs:\n`);
    for (const e of check.errors) {
      process.stderr.write(`  ${e.file}${e.id ? ` ${e.id}` : ''}: ${e.message}\n`);
    }
    throw new Abort(1);
  }

  const text = stringifyData(file.data, file.style);
  const snippet = stringifyData(record, { indent: file.style.indent, eofNewline: false });

  const dry = flags.get('dry-run') === true;
  if (!dry) writeDataFile(spec.file, file.data, file.style);

  report([
    '',
    `${dry ? dim(`[dry run] would ${action.future}`) : green(`✓ ${action.past}`)} ${record.id}`,
    `  file      ${rel(spec.file)}`,
    `  position  ${index + 1} of ${file.data[spec.payload].length}`,
    `  bytes     ${file.raw.length} → ${text.length}`,
    '',
    snippet.split('\n').map((l) => `  ${l}`).join('\n'),
    '',
    dry
      ? dim('  Nothing written. Drop --dry-run to save.')
      : dim(`  Saved. Check it with:  node scripts/validate-data.mjs`),
  ], flags);

  for (const w of check.warnings) {
    if (w.id === record.id) process.stderr.write(`  warning: ${w.message}\n`);
  }
  throw new Abort(0);
}

function noop(record, target, flags) {
  report([
    '',
    `${dim('=')} no change — ${rel(FILES[target].file)} already holds ${record.id}, byte for byte.`,
    dim('  Re-running the same command never adds a second copy.'),
  ], flags);
  throw new Abort(0);
}

/* -------------------------------------------------------------- commands */

function cmdWire(flags, ds) {
  const teamIndex = buildTeamIndex(ds.files.teams.data);
  const record = buildWireRecord(flags, teamIndex);
  assertDateAndSource(record);

  const entries = ds.files.wire.data.entries;
  const explicitId = record.id !== null;
  const base = wireIdBase(record);

  if (explicitId) {
    const existing = entries.find((e) => e.id === record.id);
    if (existing) {
      if (deepEqual(existing, record)) noop(record, 'wire', flags);
      die(`id ${record.id} already exists in wire.json with different content. Drop --id and a -2 suffix will be assigned, or edit the existing record by hand.`);
    }
  } else {
    const family = entries.filter((e) => e.id === base || new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+$`).test(e.id));
    for (const e of family) {
      const { id, ...rest } = e;
      const { id: _drop, ...candidate } = record;
      if (deepEqual(rest, candidate)) noop(e, 'wire', flags);
    }
    let id = base;
    let n = 2;
    const taken = new Set(entries.map((e) => e.id));
    while (taken.has(id)) { id = `${base}-${n}`; n += 1; }
    record.id = id;
  }

  const at = insertionIndex(entries, record, compareWire);
  entries.splice(at, 0, record);
  recountSeasons(ds.files.wire.data);
  refreshEnvelope(ds.files.wire.data, 'entries', flags);
  finish('wire', ds, flags, record, { past: 'added camp mention', future: 'add camp mention' }, at);
}

function cmdSnap(flags, ds) {
  const wireById = new Map(ds.files.wire.data.entries.map((e) => [e.id, e]));
  const record = buildSnapRecord(flags, wireById);
  assertDateAndSource(record);

  const records = ds.files.snaps.data.records;
  const existingAt = records.findIndex((r) => r.id === record.id);
  let action = { past: 'added snap reading', future: 'add snap reading' };
  let at;

  if (existingAt !== -1) {
    if (deepEqual(records[existingAt], record)) noop(record, 'snaps', flags);
    if (flags.get('update') !== true) {
      die(`${record.id} already exists in snaps.json with different numbers. Pass --update to correct it.`);
    }
    records.splice(existingAt, 1);
    at = insertionIndex(records, record, compareWire);
    records.splice(at, 0, record);
    action = { past: 'updated snap reading', future: 'update snap reading' };
  } else {
    at = insertionIndex(records, record, compareWire);
    records.splice(at, 0, record);
  }

  refreshEnvelope(ds.files.snaps.data, 'records', flags);
  finish('snaps', ds, flags, record, action, at);
}

function cmdBattle(flags, ds) {
  const teamIndex = buildTeamIndex(ds.files.teams.data);
  const record = buildBattleRecord(flags, teamIndex);
  assertDateAndSource(record);

  const battles = ds.files.battles.data.battles;
  const existingAt = battles.findIndex((b) => b.id === record.id);
  let action = { past: 'added battle', future: 'add battle' };
  let at;

  if (existingAt !== -1) {
    const existing = battles[existingAt];
    if (record.mention_ids.length === 0) record.mention_ids = existing.mention_ids;
    if (deepEqual(existing, record)) noop(record, 'battles', flags);
    if (flags.get('update') !== true) {
      die(`${record.id} already exists. schema.md says one battle per season/team/position — pass --update to move the meter instead of adding a second record.`);
    }
    battles.splice(existingAt, 1);
    at = insertionIndex(battles, record, compareBattles);
    battles.splice(at, 0, record);
    action = { past: 'moved battle meter', future: 'move battle meter' };
  } else {
    at = insertionIndex(battles, record, compareBattles);
    battles.splice(at, 0, record);
  }

  refreshEnvelope(ds.files.battles.data, 'battles', flags);
  finish('battles', ds, flags, record, action, at);
}

/* ------------------------------------------------------------------- main */

function run() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    process.stdout.write(HELP);
    throw new Abort(argv.length === 0 ? 1 : 0);
  }

  const command = argv[0];
  const commands = { wire: cmdWire, snap: cmdSnap, battle: cmdBattle };
  if (!Object.hasOwn(commands, command)) {
    die(`unknown command ${JSON.stringify(command)} — expected wire, snap or battle`, { usage: true });
  }

  const flags = parseArgs(argv.slice(1));
  const ds = loadDataset();

  const before = validateProposed(ds);
  if (!before.ok) {
    process.stderr.write(`${red('add-entry: refusing to write')} — the data files already fail validation. Fix them first:\n`);
    for (const e of before.errors) process.stderr.write(`  ${e.file}${e.id ? ` ${e.id}` : ''}: ${e.message}\n`);
    process.stderr.write('\n  node scripts/validate-data.mjs\n');
    throw new Abort(1);
  }

  commands[command](flags, ds);
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
    process.stderr.write(`${red('add-entry: unexpected failure')} — ${err?.stack ?? err}\n`);
    process.exitCode = 2;
  }
}

main();

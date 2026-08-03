/**
 * data-schema.mjs — one description of `the-side-quest/data/`, shared by
 * `add-entry.mjs` (which writes) and `validate-data.mjs` (which checks).
 *
 * Both scripts run the same checks, so "add-entry accepted it" and
 * "validate-data passes" can never mean two different things.
 *
 * Node builtins only. No dependencies, no build step.
 *
 * The contract this file encodes lives in `the-side-quest/data/schema.md`.
 * When that document changes, change this file in the same commit.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ paths */

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const SITE_DIR = path.join(REPO_ROOT, 'the-side-quest');
export const DATA_DIR = path.join(SITE_DIR, 'data');

/** Root-absolute site path (`/the-side-quest/…`) → absolute path on disk. */
export function resolveSitePath(sitePath) {
  return path.join(REPO_ROOT, sitePath.replace(/^\/+/, ''));
}

/** Absolute path → repo-relative, for messages. */
export function rel(abs) {
  return path.relative(REPO_ROOT, abs) || abs;
}

/** The five files `add-entry.mjs` is allowed to rewrite. */
export const FILES = {
  posts: { file: path.join(DATA_DIR, 'posts.json'), payload: 'posts' },
  wire: { file: path.join(DATA_DIR, 'buzz', 'wire.json'), payload: 'entries' },
  teams: { file: path.join(DATA_DIR, 'buzz', 'teams.json'), payload: 'teams' },
  snaps: { file: path.join(DATA_DIR, 'buzz', 'snaps.json'), payload: 'records' },
  battles: { file: path.join(DATA_DIR, 'buzz', 'battles.json'), payload: 'battles' },
};

export const DRAFT_MODEL_DIR = path.join(DATA_DIR, 'draft-model');
export const DRAFT_MODEL_INDEX = path.join(DRAFT_MODEL_DIR, 'index.json');

/* ------------------------------------------------------- vocabulary / enums */

export const CANONICAL_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET',
  'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE',
  'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS',
];

export const STATUSES = ['BUZZING', 'STUNG'];
export const DIRECTIONS = ['positive', 'negative'];
export const DATE_PRECISIONS = ['day', 'year'];
export const POST_STATUSES = ['live', 'featured', 'archive'];
export const UPDATED_PRECISIONS = ['day', 'month'];
export const SNAP_UNITS = ['starter_unit_share', 'position_split'];
export const FANTASY_POSITIONS = ['QB', 'RB', 'WR', 'TE'];

/** status ↔ direction are the same fact in two vocabularies. */
export const STATUS_FOR_DIRECTION = { positive: 'BUZZING', negative: 'STUNG' };
export const DIRECTION_FOR_STATUS = { BUZZING: 'positive', STUNG: 'negative' };

export const YEAR_PRECISION_LABEL = 'During camp';
/** A year-precision record sorts on <season>-08-01. Placeholder, not a claim. */
export const YEAR_PRECISION_MMDD = '08-01';

export const REQUIRED_TILE_VARS = [
  '--tile-bg', '--tile-surface', '--tile-fg', '--tile-fg-dim', '--tile-muted',
  '--tile-accent', '--tile-accent-text', '--tile-on-accent', '--tile-rule',
  '--tile-font', '--tile-display-font', '--tile-mono-font',
  '--tile-kicker-tracking', '--tile-radius', '--tile-texture',
  '--tile-texture-opacity',
];

/** Key order for records this tool writes. Matches the files as they stand. */
export const WIRE_FIELDS = [
  'id', 'date', 'date_precision', 'date_label', 'season', 'player', 'team',
  'position', 'status', 'direction', 'quote', 'source', 'source_title',
  'source_publisher', 'source_url',
];
export const SNAP_FIELDS = [
  'id', 'mention_id', 'date', 'date_precision', 'season', 'team', 'player',
  'position', 'snap_pct', 'numerator', 'denominator', 'unit', 'basis',
  'derived', 'quote', 'source', 'source_url',
];
export const BATTLE_FIELDS = [
  'id', 'team', 'position', 'season', 'updated', 'date', 'date_precision',
  'contenders', 'basis', 'derived', 'mention_ids', 'quote', 'source',
  'source_url',
];
export const CONTENDER_FIELDS = ['player', 'share', 'snaps', 'note'];

/* -------------------------------------------------------------- formatting */

/**
 * Fields written with at least one decimal place, so `50` serialises as `50.0`
 * and matches what is already in the files. Without this a rewrite would
 * silently reformat every untouched record.
 */
const DECIMAL_FIELDS = new Set(['snap_pct', 'share']);

/** Objects whose keys are years and are listed newest-first in the file. */
const DESC_NUMERIC_KEY_OBJECTS = new Set(['seasons']);

function serializeNumber(n, key) {
  if (!Number.isFinite(n)) throw new TypeError(`Non-finite number at "${key}"`);
  if (DECIMAL_FIELDS.has(key) && Number.isInteger(n)) return n.toFixed(1);
  return JSON.stringify(n);
}

function serialize(value, indent, depth, key) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'string') return JSON.stringify(value);
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') return serializeNumber(value, key);

  const nl = indent > 0 ? '\n' : '';
  const inner = indent > 0 ? ' '.repeat(indent * (depth + 1)) : '';
  const outer = indent > 0 ? ' '.repeat(indent * depth) : '';

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const parts = value.map((v) => inner + serialize(v, indent, depth + 1, key));
    return `[${nl}${parts.join(`,${nl}`)}${nl}${outer}]`;
  }

  if (t === 'object') {
    let keys = Object.keys(value).filter((k) => value[k] !== undefined);
    if (DESC_NUMERIC_KEY_OBJECTS.has(key) && keys.every((k) => /^\d+$/.test(k))) {
      keys = keys.sort((a, b) => Number(b) - Number(a));
    }
    if (keys.length === 0) return '{}';
    const parts = keys.map(
      (k) => `${inner}${JSON.stringify(k)}: ${serialize(value[k], indent, depth + 1, k)}`,
    );
    return `{${nl}${parts.join(`,${nl}`)}${nl}${outer}}`;
  }

  throw new TypeError(`Cannot serialize ${t} at "${key}"`);
}

/**
 * Stringify with the repo's house style: one-space indent, `50.0` kept as
 * `50.0`, and `seasons` newest-first. Round-trips every data file byte for
 * byte, so a one-record insert produces a one-record diff.
 */
export function stringifyData(value, { indent = 1, eofNewline = false } = {}) {
  return serialize(value, indent, 0, null) + (eofNewline ? '\n' : '');
}

/** Read a file's existing formatting so a rewrite preserves it. */
export function detectStyle(text) {
  const eofNewline = text.endsWith('\n');
  const body = eofNewline ? text.slice(0, -1) : text;
  const second = body.split('\n')[1] ?? '';
  const m = /^ */.exec(second);
  return { indent: m ? m[0].length : 1, eofNewline };
}

/* ------------------------------------------------------------------- utils */

export function slugifyPlayer(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-08-03` → `Aug 3`. Exactly the form already in the wire. */
export function dayLabel(isoDate) {
  return `${MONTHS[Number(isoDate.slice(5, 7)) - 1]} ${Number(isoDate.slice(8, 10))}`;
}

export function isIsoDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function todayIso(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function isHex6(v) {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
}

export function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

export function isPositionCode(v) {
  return typeof v === 'string' && /^[A-Z]{1,3}(\/[A-Z]{1,3})?$/.test(v);
}

/** Deep value equality, enough for plain JSON records. */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

/** Rebuild an object with a fixed key order, so written records read alike. */
export function orderFields(obj, fields) {
  const out = {};
  for (const f of fields) if (obj[f] !== undefined) out[f] = obj[f];
  for (const k of Object.keys(obj)) if (!(k in out)) out[k] = obj[k];
  return out;
}

/** Newest first; within a day, year-precision records sort last. (schema.md) */
export function compareWire(a, b) {
  return (
    String(b.date).localeCompare(String(a.date)) ||
    ((a.date_precision === 'year') - (b.date_precision === 'year'))
  );
}

/** Battles: newest first, then by id so the file stays diff-stable. */
export function compareBattles(a, b) {
  return String(b.date).localeCompare(String(a.date)) || String(a.id).localeCompare(String(b.id));
}

/**
 * First index at which `record` belongs. Ties land at the top of their group,
 * matching schema.md's "add the object at the top of entries".
 */
export function insertionIndex(list, record, cmp) {
  for (let i = 0; i < list.length; i += 1) if (cmp(record, list[i]) <= 0) return i;
  return list.length;
}

/* ------------------------------------------------------------------ loading */

function positionOf(text, offset) {
  const before = text.slice(0, offset);
  const line = before.split('\n').length;
  const col = offset - before.lastIndexOf('\n');
  return `line ${line}, column ${col}`;
}

/** Read + parse one JSON file. Never throws; returns `{ error }` instead. */
export function readJsonFile(absPath) {
  let raw;
  try {
    raw = fs.readFileSync(absPath, 'utf8');
  } catch (err) {
    return { path: absPath, exists: false, error: `cannot read: ${err.message}` };
  }
  if (raw.charCodeAt(0) === 0xfeff) {
    return { path: absPath, exists: true, raw, error: 'file starts with a UTF-8 BOM; save it without one' };
  }
  try {
    const data = JSON.parse(raw);
    return { path: absPath, exists: true, raw, data, style: detectStyle(raw) };
  } catch (err) {
    const m = /position (\d+)/.exec(err.message);
    const where = m ? ` (${positionOf(raw, Number(m[1]))})` : '';
    return { path: absPath, exists: true, raw, error: `invalid JSON${where}: ${err.message}` };
  }
}

/** Load every data file the site ships. Parse failures are reported, not thrown. */
export function loadDataset() {
  const ds = { files: {}, parseErrors: [], draftVersions: {} };
  for (const [name, spec] of Object.entries(FILES)) {
    const f = readJsonFile(spec.file);
    ds.files[name] = f;
    if (f.error) ds.parseErrors.push({ file: rel(spec.file), message: f.error });
  }
  const idx = readJsonFile(DRAFT_MODEL_INDEX);
  ds.files.draftIndex = idx;
  if (idx.error) ds.parseErrors.push({ file: rel(DRAFT_MODEL_INDEX), message: idx.error });
  const versions = Array.isArray(idx.data?.versions) ? idx.data.versions : [];
  for (const v of versions) {
    if (typeof v !== 'string' || !/^[a-z0-9._-]+$/i.test(v)) continue;
    const vf = readJsonFile(path.join(DRAFT_MODEL_DIR, `${v}.json`));
    ds.draftVersions[v] = vf;
    if (vf.error) ds.parseErrors.push({ file: rel(path.join(DRAFT_MODEL_DIR, `${v}.json`)), message: vf.error });
  }
  return ds;
}

/* --------------------------------------------------------------- validation */

class Report {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  err(file, id, message) {
    this.errors.push({ file, id, message });
  }

  warn(file, id, message) {
    this.warnings.push({ file, id, message });
  }

  get ok() {
    return this.errors.length === 0;
  }
}

function checkEnvelope(r, file, obj, payloadKey) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    r.err(file, null, 'top level must be an object, not an array or scalar');
    return false;
  }
  if (!Number.isInteger(obj.version)) r.err(file, null, '"version" must be an integer');
  if (!isIsoDate(obj.generated)) r.err(file, null, '"generated" must be a YYYY-MM-DD date');
  if (!isNonEmptyString(obj.description)) r.err(file, null, '"description" must be a non-empty string');
  if (!Array.isArray(obj[payloadKey])) {
    r.err(file, null, `"${payloadKey}" must be an array`);
    return false;
  }
  if (obj.count !== obj[payloadKey].length) {
    r.err(file, null, `"count" is ${JSON.stringify(obj.count)} but "${payloadKey}" holds ${obj[payloadKey].length} records`);
  }
  return true;
}

function requireStrings(r, file, id, rec, fields) {
  for (const f of fields) {
    if (!isNonEmptyString(rec[f])) r.err(file, id, `"${f}" is required and must be a non-empty string`);
  }
}

/** Rule 1 of schema.md: every record carries date and source. */
function requireDateAndSource(r, file, id, rec) {
  if (!isIsoDate(rec.date)) r.err(file, id, '"date" is required (YYYY-MM-DD) — a record with no date does not go in the file');
  if (!isNonEmptyString(rec.source)) r.err(file, id, '"source" is required — a record with no source does not go in the file');
}

function checkSorted(r, file, list, cmp, label) {
  for (let i = 1; i < list.length; i += 1) {
    if (cmp(list[i - 1], list[i]) > 0) {
      r.warn(file, list[i]?.id ?? `#${i}`, `out of order — ${label}`);
      return;
    }
  }
}

/* ------------------------------------------------------------- teams.json */

export function buildTeamIndex(teamsData) {
  const canonical = new Set();
  const aliases = new Map();
  for (const t of teamsData?.teams ?? []) {
    if (typeof t?.abbr === 'string') canonical.add(t.abbr);
    for (const a of Array.isArray(t?.aliases) ? t.aliases : []) {
      if (typeof a === 'string') aliases.set(a, t.abbr);
    }
  }
  return {
    canonical,
    aliases,
    has: (abbr) => canonical.has(abbr) || aliases.has(abbr),
    resolve: (abbr) => (canonical.has(abbr) ? abbr : aliases.get(abbr) ?? null),
  };
}

function validateTeams(r, ds) {
  const f = ds.files.teams;
  const file = rel(f.path);
  if (!f.data) return;
  if (!checkEnvelope(r, file, f.data, 'teams')) return;

  const seen = new Set();
  const aliasOwner = new Map();
  const divisions = new Map();

  for (const t of f.data.teams) {
    const id = t?.abbr ?? '(no abbr)';
    if (!isNonEmptyString(t?.abbr)) {
      r.err(file, id, '"abbr" is required');
      continue;
    }
    if (!CANONICAL_TEAMS.includes(t.abbr)) r.err(file, id, `"${t.abbr}" is not one of the 32 club abbreviations`);
    if (seen.has(t.abbr)) r.err(file, id, 'duplicate abbr');
    seen.add(t.abbr);

    requireStrings(r, file, id, t, ['name', 'nickname']);
    if (!['AFC', 'NFC'].includes(t.conference)) r.err(file, id, '"conference" must be AFC or NFC');
    if (!['East', 'North', 'South', 'West'].includes(t.division)) r.err(file, id, '"division" must be East, North, South or West');
    if (!isHex6(t.primary)) r.err(file, id, '"primary" must be a #rrggbb hex colour');
    if (!isHex6(t.secondary)) r.err(file, id, '"secondary" must be a #rrggbb hex colour');

    if (!Array.isArray(t.aliases)) {
      r.err(file, id, '"aliases" must be an array (use [] when there are none)');
    } else {
      for (const a of t.aliases) {
        if (!isNonEmptyString(a)) r.err(file, id, 'alias entries must be non-empty strings');
        else if (CANONICAL_TEAMS.includes(a)) r.err(file, id, `alias "${a}" collides with a current club abbreviation`);
        else if (aliasOwner.has(a)) r.err(file, id, `alias "${a}" is already claimed by ${aliasOwner.get(a)}`);
        else aliasOwner.set(a, t.abbr);
      }
    }
    const key = `${t.conference} ${t.division}`;
    divisions.set(key, (divisions.get(key) ?? 0) + 1);
  }

  for (const abbr of CANONICAL_TEAMS) {
    if (!seen.has(abbr)) r.err(file, abbr, 'club missing from the lookup table');
  }
  for (const [key, n] of divisions) {
    if (n !== 4) r.err(file, key, `division holds ${n} clubs, expected 4`);
  }
  const abbrs = f.data.teams.map((t) => t?.abbr);
  if (JSON.stringify(abbrs) !== JSON.stringify([...abbrs].sort())) {
    r.warn(file, null, 'teams are not sorted by abbr — schema.md says this table is sorted');
  }
}

/* -------------------------------------------------------------- wire.json */

function validateWire(r, ds, teamIndex) {
  const f = ds.files.wire;
  const file = rel(f.path);
  if (!f.data) return;
  if (!checkEnvelope(r, file, f.data, 'entries')) return;

  const ids = new Set();
  const seasonCounts = new Map();

  for (const [i, e] of f.data.entries.entries()) {
    const id = e?.id ?? `#${i}`;
    if (e === null || typeof e !== 'object' || Array.isArray(e)) {
      r.err(file, id, 'record must be an object');
      continue;
    }

    requireDateAndSource(r, file, id, e);
    requireStrings(r, file, id, e, ['id', 'date_label', 'player', 'position', 'quote', 'source_title', 'source_publisher', 'source_url']);

    if (isNonEmptyString(e.id)) {
      if (ids.has(e.id)) r.err(file, id, `duplicate id — ids are stable, add a -2 / -3 suffix instead`);
      ids.add(e.id);
    }

    if (!DATE_PRECISIONS.includes(e.date_precision)) {
      r.err(file, id, `"date_precision" must be one of ${DATE_PRECISIONS.join(' | ')}`);
    }
    if (!Number.isInteger(e.season)) {
      r.err(file, id, '"season" must be an integer');
    } else if (isIsoDate(e.date) && Number(e.date.slice(0, 4)) !== e.season) {
      r.err(file, id, `"season" ${e.season} does not match the year in "date" ${e.date}`);
    }

    if (isIsoDate(e.date) && e.date_precision === 'year') {
      if (e.date.slice(5) !== YEAR_PRECISION_MMDD) {
        r.err(file, id, `year-precision records sort on <season>-${YEAR_PRECISION_MMDD}, got ${e.date}`);
      }
      if (e.date_label !== YEAR_PRECISION_LABEL) {
        r.warn(file, id, `year-precision "date_label" is normally "${YEAR_PRECISION_LABEL}", got ${JSON.stringify(e.date_label)}`);
      }
    }
    if (isIsoDate(e.date) && e.date_precision === 'day' && e.date_label !== dayLabel(e.date)) {
      r.err(file, id, `"date_label" should read "${dayLabel(e.date)}" for ${e.date}, got ${JSON.stringify(e.date_label)}`);
    }

    if (!('team' in e)) r.err(file, id, '"team" is required (use null when the source gives no team)');
    else if (e.team !== null && !teamIndex.has(e.team)) r.err(file, id, `unknown team "${e.team}" — not in teams.json abbrs or aliases`);

    if (!isPositionCode(e.position)) {
      r.err(file, id, `"position" must look like QB, RB, WR, TE or a slash pair such as WR/CB, got ${JSON.stringify(e.position)}`);
    } else if (!FANTASY_POSITIONS.includes(String(e.position).split('/')[0])) {
      r.warn(file, id, `"position" ${e.position} is outside the ${FANTASY_POSITIONS.join('/')} set the wire covers`);
    }

    if (!STATUSES.includes(e.status)) r.err(file, id, `"status" must be one of ${STATUSES.join(' | ')}`);
    if (!DIRECTIONS.includes(e.direction)) r.err(file, id, `"direction" must be one of ${DIRECTIONS.join(' | ')}`);
    if (STATUSES.includes(e.status) && DIRECTIONS.includes(e.direction) && DIRECTION_FOR_STATUS[e.status] !== e.direction) {
      r.err(file, id, `"status" ${e.status} and "direction" ${e.direction} disagree`);
    }

    if (isNonEmptyString(e.source) && isNonEmptyString(e.source_title) && isNonEmptyString(e.source_publisher)) {
      const composed = `${e.source_title} · ${e.source_publisher}`;
      if (e.source !== composed) r.err(file, id, `"source" must read "<source_title> · <source_publisher>" — expected ${JSON.stringify(composed)}`);
    }
    if (isNonEmptyString(e.source_url) && !/^https?:\/\//.test(e.source_url)) {
      r.err(file, id, '"source_url" must be an http(s) URL');
    }

    if (isNonEmptyString(e.id) && isIsoDate(e.date) && isNonEmptyString(e.player) && DATE_PRECISIONS.includes(e.date_precision)) {
      const base = wireIdBase(e);
      const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (e.id !== base && !new RegExp(`^${escaped}-\\d+$`).test(e.id)) {
        r.err(file, id, `"id" does not follow the convention — expected ${base} (or ${base}-2, ${base}-3 …)`);
      }
    }

    if (Number.isInteger(e.season)) seasonCounts.set(String(e.season), (seasonCounts.get(String(e.season)) ?? 0) + 1);
  }

  const declared = f.data.seasons;
  if (declared === null || typeof declared !== 'object' || Array.isArray(declared)) {
    r.err(file, null, '"seasons" must be an object of <year>: <count>');
  } else {
    for (const [year, n] of seasonCounts) {
      if (declared[year] !== n) r.err(file, null, `"seasons"."${year}" is ${JSON.stringify(declared[year])} but the file holds ${n} records for that season`);
    }
    for (const year of Object.keys(declared)) {
      if (!/^\d{4}$/.test(year)) r.err(file, null, `"seasons" key ${JSON.stringify(year)} is not a four-digit year`);
      else if (!seasonCounts.has(year)) r.err(file, null, `"seasons"."${year}" is listed but no records carry that season`);
    }
  }

  checkSorted(r, file, f.data.entries, compareWire, 'entries are newest-first, year-precision last within a day');
}

/** The id a wire record should carry, before any -2 / -3 collision suffix. */
export function wireIdBase(rec) {
  const slug = slugifyPlayer(rec.player);
  if (rec.date_precision === 'year') return `${rec.season}-camp-${slug}`;
  return `${rec.season}-${rec.date.slice(5, 7)}${rec.date.slice(8, 10)}-${slug}`;
}

/* ------------------------------------------------------------- snaps.json */

function validateSnaps(r, ds, wireById) {
  const f = ds.files.snaps;
  const file = rel(f.path);
  if (!f.data) return;
  if (!checkEnvelope(r, file, f.data, 'records')) return;

  if (f.data.units === null || typeof f.data.units !== 'object') {
    r.err(file, null, '"units" must describe each unit in plain language');
  } else {
    for (const u of SNAP_UNITS) {
      if (!isNonEmptyString(f.data.units[u])) r.err(file, null, `"units"."${u}" is missing its plain-language description`);
    }
  }

  const ids = new Set();
  for (const [i, s] of f.data.records.entries()) {
    const id = s?.id ?? `#${i}`;
    if (s === null || typeof s !== 'object' || Array.isArray(s)) {
      r.err(file, id, 'record must be an object');
      continue;
    }

    requireDateAndSource(r, file, id, s);
    requireStrings(r, file, id, s, ['id', 'mention_id', 'team', 'player', 'position', 'basis', 'quote', 'source_url']);

    if (isNonEmptyString(s.id)) {
      if (ids.has(s.id)) r.err(file, id, 'duplicate id');
      ids.add(s.id);
    }
    if (isNonEmptyString(s.mention_id) && s.id !== `snap-${s.mention_id}`) {
      r.err(file, id, `"id" must be "snap-" + mention_id — expected snap-${s.mention_id}`);
    }

    const mention = wireById.get(s.mention_id);
    if (!mention) {
      r.err(file, id, `"mention_id" ${JSON.stringify(s.mention_id)} does not exist in wire.json`);
    } else {
      for (const field of ['date', 'date_precision', 'season', 'team', 'player', 'position']) {
        if (s[field] !== mention[field]) {
          r.err(file, id, `"${field}" is ${JSON.stringify(s[field])} but the mention says ${JSON.stringify(mention[field])}`);
        }
      }
    }

    if (typeof s.snap_pct !== 'number' || !Number.isFinite(s.snap_pct) || s.snap_pct < 0 || s.snap_pct > 100) {
      r.err(file, id, '"snap_pct" must be a number between 0 and 100');
    } else if (Math.round(s.snap_pct * 10) !== s.snap_pct * 10) {
      r.err(file, id, `"snap_pct" carries more than one decimal place (${s.snap_pct})`);
    }

    const hasNum = s.numerator !== null && s.numerator !== undefined;
    const hasDen = s.denominator !== null && s.denominator !== undefined;
    if (!('numerator' in s) || !('denominator' in s)) {
      r.err(file, id, '"numerator" and "denominator" are required (null when the source stated only a percentage)');
    } else if (hasNum !== hasDen) {
      r.err(file, id, '"numerator" and "denominator" must both be present or both be null');
    } else if (hasNum) {
      if (!Number.isInteger(s.numerator) || s.numerator < 0) r.err(file, id, '"numerator" must be a non-negative integer or null');
      if (!Number.isInteger(s.denominator) || s.denominator <= 0) r.err(file, id, '"denominator" must be a positive integer or null');
      if (Number.isInteger(s.numerator) && Number.isInteger(s.denominator) && s.denominator > 0) {
        if (s.numerator > s.denominator) r.err(file, id, `"numerator" ${s.numerator} exceeds "denominator" ${s.denominator}`);
        const expected = Math.round((s.numerator / s.denominator) * 1000) / 10;
        if (typeof s.snap_pct === 'number' && Math.abs(expected - s.snap_pct) > 0.05) {
          r.err(file, id, `"snap_pct" ${s.snap_pct} does not match ${s.numerator}/${s.denominator} = ${expected}`);
        }
      }
    }

    if (typeof s.derived !== 'boolean') r.err(file, id, '"derived" must be true or false');
    else if (s.derived !== hasNum) {
      r.err(file, id, s.derived
        ? '"derived" is true but no numerator/denominator is stored — derived means arithmetic on counts the source stated'
        : '"derived" is false but counts are stored — a percentage computed from counts is derived');
    }

    if (!SNAP_UNITS.includes(s.unit)) r.err(file, id, `"unit" must be one of ${SNAP_UNITS.join(' | ')}`);
    if (isNonEmptyString(s.source_url) && !/^https?:\/\//.test(s.source_url)) r.err(file, id, '"source_url" must be an http(s) URL');
    if (!DATE_PRECISIONS.includes(s.date_precision)) r.err(file, id, `"date_precision" must be one of ${DATE_PRECISIONS.join(' | ')}`);
    if (!Number.isInteger(s.season)) r.err(file, id, '"season" must be an integer');
  }

  checkSorted(r, file, f.data.records, compareWire, 'records are newest-first');
}

/* ----------------------------------------------------------- battles.json */

function validateBattles(r, ds, wireById, teamIndex) {
  const f = ds.files.battles;
  const file = rel(f.path);
  if (!f.data) return;
  if (!checkEnvelope(r, file, f.data, 'battles')) return;

  const ids = new Set();
  for (const [i, b] of f.data.battles.entries()) {
    const id = b?.id ?? `#${i}`;
    if (b === null || typeof b !== 'object' || Array.isArray(b)) {
      r.err(file, id, 'record must be an object');
      continue;
    }

    requireDateAndSource(r, file, id, b);
    requireStrings(r, file, id, b, ['id', 'team', 'position', 'basis', 'quote', 'source_url']);

    if (isNonEmptyString(b.id)) {
      if (ids.has(b.id)) r.err(file, id, 'duplicate id');
      ids.add(b.id);
    }
    if (Number.isInteger(b.season) && isNonEmptyString(b.team) && isNonEmptyString(b.position)) {
      const expected = battleId(b);
      if (b.id !== expected) r.err(file, id, `"id" must be ${expected} — one battle per season/team/position`);
    } else if (!Number.isInteger(b.season)) {
      r.err(file, id, '"season" must be an integer');
    }

    if (isNonEmptyString(b.team) && !teamIndex.has(b.team)) r.err(file, id, `unknown team "${b.team}"`);
    if (!isPositionCode(b.position)) r.err(file, id, `"position" must look like RB or WR/CB, got ${JSON.stringify(b.position)}`);
    if (!DATE_PRECISIONS.includes(b.date_precision)) r.err(file, id, `"date_precision" must be one of ${DATE_PRECISIONS.join(' | ')}`);
    if (!isIsoDate(b.updated)) r.err(file, id, '"updated" must be a YYYY-MM-DD date');
    else if (isIsoDate(b.date) && b.updated < b.date) r.err(file, id, `"updated" ${b.updated} is earlier than "date" ${b.date}`);

    if (!Array.isArray(b.contenders) || b.contenders.length < 2) {
      r.err(file, id, '"contenders" must list at least two players');
    } else {
      let sum = 0;
      const names = new Set();
      for (const c of b.contenders) {
        if (c === null || typeof c !== 'object' || Array.isArray(c)) {
          r.err(file, id, 'each contender must be an object');
          continue;
        }
        if (!isNonEmptyString(c.player)) r.err(file, id, 'contender "player" is required — name him exactly as the source does');
        else if (names.has(c.player)) r.err(file, id, `contender ${JSON.stringify(c.player)} is listed twice`);
        else names.add(c.player);

        if (typeof c.share !== 'number' || !Number.isFinite(c.share) || c.share < 0 || c.share > 1) {
          r.err(file, id, `contender ${JSON.stringify(c.player)} needs a "share" between 0 and 1`);
        } else sum += c.share;

        if (!(c.snaps === null || (Number.isInteger(c.snaps) && c.snaps >= 0))) {
          r.err(file, id, `contender ${JSON.stringify(c.player)} "snaps" must be a non-negative integer or null`);
        }
        if (!(c.note === null || isNonEmptyString(c.note))) {
          r.err(file, id, `contender ${JSON.stringify(c.player)} "note" must be a string or null`);
        }
      }
      if (Math.abs(sum - 1) > 1e-6) r.err(file, id, `contender shares sum to ${Number(sum.toFixed(6))}, must sum to 1`);
    }

    if (typeof b.derived !== 'boolean') r.err(file, id, '"derived" must be true or false');
    if (!Array.isArray(b.mention_ids)) r.err(file, id, '"mention_ids" must be an array of wire.json ids');
    else for (const mid of b.mention_ids) {
      if (!wireById.has(mid)) r.err(file, id, `"mention_ids" references ${JSON.stringify(mid)}, which is not in wire.json`);
    }
    if (isNonEmptyString(b.source_url) && !/^https?:\/\//.test(b.source_url)) r.err(file, id, '"source_url" must be an http(s) URL');
  }

  checkSorted(r, file, f.data.battles, compareBattles, 'battles are newest-first, then by id');
}

export function battleId(b) {
  return `battle-${b.season}-${b.team}-${String(b.position).replace(/\//g, '-')}`.toLowerCase();
}

/* ------------------------------------------------------------- posts.json */

function validatePosts(r, ds) {
  const f = ds.files.posts;
  const file = rel(f.path);
  if (!f.data) return;
  if (!checkEnvelope(r, file, f.data, 'posts')) return;

  const slugs = new Set();
  const numbers = [];
  for (const [i, p] of f.data.posts.entries()) {
    const id = p?.slug ?? `#${i}`;
    if (p === null || typeof p !== 'object' || Array.isArray(p)) {
      r.err(file, id, 'record must be an object');
      continue;
    }

    requireStrings(r, file, id, p, ['slug', 'number', 'title', 'kicker', 'dek', 'href']);
    if (isNonEmptyString(p.slug)) {
      if (slugs.has(p.slug)) r.err(file, id, 'duplicate slug');
      slugs.add(p.slug);
      if (!/^[a-z0-9-]+$/.test(p.slug)) r.err(file, id, '"slug" must be lowercase letters, digits and dashes');
    }
    if (typeof p.number === 'string' && !/^\d{3}$/.test(p.number)) r.err(file, id, '"number" must be a zero-padded three-digit string such as "001"');
    if (typeof p.number === 'number') r.err(file, id, '"number" must be a string, not an integer — it is displayed verbatim');
    if (p.title_long !== undefined && !isNonEmptyString(p.title_long)) r.err(file, id, '"title_long" must be a non-empty string when present');
    if (!POST_STATUSES.includes(p.status)) r.err(file, id, `"status" must be one of ${POST_STATUSES.join(' | ')}`);
    if (!isHex6(p.accent)) r.err(file, id, '"accent" must be a #rrggbb hex colour');
    if (!isHex6(p.accent_text)) r.err(file, id, '"accent_text" must be a #rrggbb hex colour');

    for (const key of ['href', 'fallback_href']) {
      const v = p[key];
      if (v === undefined) continue;
      if (!isNonEmptyString(v) || !v.startsWith('/the-side-quest/')) {
        r.err(file, id, `"${key}" must be site-root-absolute and start with /the-side-quest/`);
      } else if (!fs.existsSync(resolveSitePath(v))) {
        r.warn(file, id, `"${key}" points at ${v}, which does not exist on disk`);
      }
    }

    if (!isIsoDate(p.updated)) r.err(file, id, '"updated" must be a YYYY-MM-DD date');
    if (!UPDATED_PRECISIONS.includes(p.updated_precision)) r.err(file, id, `"updated_precision" must be one of ${UPDATED_PRECISIONS.join(' | ')}`);
    else if (p.updated_precision === 'month' && isIsoDate(p.updated) && p.updated.slice(8) !== '01') {
      r.err(file, id, '"updated_precision" is "month" so the day must be the placeholder 01');
    }

    const hs = p.headline_stat;
    if (hs === null || typeof hs !== 'object' || Array.isArray(hs)) r.err(file, id, '"headline_stat" must be an object');
    else {
      if (!isNonEmptyString(hs.value)) r.err(file, id, '"headline_stat.value" must be a non-empty string');
      if (!isNonEmptyString(hs.label)) r.err(file, id, '"headline_stat.label" must be a non-empty string');
    }

    for (const key of ['tools', 'data']) {
      if (!Array.isArray(p[key])) r.err(file, id, `"${key}" must be an array of strings`);
      else for (const v of p[key]) {
        if (!isNonEmptyString(v)) r.err(file, id, `"${key}" entries must be non-empty strings`);
        else if (key === 'data') {
          if (!v.startsWith('/the-side-quest/data/')) r.err(file, id, `"data" entry ${JSON.stringify(v)} must be site-root-absolute under /the-side-quest/data/`);
          else if (!fs.existsSync(resolveSitePath(v))) r.warn(file, id, `"data" entry ${JSON.stringify(v)} does not exist on disk`);
        }
      }
    }

    const th = p.tile_theme;
    if (th === null || typeof th !== 'object' || Array.isArray(th)) {
      r.err(file, id, '"tile_theme" must be an object');
    } else {
      requireStrings(r, file, id, th, ['id', 'label']);
      if (!(th.prompt_prefix === null || isNonEmptyString(th.prompt_prefix))) {
        r.err(file, id, '"tile_theme.prompt_prefix" must be a string or null');
      }
      for (const key of ['vars', 'vars_dark']) {
        const v = th[key];
        if (v === null || typeof v !== 'object' || Array.isArray(v)) {
          r.err(file, id, `"tile_theme.${key}" must be an object of CSS custom properties`);
          continue;
        }
        for (const [k, val] of Object.entries(v)) {
          if (!k.startsWith('--tile-')) r.err(file, id, `"tile_theme.${key}" key ${JSON.stringify(k)} must be a --tile-* custom property`);
          if (typeof val !== 'string') r.err(file, id, `"tile_theme.${key}"."${k}" must be a string`);
        }
      }
      if (th.vars && typeof th.vars === 'object') {
        for (const v of REQUIRED_TILE_VARS) {
          if (!(v in th.vars)) r.err(file, id, `"tile_theme.vars" is missing ${v} — every theme defines the full vocabulary`);
        }
        const hasCaret = '--tile-caret' in th.vars;
        const isTerminal = th.prompt_prefix !== null && th.prompt_prefix !== undefined;
        if (isTerminal && !hasCaret) r.warn(file, id, 'terminal theme (prompt_prefix set) has no --tile-caret');
        if (!isTerminal && hasCaret) r.warn(file, id, '--tile-caret is set but prompt_prefix is null — caret is a terminal-theme var');
      }
    }
    if (typeof p.number === 'string') numbers.push(p.number);
  }

  if (JSON.stringify(numbers) !== JSON.stringify([...numbers].sort())) {
    r.warn(file, null, 'posts are not ordered by issue number');
  }
}

/* ------------------------------------------------------------ draft-model */

function validateDraftModel(r, ds) {
  const f = ds.files.draftIndex;
  const file = rel(DRAFT_MODEL_INDEX);
  if (!f.data) return;
  const { current, versions } = f.data;

  if (!Array.isArray(versions) || versions.length === 0) {
    r.err(file, null, '"versions" must be a non-empty array of version ids');
    return;
  }
  for (const v of versions) {
    if (!isNonEmptyString(v)) {
      r.err(file, null, '"versions" entries must be non-empty strings');
      continue;
    }
    const vf = ds.draftVersions[v];
    const vrel = rel(path.join(DRAFT_MODEL_DIR, `${v}.json`));
    if (!vf || !vf.exists) {
      r.err(file, v, `version "${v}" is listed but ${vrel} does not exist`);
      continue;
    }
    if (!vf.data) continue;
    if (vf.data.version !== v) r.err(vrel, v, `"version" is ${JSON.stringify(vf.data.version)} but the file is named ${v}.json`);
    if (!isIsoDate(vf.data.generated)) r.err(vrel, v, '"generated" must be a YYYY-MM-DD date');
  }
  if (!isNonEmptyString(current)) r.err(file, null, '"current" must name a version');
  else if (!versions.includes(current)) r.err(file, null, `"current" is ${JSON.stringify(current)}, which is not listed in "versions"`);

  if (!fs.existsSync(path.join(DRAFT_MODEL_DIR, 'provenance.md'))) {
    r.warn(rel(DRAFT_MODEL_DIR), null, 'provenance.md is missing — every number in the model files is supposed to be traceable');
  }
}

/* ---------------------------------------------------------- format drift */

function checkFormatting(r, ds) {
  for (const [name, spec] of Object.entries(FILES)) {
    const f = ds.files[name];
    if (!f?.data || f.raw === undefined) continue;
    let rendered;
    try {
      rendered = stringifyData(f.data, f.style);
    } catch (err) {
      r.err(rel(spec.file), null, `cannot re-serialise: ${err.message}`);
      continue;
    }
    if (rendered !== f.raw) {
      r.warn(rel(spec.file), null, 'formatting drifts from the house style (one-space indent, no trailing newline) — a rewrite here will produce a noisy diff');
    }
  }
}

/* -------------------------------------------------------------- entrypoint */

/**
 * Run every check over an already-loaded dataset.
 * Errors mean the contract in schema.md is broken. Warnings are advisory.
 */
export function validateDataset(ds, { checkFormat = true } = {}) {
  const r = new Report();
  for (const pe of ds.parseErrors) r.err(pe.file, null, pe.message);

  const teamIndex = buildTeamIndex(ds.files.teams?.data);
  const wireById = new Map(
    (ds.files.wire?.data?.entries ?? [])
      .filter((e) => e && typeof e.id === 'string')
      .map((e) => [e.id, e]),
  );

  validateTeams(r, ds);
  validateWire(r, ds, teamIndex);
  validateSnaps(r, ds, wireById);
  validateBattles(r, ds, wireById, teamIndex);
  validatePosts(r, ds);
  validateDraftModel(r, ds);
  if (checkFormat) checkFormatting(r, ds);

  return r;
}

/** Validate an in-memory edit before it touches disk. */
export function validateProposed(ds, { checkFormat = false } = {}) {
  return validateDataset(ds, { checkFormat });
}

/** Write a data file in the repo's house style. */
export function writeDataFile(absPath, data, style) {
  fs.writeFileSync(absPath, stringifyData(data, style), 'utf8');
}

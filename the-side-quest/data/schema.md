# `the-side-quest/data/` — schema

Runtime data for the static site. No build step: pages `fetch()` these files and must render
something sane if the fetch fails. Plain JSON, UTF-8, no comments, no trailing commas.

**Two rules govern everything in here.**

1. **Every record carries `date` and `source`.** Both are required. A record with no date or no
   source does not go in the file.
2. **Nothing is invented.** Quotes and source strings are verbatim. Stats appear only when a
   source states the number or when the number is plain arithmetic on figures the source states
   (those records set `derived: true` and explain the arithmetic in `basis`). When there is no
   real data, the array is empty. An empty array is a correct answer; a plausible-looking number
   is not.

## Files

| Path | Payload key | Records | What it drives |
| --- | --- | --- | --- |
| `posts.json` | `posts` | 3 | Landing-page quest rows and blog cards (tiles) |
| `buzz/wire.json` | `entries` | 780 | The camp wire on post No. 001 |
| `buzz/teams.json` | `teams` | 32 | Team names, colors, divisions — lookup table |
| `buzz/snaps.json` | `records` | 5 | Snap tracker |
| `buzz/battles.json` | `battles` | 3 | Position-battle meters |

Every file is an object, never a bare array, with the same envelope:

```jsonc
{
  "version": 1,            // bump on a breaking field change
  "generated": "2026-08-02",
  "description": "…",      // one line, for whoever opens the raw file
  "count": 780,            // present on the data files; equals payload.length
  "entries": [ … ]         // payload key varies per file, see table above
}
```

Paths inside the data (`href`, `data[]`) are site-root-absolute — `/the-side-quest/posts/…` —
so the same record works from `index.html` and from `blog/index.html`.

---

## `posts.json`

One record per post. This is the source of truth for tiles; the HTML should not hard-code a
title, dek, accent or link that also lives here.

| Field | Type | Req | Notes |
| --- | --- | --- | --- |
| `slug` | string | ✅ | Directory name under `posts/`. Unique. |
| `number` | string | ✅ | Zero-padded issue number, `"001"`. String, not int — it is displayed. |
| `title` | string | ✅ | Tile title. |
| `title_long` | string | | Full headline, for `<title>` / hover. |
| `kicker` | string | ✅ | All-caps rail above the title, e.g. `"No. 001 · Fantasy Football"`. |
| `dek` | string | ✅ | One-sentence standfirst. |
| `status` | enum | ✅ | `live` \| `featured` \| `archive`. |
| `accent` | hex | ✅ | Post accent, `#rrggbb`. |
| `accent_text` | hex | ✅ | Accent darkened enough to sit on cream as text. |
| `href` | string | ✅ | Root-absolute link target. |
| `fallback_href` | string | | Previous path, kept while a rebuilt post has not shipped. |
| `updated` | ISO date | ✅ | `YYYY-MM-DD`. |
| `updated_precision` | enum | ✅ | `day` \| `month`. `month` means only the month is known and the day is a placeholder `01` — render "April 2026", not "April 1". |
| `headline_stat` | object | ✅ | `{ value, label }`, both strings. `value` is the oversized numeral; `label` is the caption under it. Must be a figure published in that post. |
| `tools` | string[] | ✅ | Courier tab list shown on tile hover. Stack/data credits, shortest-first reads best. |
| `data` | string[] | ✅ | JSON files the post fetches at runtime. May be empty. |
| `tile_theme` | object | ✅ | See below. |

### `tile_theme`

Describes the post's cover as CSS custom properties, so a tile can be themed without a
per-post stylesheet.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | `honey-newsprint`, `green-terminal`, `crimson-markup`. |
| `label` | string | Human name, for the design system. |
| `prompt_prefix` | string \| null | Terminal themes only. Prefix printed before the title, e.g. `"sidequest@draft:~$ "`. `null` on non-terminal themes. |
| `vars` | object | Light-mode custom properties. Keys are literal CSS var names. |
| `vars_dark` | object | Dark-mode **overrides only** — merge over `vars`, do not treat as a complete set. |

Applying a theme:

```js
const t = post.tile_theme;
const dark = matchMedia('(prefers-color-scheme: dark)').matches;
const vars = dark ? { ...t.vars, ...t.vars_dark } : t.vars;
for (const [k, v] of Object.entries(vars)) tile.style.setProperty(k, v);
```

Var vocabulary (every theme defines all of these in `vars`):

`--tile-bg` `--tile-surface` `--tile-fg` `--tile-fg-dim` `--tile-muted` `--tile-accent`
`--tile-accent-text` `--tile-on-accent` `--tile-rule` `--tile-font` `--tile-display-font`
`--tile-mono-font` `--tile-kicker-tracking` `--tile-radius` `--tile-texture`
`--tile-texture-opacity`, plus `--tile-caret` on terminal themes.

`--tile-texture` is a ready-to-use `background-image` value — a hazard stripe on the newsprint
and markup themes, scanlines on the terminal. `--tile-muted` is metadata-only (≈3.6:1 on its
surface, matching the site's existing `--muted`); never set body copy in it. `--tile-fg`,
`--tile-fg-dim` and `--tile-accent-text` all clear 4.5:1 in both schemes.

Themes must never be rendered as a colored left-border accent bar. Use the texture, the rule,
or a full-bleed cover.

---

## `buzz/wire.json`

One record per tagged camp mention, 2018–2026, newest first. Generated once from
`research/buzz/mentions.csv` joined to the wire markup already in
`posts/camp-buzz/index.html` on `(year, player, quote)` — all 780 csv rows matched. The csv
supplies quote/source/direction; the markup supplied the day-level date and the source URL.
Maintained by hand from here on.

| Field | Type | Req | Notes |
| --- | --- | --- | --- |
| `id` | string | ✅ | `<season>-<MMDD>-<player-slug>`, or `<season>-camp-<player-slug>` when the date is year-precision. Repeats get `-2`, `-3`. Stable; do not renumber. |
| `date` | ISO date | ✅ | `YYYY-MM-DD`. |
| `date_precision` | enum | ✅ | `day` \| `year`. |
| `date_label` | string | ✅ | Exactly what the wire said: `"Aug 2"`, `"During camp"`. **Display this**, not `date`, whenever `date_precision` is `year`. |
| `season` | int | ✅ | Camp year. |
| `player` | string | ✅ | As written in the source. |
| `team` | string \| null | ✅ (may be null) | 3-letter abbr. `null` only when the source gives no team — one record, a free agent. Historical abbrs appear as written (`OAK` for the 2018–19 Raiders); resolve through `teams.json` → `aliases`. |
| `position` | string | ✅ | `QB` `RB` `WR` `TE`, or a slash pair like `WR/CB`. |
| `status` | enum | ✅ | `BUZZING` (positive) \| `STUNG` (negative). |
| `direction` | enum | ✅ | `positive` \| `negative`. Same fact as `status`, in the csv's vocabulary. |
| `quote` | string | ✅ | **Verbatim.** Curly quotes and all. Never reword, never trim. |
| `source` | string | ✅ | **Verbatim**, `"<title> · <publisher>"`. |
| `source_title` | string | ✅ | Left half of `source`. |
| `source_publisher` | string | ✅ | Right half of `source`. |
| `source_url` | string | ✅ | Link target. |

### The synthetic date

130 of 780 records come from roundups that never dated the item — the wire renders them
"During camp". Those get `date_precision: "year"` and `date: "<season>-08-01"` purely so the
record sorts. It is a placeholder, not a claim. Sort with year-precision records last within
their day:

```js
entries.sort((a, b) =>
  b.date.localeCompare(a.date) ||
  (a.date_precision === 'year') - (b.date_precision === 'year'));
```

Counts by season: 2026 135 · 2025 66 · 2024 77 · 2023 62 · 2022 104 · 2021 77 · 2020 100 ·
2019 86 · 2018 73.

---

## `buzz/teams.json`

Lookup table, all 32 clubs, sorted by `abbr`.

| Field | Type | Req | Notes |
| --- | --- | --- | --- |
| `abbr` | string | ✅ | `ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS` |
| `name` | string | ✅ | Full club name. |
| `nickname` | string | ✅ | Short name used in wire headers, e.g. `"Steelers"`. |
| `conference` | enum | ✅ | `AFC` \| `NFC`. |
| `division` | enum | ✅ | `East` \| `North` \| `South` \| `West`. |
| `primary` | hex | ✅ | Primary color. Matches the team chips already in the camp wire. |
| `secondary` | hex | ✅ | Secondary color, for the two-stop team band gradient. |
| `aliases` | string[] | ✅ | Historical/alternate abbrs (`LV: ["OAK"]`, `LAR: ["STL"]`, `LAC: ["SD"]`, `WAS: ["WFT"]`, `JAX: ["JAC"]`). May be empty. |

Resolve an abbr by exact match first, then by scanning `aliases`, then treat as unmapped and
render a neutral chip — never guess a color.

---

## `buzz/snaps.json`

Snap-share readings. Seeded only from mentions whose source states the number; the array is
short on purpose.

| Field | Type | Req | Notes |
| --- | --- | --- | --- |
| `id` | string | ✅ | `snap-<mention id>`. |
| `mention_id` | string | ✅ | The `wire.json` record this came from. |
| `date` / `date_precision` | | ✅ | Same rules as the wire. |
| `season` | int | ✅ | |
| `team` | string | ✅ | 3-letter abbr. |
| `player` | string | ✅ | |
| `position` | string | ✅ | |
| `snap_pct` | number | ✅ | 0–100, one decimal. |
| `numerator` / `denominator` | int \| null | ✅ (may be null) | Present when the source gave both counts. `null` when the source stated only a percentage. |
| `unit` | enum | ✅ | `starter_unit_share` — percent of the first-team unit's snaps the player was on the field for. `position_split` — percent of the player's own snaps taken at the listed position. Do not compare across units. |
| `basis` | string | ✅ | Plain-language statement of what the percentage measures. Render it in the tooltip. |
| `derived` | bool | ✅ | `true` = arithmetic on counts the source stated (13 of 18 → 72.2). `false` = the source stated the percentage outright. |
| `quote` | string | ✅ | Verbatim. |
| `source` / `source_url` | string | ✅ | Verbatim / link. |

**Deliberately not here:** camp reports that describe reps qualitatively ("earned first-team
reps", "took all the first-team reps"), and percentages that are not snap shares — Mike Gesicki's
"inline on 33.3% of his snaps" (alignment), Travis Etienne's "44.8% of carries inside the 5"
(carries), "50% opportunity share" (touches). Assigning any of those a `snap_pct` would be
inventing a number.

---

## `buzz/battles.json`

Position-battle meters. Only battles where the source names every contender **and** states
numbers a share can be computed from.

| Field | Type | Req | Notes |
| --- | --- | --- | --- |
| `id` | string | ✅ | `battle-<season>-<team>-<position>`, lowercase. |
| `team` | string | ✅ | 3-letter abbr. |
| `position` | string | ✅ | |
| `season` | int | ✅ | |
| `date` / `date_precision` | | ✅ | When the split was reported. |
| `updated` | ISO date | ✅ | Same as `date` on a single-report battle; move it forward when a newer report changes the shares. |
| `contenders` | array | ✅ | 2+ objects: `player` (string, exactly as the source names him), `share` (0–1, must sum to 1 across the battle), `snaps` (int \| null), `note` (string \| null — e.g. the source gave a surname only). |
| `basis` | string | ✅ | What the shares are a share *of*, and how small the sample is. Render it under the meter. |
| `derived` | bool | ✅ | `true` for every current record. |
| `mention_ids` | string[] | ✅ | Backlinks into `wire.json`. |
| `quote` / `source` / `source_url` | string | ✅ | Verbatim / verbatim / link. |

**Implied by `mentions.csv` but deliberately absent.** Add them by hand the day a source
publishes numbers.

Both contenders named, no numeric split — a `share` would have to be invented:
2026 ARI RB (Jeremiyah Love / Tyler Allgeier), 2026 SEA RB (Jadarian Price / George Holani),
2026 NE TE (Eli Raridon / Hunter Henry), 2023 TB RB (Rachaad White / Sean Tucker).

A depth-chart position stated, but the other contenders unnamed: 2022 PIT QB (Kenny Pickett,
"third-team snaps"), 2020 TB TE (Rob Gronkowski, "fewest snaps of three tight ends").

---

## Adding a daily entry by hand

The 2026 wire is live through August. Camp news lands in the Cowork artifact
`the-buzz-is-real` first; this file is the repo snapshot.

### 1. A camp wire item

Open `buzz/wire.json`. Add the object at the **top** of `entries` (the array is newest-first)
and bump `count` and the matching year in `seasons`.

```jsonc
{
  "id": "2026-0803-jaxson-dart",          // season-MMDD-player-slug; add -2 if it collides
  "date": "2026-08-03",                   // REQUIRED
  "date_precision": "day",                // "year" only if the source never dated it
  "date_label": "Aug 3",                  // what a reader sees
  "season": 2026,
  "player": "Jaxson Dart",
  "team": "NYG",                          // must exist in teams.json (or an alias)
  "position": "QB",
  "status": "BUZZING",                    // BUZZING | STUNG
  "direction": "positive",                // positive | negative — must agree with status
  "quote": "“…”",                         // COPY AND PASTE. Do not tidy it.
  "source": "<headline> · <publisher>",   // REQUIRED, verbatim
  "source_title": "<headline>",
  "source_publisher": "<publisher>",
  "source_url": "https://…"
}
```

Checklist before saving: `date` and `source` both filled · quote pasted, not retyped ·
`status` and `direction` agree · `id` unique · `count` and `seasons` bumped ·
`python3 -m json.tool the-side-quest/data/buzz/wire.json > /dev/null` passes.

If the source gives no date, use `date_precision: "year"`, `date: "2026-08-01"`,
`date_label: "During camp"`, and `id: "2026-camp-<player-slug>"`.

### 2. A snap reading

Only if the source states a number. Copy the wire record's `id` into `mention_id`, pick the
`unit`, and write `basis` so a reader knows what the percentage is a percentage of. If you had
to do arithmetic, set `derived: true` and put the arithmetic in `basis`. If the source only
says "took first-team reps", there is no reading — skip it.

### 3. A battle

Only if the source names the contenders and gives numbers. `share` values must sum to 1.
Name each contender exactly as the source does; if that is a surname only, say so in `note`.
If a battle already exists for that team/position/season, edit the existing record's
`contenders`, `share`s, `quote`, `source`, `date` and `updated` rather than adding a second one.

### 4. A post tile

Edit `posts.json` in place. `headline_stat.value` must be a figure the post actually publishes.
Bump `updated` and set `updated_precision` correctly. If a post moves, update `href` and drop
`fallback_href` once the old path is gone.

## Consuming this from a page

```js
const res = await fetch('/the-side-quest/data/buzz/wire.json');
const { entries } = await res.json();
```

Handle three states and no more: loading, loaded-with-records, and nothing-to-show. The
nothing-to-show state covers both an empty array and a failed fetch — `snaps.json` and
`battles.json` are intentionally short and may be empty in a future refresh, so an empty array
is a normal state, not an error. Never render a placeholder row that looks like a real record.

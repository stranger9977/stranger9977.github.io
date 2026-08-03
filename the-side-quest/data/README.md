# Daily update workflow

This is the how-to. `schema.md` next door is the contract — what every field means and why.
Read that when you want to know *why* a rule exists; read this when you have a quote in the
clipboard and two minutes.

Two rules run everything and neither has an override:

1. **Every record carries a date and a source.** No date or no source, no record.
2. **Nothing is invented.** Quotes are pasted, never retyped. A number goes in only when a source
   states it, or when it is plain arithmetic on numbers a source states. When there is nothing
   real to put in, the array stays empty. An empty array is a correct answer.

The 2026 camp news lands in the Cowork artifact `the-buzz-is-real` first, roughly three times a
day. This directory is the repo snapshot — you pull from the artifact into here, not the other
way round.

---

## The two commands

```bash
node scripts/add-entry.mjs --help      # add one record
node scripts/validate-data.mjs         # check every record
```

Both are plain Node, no install step, no dependencies. Run them from anywhere in the repo.

`add-entry.mjs` refuses to write a record with no date or no source, revalidates the *whole*
dataset before it saves, keeps the file sorted and formatted the way it already is, and is a
no-op if you run the same command twice. If you are unsure, add `--dry-run` — it prints exactly
what it would write and touches nothing.

`validate-data.mjs` is read-only. Exit 0 means good, exit 1 means it printed a list of records to
fix. Run it before every push.

---

## 1. Add a quote to the camp wire

The common case: a beat writer says something about a player, you want it on the wire.

```bash
node scripts/add-entry.mjs wire \
  --player "Jaxson Dart" \
  --team NYG \
  --position QB \
  --status BUZZING \
  --date 2026-08-03 \
  --quote "“took every first-team rep in the two-minute period”" \
  --source "Giants camp report, Day 9 · The Athletic" \
  --url "https://www.theathletic.com/…"
```

That writes to `buzz/wire.json` and fills in the parts you should not have to think about:

| Filled in for you | From |
| --- | --- |
| `id` | `2026-0803-jaxson-dart` — season, MMDD, player slug |
| `date_precision` | `day` |
| `date_label` | `Aug 3` |
| `season` | the year in `--date` |
| `direction` | `positive`, because `--status BUZZING` |
| `source_title` / `source_publisher` | the two halves of `--source`, split on the ` · ` |

Then it bumps `count`, bumps the right year in `seasons`, inserts the record in date order at the
top of the array, and moves the file's `generated` to today. (`--keep-generated` leaves that date
alone, if you are backfilling something old and don't want the file to claim it was touched.)

**Negative news** is `--status STUNG`. You can pass `--direction negative` instead; pass both and
they have to agree or it refuses.

**Paste the quote, don't retype it.** Curly quotes, ellipses, em dashes, the lot. Wrap it in
double quotes in the shell. If the quote itself contains a double quote, use single quotes around
the whole argument.

**A source with no date** — the roundups that just say "during camp":

```bash
node scripts/add-entry.mjs wire --camp --season 2026 \
  --player "Roman Wilson" --team PIT --position WR --status STUNG \
  --quote "“buried on the depth chart”" \
  --source "2026 Fantasy Football Stock Report: Training Camp · WalterFootball" \
  --url "https://walterfootball.com/fantasy2026trainingcamp.php"
```

`--camp` gives the record `date_precision: "year"`, the sort-only date `2026-08-01`, the label
`During camp`, and the id `2026-camp-roman-wilson`. The date is a placeholder so the record
sorts; it is not a claim that anything happened on August 1. The page displays the label.

**Same player, same day, second quote.** Just run it again with the new quote — the id gets a
`-2` suffix automatically. Run it again with the *same* quote and nothing happens:

```
= no change — the-side-quest/data/buzz/wire.json already holds 2026-0803-jaxson-dart, byte for byte.
```

**Free agents** with no club: `--team none`. **Old clubs** keep their contemporary abbreviation —
`--team OAK` for the 2018–19 Raiders is accepted and resolves through `teams.json` → `aliases`.

---

## 2. Update snap counts

A snap reading only exists when the source **states a number**. "Took first-team reps", "earned
reps with the ones", "looked like the starter" — those are wire quotes, not readings. Skip them.
Percentages that are not snap shares don't count either: "inline on 33.3% of his snaps" is
alignment, "44.8% of carries inside the 5" is carries.

A reading hangs off a wire record, so add the quote first, then the number.

**The source stated both counts** — the script does the division and marks it derived:

```bash
node scripts/add-entry.mjs snap \
  --mention 2026-0803-jaxson-dart \
  --num 34 --den 56 \
  --unit starter_unit_share \
  --basis "34 of the 56 snaps taken with the first-team offence."
```

→ `snap_pct: 60.7`, `numerator: 34`, `denominator: 56`, `derived: true`.

**The source stated a percentage outright** — no arithmetic, so it is not derived:

```bash
node scripts/add-entry.mjs snap \
  --mention 2025-0901-breece-hall \
  --pct 50.0 \
  --unit starter_unit_share \
  --basis "Share of the starters' snaps, stated outright in the source."
```

→ `snap_pct: 50.0`, `numerator: null`, `denominator: null`, `derived: false`.

Two things you have to decide yourself:

- **`--unit`.** `starter_unit_share` = percent of the first-team unit's snaps he was on the field
  for. `position_split` = percent of *his own* snaps taken at the listed position. They are not
  comparable, which is why the unit is stored on every record.
- **`--basis`.** One plain sentence saying what the percentage is a percentage of. It renders in
  the tooltip. If you did arithmetic, put the arithmetic in it: "13 of the 18 snaps taken with the
  starters."

Everything else — date, season, team, player, position, quote, source, url — is inherited from
the mention, which is how the two files stay in agreement. Override any of them with the matching
flag if you need to.

**Correcting a reading** you already added:

```bash
node scripts/add-entry.mjs snap --update \
  --mention 2026-0803-jaxson-dart --num 36 --den 56 \
  --unit starter_unit_share \
  --basis "36 of the 56 snaps taken with the first-team offence."
```

Without `--update` it refuses rather than silently overwriting.

---

## 3. Move a battle meter

A battle goes in the file only when the source **names every contender and gives numbers a split
can be computed from**. Two named backs with no numeric split is not a battle record — inventing
a share would be inventing data. `schema.md` lists the ones deliberately left out.

**New battle, from snap counts** — give each contender a count and the shares are computed:

```bash
node scripts/add-entry.mjs battle \
  --team HOU --position RB --season 2026 --date 2026-08-12 \
  --contender "player=Nick Chubb; snaps=8" \
  --contender "player=Woody Marks; snaps=2" \
  --basis "First-quarter snap split, 8 to 2, as reported. That split, not a projected season workload." \
  --quote "“played eight first quarter snaps to Marks' two”" \
  --source "Texans camp notebook · Houston Chronicle" \
  --url "https://www.houstonchronicle.com/…" \
  --mention 2026-0812-nick-chubb
```

→ shares `0.8` / `0.2`, `derived: true`, id `battle-2026-hou-rb`.

**Shares directly**, when that is what the source gives — either form works:

```bash
  --contender "Nick Chubb=0.8" --contender "Woody Marks=0.2"
  --contender "Nick Chubb=80%"  --contender "Woody Marks=20%"
```

Shares must sum to 1 or it refuses. Add `--stated` when the source published the split itself
rather than you computing it — that sets `derived: false`.

**Moving the meter** when a newer report changes the split. One battle per season/team/position,
so you update the record, you don't add a second one:

```bash
node scripts/add-entry.mjs battle --update \
  --team HOU --position RB --season 2026 --date 2026-08-19 \
  --contender "player=Nick Chubb; snaps=5" \
  --contender "player=Woody Marks; snaps=5" \
  --basis "Even first-team split a week later." \
  --quote "“an even split with the ones”" \
  --source "Texans camp notebook · Houston Chronicle" \
  --url "https://www.houstonchronicle.com/…"
```

`updated` moves to the new date, the quote and source are replaced with the newer report's, and
the existing `mention_ids` are kept unless you pass `--mention` again.

**Name each contender exactly as the source names him.** If the source only gives a surname, use
the surname and say so:

```bash
  --contender "player=Johnson; share=0.2; snaps=2; note=Source names the surname only."
```

---

## 4. Bump the draft-model version

`draft-model/` is not written by the scripts — it is hand-maintained, because every number in it
is transcribed from a table or an explicit statement already published in post 002 or 003. Adding
a version is a file copy plus two edits.

```bash
cd the-side-quest/data/draft-model
cp v1.json v2.json
```

Then, in `v2.json`:

- set `"version": "v2"` — it has to match the filename or validation fails
- set `"generated"` to today
- change the numbers, and only the numbers a post actually publishes
- anything the posts don't publish stays `null` and gets listed in `gaps`
- where the posts contradict each other, keep both and flag it in `discrepancies` — the rule is
  contradictions are preserved, not resolved

In `index.json`, add the version and point `current` at it:

```json
{"current":"v2","versions":["v1","v2"]}
```

Then update `provenance.md` — the block-by-block map of which `v2.json` field came from which
table in which post. A number with no row in that table should not be in the file.

If a page should read the new version, update the post's `data` array in `posts.json`.

```bash
node scripts/validate-data.mjs
```

The validator checks that `current` is listed in `versions`, that every listed version has a file
on disk, and that each file's `version` field matches its filename.

---

## 5. Editing by hand

Sometimes the script is the wrong shape for the job — fixing a typo in a `basis`, retiring a
record, editing `posts.json`. Edit the file directly, then:

```bash
node scripts/validate-data.mjs
```

House style, so hand edits don't produce a noisy diff:

- one-space indent, no trailing newline (all of `posts.json` and `buzz/*.json`)
- `wire.json` and `snaps.json` run newest first; within a day, `date_precision: "year"` records go
  last. `battles.json` runs newest first, then by id
- `seasons` in `wire.json` runs newest year first, and its numbers must match the records
- `count` always equals the length of the payload array
- percentages keep their decimal — `50.0`, not `50`

`draft-model/*.json` is the exception: two-space indent with a trailing newline. Leave it that
way.

### `posts.json` — the tiles

Hand-edited. `headline_stat.value` must be a figure the post actually publishes. Bump `updated`
and set `updated_precision` — `month` means only the month is known and the day is a placeholder
`01`, so the tile renders "April 2026" rather than "April 1". If a post moves, update `href` and
drop `fallback_href` once the old path is gone.

---

## 6. When validation fails

```
FAIL — 3 error(s). Fix the records listed above; nothing was written.
```

Each line is `file › record id › what is wrong`, e.g.

```
the-side-quest/data/buzz/wire.json
  • 2026-0803-jaxson-dart "date_label" should read "Aug 3" for 2026-08-03, got "August 3rd"
  • "seasons"."2026" is 999 but the file holds 135 records for that season
```

Errors break the contract in `schema.md` and block the push. Warnings are advisory — sort order,
formatting drift, a `data` path that doesn't exist on disk — and don't block anything. Add
`--strict` to fail on warnings too, or `--no-warnings` to hide them.

If `add-entry.mjs` refuses, nothing was written. The file on disk is exactly as it was.

---

## 7. Deploy

Validate, then push. `update` is where work happens; `main` is what the GitHub Actions workflow
builds from, so both get the same commit.

```bash
node scripts/validate-data.mjs && git push origin update && git push origin update:main
```

If a push is rejected, fetch and reconcile. Never force.

Live at `https://stranger9977.github.io/the-side-quest/`. Jekyll passes `the-side-quest/` through
untouched, so the JSON files are served exactly as they sit in the repo.

Optional — make validation automatic before every push:

```bash
printf '#!/bin/sh\nexec node "$(git rev-parse --show-toplevel)/scripts/validate-data.mjs" --quiet\n' \
  > .git/hooks/pre-push && chmod +x .git/hooks/pre-push
```

---

## The files

| Path | Payload key | What it drives | Written by |
| --- | --- | --- | --- |
| `posts.json` | `posts` | Landing-page quest rows and blog cards | hand |
| `buzz/wire.json` | `entries` | The camp wire on post No. 001 | `add-entry.mjs wire` |
| `buzz/teams.json` | `teams` | Team names, colours, divisions — lookup table | hand, rarely |
| `buzz/snaps.json` | `records` | Snap tracker | `add-entry.mjs snap` |
| `buzz/battles.json` | `battles` | Position-battle meters | `add-entry.mjs battle` |
| `draft-model/index.json` | — | Which model version is current | hand |
| `draft-model/v*.json` | — | Transcribed model numbers for posts 002/003 | hand |

The rules both scripts enforce live in one place: `scripts/lib/data-schema.mjs`. If `schema.md`
changes, that file changes in the same commit — otherwise "add-entry accepted it" and
"validate-data passes" start meaning two different things.

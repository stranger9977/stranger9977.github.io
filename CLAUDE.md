# CLAUDE.md — stranger9977.github.io

Nick's GitHub Pages user site. Two things live here:

1. **al-folio Jekyll site** (repo root) — legacy academic-template portfolio. Mostly untouched.
2. **The Side Quest** (`/the-side-quest/`) — Nick's sports-analytics blog. Plain static HTML, no build step. This is the part that matters.

## Branch & deploy state

- Active branch is `update`. The site content and The Side Quest live here.
- `main`/`master` are stale (near-empty initial commit), BUT `.github/workflows/deploy.yml` only fires on pushes to `main`/`master` (Jekyll build → deploys `_site` to gh-pages).
- **To deploy: push `update`, then push `update:main`.** Unknown-state caveat: remote `main` may have drifted; if a push is rejected, fetch and reconcile before forcing anything.
- Live URL once deployed: `https://stranger9977.github.io/the-side-quest/`
- Jekyll copies unknown top-level dirs into `_site`, so `the-side-quest/` passes through the build untouched.
- A `_to_delete/` folder may exist — scratch from a cloud Cowork session (its sandbox can't delete files). Safe to remove, don't commit it.

## The Side Quest — structure

```
the-side-quest/
  index.html            landing page (story, nav: Home · Blog · Contact, selected side quests incl. Kaggle links)
  blog/index.html       post cards, newest first
  posts/<slug>/index.html   one self-contained HTML file per post
  assets/img/           webp chart images (converted from R/ggplot base64 PNGs)
```

Posts: `camp-buzz` (No. 001, live trackers), `draft-sharpe` (No. 002, featured in Michael MacKelvie's video), `sharpe-counter` (No. 003).

## Design system (ESPN-the-magazine-coded)

- Cream paper `#f9f4e6` light / `#0e0c07` dark via `prefers-color-scheme`; ink `#1c1304`/`#f7efdc`.
- Per-post accent: honey `#eda100` (buzz/brand), green `#0c7a53` (sharpe), crimson `#b3263c` (counter). New posts get their own accent.
- Georgia serif body 17-18px, 680-720px column; system-ui sans for kickers/masthead/captions; hazard-stripe rule under masthead (`repeating-linear-gradient(-45deg, accent 0 9px, ink 9px 18px)`).
- Numbered section h2s (sans 850, accent number kicker), reading-progress bar, collapsible TOC, sortable tables in card wrappers, lazy webp figures with lightbox.
- Mobile-first. **Never use colored left-border accent bars on cards/callouts** — Nick considers them "AI coded".

## Prose rules (strict — Nick's voice)

- Never alter existing post prose without his sign-off. When restyling an analysis, prose is preserved byte-for-byte.
- No AI-sounding constructions: "Not vibes. A backtest.", "X, itemized", "X, stated plainly", "deserves its own paragraph", "nobody talks about". Minimal em dashes. Plain-language stats (no "odds ratio" without translation). No exclamation points. Peter Yang's no-slop editing rules.
- Never invent numbers for charts; if data's missing, leave an HTML TODO comment.

## The Buzz Is Real (camp-buzz) — special handling

- Source of truth is a Cowork artifact (`the-buzz-is-real`) updated ~3x daily (8am/1pm/7pm ET) by a cloud scheduled task pulling camp news (RotoWire, Underdog, ETR, beat-writer tweets via aggregators). The copy in this repo is a snapshot; refresh it from the artifact/cloud session rather than editing news content here.
- FROZEN: the 2018–2025 backtest numbers, methodology, and the section 08 archive year-wires. Live areas: 2026 Camp Wire (`div#wire`), front-page tracker logs, watchlist section.

## Adding a new post

1. `posts/<slug>/index.html`, self-contained, following the design system (copy a sharpe post as the shell).
2. If converting an R Markdown/ggplot piece: extract prose verbatim, decode base64 PNGs → `assets/img/<slug>-NN.webp` (quality ~84, max 1600px wide), figures with captions from aria-labels.
3. Add a card to `blog/index.html` (kicker: "No. 00N · Topic", accent color) and, if it's a flagship, a row in the landing page's Selected Side Quests.

## Related repos

- `~/draft-sharpe-analysis` — R source for posts 002/003 (has its own CLAUDE.md; pipeline: data_pipeline.R → Rmds → HTML).
- Blog roadmap: free-tier everything for now (no paid platforms); monetization later (sponsors/affiliate/memberships). Newsletter slot on landing page is a stub.

## Design system → Claude Design

`design-system/` holds the component library (10 preview HTMLs with `@dsCard` markers: tokens/, components/). To connect it to claude.ai/design so design iteration happens there:
1. In a terminal Claude Code session: `/design-login`, then `/design-sync` targeting a design-system project named "The Side Quest" (create if absent, localDir = `design-system/`).
2. After design changes land in the project, sync them back here and apply the token/CSS changes to `the-side-quest/` pages — components are the source of truth for styling, posts are the source of truth for content.

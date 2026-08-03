# draft-model — provenance

Every number in `v1.json` was transcribed from a table or an explicit numeric
statement already published in one of two posts. Nothing was re-derived,
interpolated, back-solved or estimated. Fields the posts do not publish are
`null` and are listed in `v1.json` → `gaps`.

Source files:

- **Post 002** — `the-side-quest/posts/draft-sharpe/index.html`
  ("NFL Draft Quasi-Sharpe Ratio Analysis")
- **Post 003** — `the-side-quest/posts/sharpe-counter/index.html`
  ("Stress-testing our NFL Draft model and finding where it falls short")

Post 002 contains 8 `<table>` elements, post 003 contains 5. All 13 were read;
the mapping below accounts for each one.

## Block → source table

| `v1.json` block | Post | Section | Table |
| --- | --- | --- | --- |
| `model.components` | 002 | The Formula | 3-column "Component / What it measures / How it's computed" |
| `model.formulas`, `model.elite_threshold_cap_pct` | 002 | The Formula | inline LaTeX + "Worked Example" table |
| `model.hit_definition`, `model.hit_threshold_multiplier` | 002 | The Setup / What Does a "Hit" Mean? | prose |
| `model.rookie_surplus_share_of_total_return_iqr_pct` | 002 | Where Each Piece Comes From | prose ("77-95% … interquartile range") |
| `model.sample_window` | 002 + 003 | footers / Methodology Notes | prose (two conflicting statements, both kept) |
| `positions[].starter_snap_baseline_pct`, `.hit_threshold_pct`, `.hit_threshold_note` | 002 | What Does a "Hit" Mean? | "Position / No. 1 starter snap % / Hit threshold (75% of that) / What it means" |
| `positions[].tiers[]` (n, hit_rate, p_elite, mean_player_return, fa_replacement, sharpe) | 002 | Appendix: Full Sharpe Ratio Table | 55-row "Position / Tier / N / Hit Rate / P(Elite) / Mean Return / FA Replacement / Sharpe Ratio" |
| `positions[].fa_replacement_cap_pct` | 002 | Appendix: Full Sharpe Ratio Table | same table (constant per position) |
| `sd_player_return_cap_pct` for QB Top 10 and RB Top 10 only | 002 | Worked Example: QB Top 10 vs RB Top 10 | "SD (volatility)" row — 25.7% / 9.7% |
| `positions[].fa_supply_starters_per_year`, `context.fa_supply_published` | 002 | Supply-Controlled Free Agency Replacement Cost | prose (OT 3, QB 3, IOL 8 only) |
| `positions[].best_second_contract_cap_pct` | 002 | What About Love at 3? / Is a WR3 Worth More… | prose (RB ~8%, WR ~14% only) |
| `picks.special_slices` (RB picks 2-5) | 002 | What About Love at 3? | prose (n=4, Sharpe -0.97) |
| `picks.published_pick_anchors` | 003 | The Surplus Value View | prose (pick 10 → $60.8M vs $96.4M; pick 14 crossover) |
| `players[]` rows 1–7 (top-10 RBs) | 002 | What About Love at 3? | "Player / Pick / Year / Hit? / Player Return" gt table |
| `players[]` Saquon Barkley detail fields | 002 | Player Example: Saquon Barkley | "Saquon Barkley - Pick #2, 2018" gt table |
| `players[]` Christian McCaffrey detail fields | 002 | Player Example: Saquon Barkley | prose following the table (28.9%, 8.1%, 64.6%, 1.53x, 20.8%) |
| `players[]` rows 8–17 (test-set players) | 003 | Predicting Career Value | "Model Check: Predicted vs Actual (2020-2022 Test Set)" gt table |
| `players[]` Jeremiyah Love | 003 | The 2026 RB Class / Where Love Ranks / Predicting Career Value / The Surplus Value View | prose only (no Love table exists) |
| `players[]` career-AV-only names (Henry, Ross, Waynes, Kalil, Gurley, Richardson) | 003 | Did First-Round RBs Actually Outproduce the Alternative? / Weighted Career AV | prose (the dumbbell chart itself is an image) |
| `players[]` Metcalf / Adams / Brown | 002 | Is a WR3 Worth More Than an Elite RB1? / Key Takeaways | prose — pick numbers only, no returns published |
| `context.prospect_score_vs_career_av` | 003 | Pre-Draft Elite vs Career Elite | "Prospect Score vs Career AV: R² by Position" gt table (spanners: Career AV → Elite/Other Avg AV; Starter Rate → Elite/Other Hit %) |
| `context.negative_sharpe_counterfactual` | 003 | The Negative-Sharpe Picks | "Negative-Sharpe First-Round Picks (2010-2022)" gt table (spanners: What They Got / Next Premium Player Taken) + surrounding prose for the totals |
| `context.sharpe_vs_draft_frequency` | 002 | Appendix: Does Sharpe Predict What Teams Actually Draft? | "Round / Spearman r / % of picks to positive-Sharpe positions" |
| `context.round_1_optimality` | 002 | Are Teams Drafting Optimally? | prose |
| `context.trade_back` | 002 | Appendix: The Case for Trading Back | prose |
| `context.team_draft_efficiency` | 002 + 003 | Team-Level Draft Efficiency / How Need-Adjustment Changes the Rankings | prose (the 32-team charts are images) |
| `context.career_av_variant` | 003 | Weighted Career AV: Our Measuring Stick | prose (RB only) |
| `context.class_depth_2026`, `context.rb_class_depth_statements` | 003 | Prospective Class Quality / The 2026 Class at a Glance / Did the Pre-Draft Signal Match Reality? | prose |
| `context.historical_ngs_elite` | 003 | The Historical NGS Elite | prose |
| `context.first_round_rb_counterfactual` | 003 | Did First-Round RBs Actually Outproduce the Alternative? | prose (56%) |
| `context.predictive_models` | 003 | Predicting Career Value / The Surplus Value View / Methodology Notes | prose |
| `context.market_notes` | 002 + 003 | Is a WR3 Worth More Than an Elite RB1? / The Negative-Sharpe Picks / Putting It All Together | prose |
| `context.rb_rooms_2026` | 003 | Which Teams Actually Need an RB? | "2026 RB Room Snapshot" gt table (32 rows) |

## Source tables deliberately NOT converted to data

| Post | Table | Why |
| --- | --- | --- |
| 002 | "Assumption / Why it matters" (Assumptions & Potential Improvements) | Editorial caveats, not model inputs. Referenced in prose, not needed by the calculator. |
| 003 | "Assumption / What Could Break It" (The Sharpe Ratio Was Incomplete) | Same. |

## Chart-only content (no underlying values in the HTML)

These figures are rendered `.webp` images. Their data is **not** recoverable from
the posts and is therefore absent from `v1.json`:

- The green/red Sharpe heatmap (post 002, `sharpe-01.webp`)
- Sharpe-decay curves by tier
- FA replacement cost and FA supply charts (all positions except OT/QB/IOL)
- Team draft-efficiency charts (all 32 teams except PHI/PIT)
- Best-positional-bets-by-round relative-Sharpe charts
- Player surplus leaderboards: top 10 overall, top 10 non-QB, top 25 Round 1
  (`sharpe-18` … `sharpe-20`)
- Top 5 by position group, overall and Round-1-only (`sharpe-21` … `sharpe-42`)
- Post 003: class-depth-by-year charts, NGS scatter plots, the RB dumbbell
  chart, and the Love surplus-by-pick percentile fan

## Rules applied

1. **Table beats prose.** Where the same quantity appears in both, the table
   value is stored and the prose value is recorded under `discrepancies`.
2. **Published precision preserved.** `-0.615` is stored as `-0.615`, not
   rounded to the `-0.62` used in prose.
3. **No back-solving.** `SD = (P(elite) × threshold − FA cost) / Sharpe` holds
   for the two rows where SD is printed, but it was not applied to fill the
   other 53 rows. The identity is recorded in `model.identities` so any
   consumer that derives SD does so visibly and on its own authority.
4. **Hit rate ≠ bust rate.** The posts publish hit rate only. `1 − hit_rate`
   was not stored as a bust rate, because "not a hit" is not the posts'
   definition of a bust. All `bust_rate_pct` fields are `null`.
5. **Contradictions preserved, not resolved.** Where the posts contradict
   themselves, both statements are stored and flagged.

# Buzz backtest — silent-group trim sensitivity (spec)

Nick's concern: in the "Veterans, under 8 PPG prior year" stratum (buzz 15.1% = 18/119 vs silent 0.8% = 33/4131), the silent pool is padded with bottom-of-the-barrel players who had no realistic path, inflating the 18.9x stratum lift and the pooled headline. Check how the lift moves as the floor rises. The floor must apply to BOTH groups symmetrically.

## Inputs
- `mentions.csv` (this folder) — all 780 tagged mentions recovered from the article (645 in the 2018–2025 study window + 135 live 2026). direction = majority sentiment per card.
- nflverse weekly data + snap counts + rosters, seasons 2017–2025 (prior-year features need 2017).

## Cohort reconstruction (must match the article)
- Unit: player-season, QB/RB/WR/TE, seasons 2018–2025.
- Projected starter (EXCLUDED from cohort) if ANY pre-camp fact holds: round-1 rookie draft capital; startable finish prior season (6-game min); startable PPG prior season (5-game min); 60%+ avg offensive snap share across 8+ games prior season.
- Startable outcome: total-PPR positional finish QB12 / RB24 / WR36 / TE12, from nflverse weekly.
- Exposure: player-season in mentions.csv (majority direction; mixed ties excluded) vs silent (no mention).
- Validate reconstruction against the article before trimming: pooled 16.4% (44/268) vs 1.28% (78/6094); vet stratum 18/119 vs 33/4131. If these don't reproduce within a couple players, stop and reconcile first.

## Trim ladder (apply to the veteran stratum, both groups)
Report hits/n, rates, lift at each floor on prior-year involvement:
1. No floor (current): expect 18/119 vs 33/4131, 18.9x
2. Played ≥1 game with >0 PPR points prior year
3. PPG ≥ 1 (≥4 games) prior year
4. PPG ≥ 2 (≥4 games)
5. PPG ≥ 4 (≥4 games)
6. On a week-1 53-man roster in the study season (if roster data cooperates)
Also recompute the Mantel-Haenszel pooled lift across the three strata at each floor (rookie strata unchanged). Reference: current MH-adjusted pooled lift is 7.7x vs raw 12.8x.

## Output
- `trim_results.csv`: floor, buzz_hits, buzz_n, silent_hits, silent_n, stratum_lift, mh_pooled_lift
- One-paragraph summary of where the lift stabilizes. NO article prose — Nick writes the section; the cloud session will chart it.

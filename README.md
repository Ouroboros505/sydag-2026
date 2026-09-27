# ProMaize

Your plot plan, optimized.

**Live demo: https://promaize.stipe.app**

Built for the SyDAg 2026 Hackathon at Purdue, Bayer track (genomic prediction).

## Problem

A maize program makes far more new lines than it can field-test. In the Bayer data, January 2008:
15,962 new lines from 157 families, none of them grown in a field, and plots for about 30% of them.
A line that doesn't get a plot is dropped. The breeding lead has to decide which lines get the plots,
knowing each line's DNA and nothing about how it performs.

## Solution

ProMaize predicts every new line's value from its DNA, in dollars per acre at the program's own
prices (yield times price, minus drying cost, minus lodging loss), with a range that says how far to
trust it. It then decides how to spread the plots and exactly which lines get them, and forecasts what
the plan will earn.

The app (React and TypeScript) runs in the browser and works offline. Everything it shows follows the
controls: plot budget, corn price, drying cost, target moisture, lodging loss, and the engine. A new
season's field file can be dropped in and is cleaned in the browser.

## Technical approach

**Data.** Each plot is compared with the average of its own trial (year, location and pool), then
averaged over the line's locations. Impossible values (a maturity of -24, lodging over 100%) become
missing. The tester a line was crossed to is removed as a shrunken random effect, so a line isn't
credited for its tester. Lodging is scored on 30 to 70% of plots and unscored plots stay missing, never
zero. Progeny genotypes (imputed to 2,911 SNPs) are parsed once and cached.

**Model: 2-Step.** Every family is new each season, so the prediction has two parts:

1. the family's average, from the family's mean genotype (ridge regression, recent seasons weighted up);
2. each line against its siblings, from within-family differences in markers and results.

The same model predicts yield, harvest moisture, maturity and lodging.

**Baselines,** on the same splits: environmental means, pedigree BLUP (parents' earlier families,
no markers), and standard GBLUP (one ridge over all lines). The app offers GBLUP as the "Standard"
engine for data without family structure.

**Validation.** Year-forward and family-disjoint: to score a season, train only on the seasons before
it, so every family scored is new. Repeated for 2003 to 2008. Settings were chosen on 2005 to 2007;
2008 was held out as the final test. A random k-fold that lets siblings into training scores r = 0.56
on the same 2008 lines, which is why we don't report it as accuracy.

## Results

Accuracy, as the correlation between predicted and real yield (trial- and tester-adjusted):

| season | families | 2-Step | standard GBLUP | pedigree BLUP |
|---|---|---|---|---|
| 2003 | 140 | 0.19 | 0.19 | 0.06 |
| 2004 | 157 | 0.17 | 0.10 | 0.01 |
| 2005 | 141 | 0.31 | 0.26 | 0.13 |
| 2006 | 97 | 0.29 | 0.21 | 0.10 |
| 2007 | 102 | 0.21 | 0.07 | 0.01 |
| **2008 (held out)** | **157** | **0.13** | **0.07** | **0.05** |

- 2-Step beats standard GBLUP in all six seasons. In 2008, resampling families gives r 0.06 to 0.20
  (95%), and a gain over GBLUP of 0.03 to 0.11.
- Moisture r = 0.21, maturity 0.20, lodging 0.09. Line results repeat at 0.46 across locations, so
  no method can go much past r = 0.68 on this data.
- 2008 was the hardest season to call families (r = 0.10 between families): many had parents with no
  field record. Ranking siblings still worked (r = 0.16).

**Uncertainty.** Each line gets a 90% range built from forward errors in earlier seasons. In 2008 the
ranges held 90.2% of real results. Each season's forecast comes with a range from the best and worst
past seasons.

**What the field paid** (2008, 30% of lines planted, corn at $4.50, drying $0.045 per bushel per point):

- Forecast in January: **+$5.41 an acre** over a random pick, likely $3.76 to $6.22.
  The harvest paid **+$4.98**.
- Inside each family, the tenth of lines ranked best earned $9 an acre over the family average, and
  the tenth ranked worst $7 under. The January forecast for each tenth was within about $2.
- The chosen lines earned more than the dropped ones at 150 of 179 test sites, in hot and cool,
  wet and dry summers.

## Recommendations for 2008

1. **Give every family the same share of the plots, and let the markers choose the siblings.**
   At 30%: 4,790 lines, all 157 families. Top 10 by predicted income:

   | # | line | family | income $/acre | yield bu/ac | likely range |
   |---|---|---|---|---|---|
   | 1 | C1.401.18 | C1.401 | 855 | 204.6 | 188 to 221 |
   | 2 | C1.401.27 | C1.401 | 854 | 201.8 | 186 to 218 |
   | 3 | C1.379.88 | C1.379 | 851 | 204.2 | 188 to 221 |
   | 4 | C1.401.7 | C1.401 | 851 | 203.6 | 187 to 220 |
   | 5 | C1.401.30 | C1.401 | 849 | 202.0 | 186 to 218 |
   | 6 | C1.401.20 | C1.401 | 849 | 203.0 | 187 to 219 |
   | 7 | C1.401.22 | C1.401 | 849 | 202.7 | 186 to 219 |
   | 8 | C1.430.16 | C1.430 | 847 | 203.8 | 188 to 220 |
   | 9 | C1.401.81 | C1.401 | 846 | 202.4 | 186 to 219 |
   | 10 | C1.427.34 | C1.427 | 845 | 204.3 | 188 to 221 |

   The full list, at any budget and prices, downloads from the live app (Advancement list,
   "download all as CSV") or comes from `scripts/export_list.py`.

2. **Conservative or aggressive.** Ranking every line together and betting on the best families
   earned more over the six seasons ($8.8 an acre against $5.5 for the same share per family),
   because it pays off when the parents are well known. In 2008 they weren't, the bet's forecast
   overshot, and it earned about the same as the same share ($5.1 against $5.0) while planting far
   fewer families. So: spread the plots when the new families' parents are new; concentrate when
   they're known.

3. **Price in dollars when drying or lodging is expensive.** At normal prices, ranking by dollars and
   by bushels pick lines of about equal value. With drying at 9 cents a point, ranking by dollars
   earned $0.76 an acre more, better in 5 of 6 seasons.

A one-page version for the breeding lead: [docs/ProMaize_memo_2008.pdf](docs/ProMaize_memo_2008.pdf).

## Limitations and next steps

- Families whose parents have no field record get a DNA-only family estimate; their ranges are wider.
- A season full of new parents weakens the family call (2008). Spreading plots is the protection.
- New testers have no estimated effect yet.
- Lodging is barely predictable from markers here, so it moves the ranking little.
- Prices and losses are typical values, set by the user, not the program's own costs.
- Next: site-specific recommendations once lines are tested for more than one season, and plot costs
  in the budget.

## Run it

```bash
npm install
npm run dev          # the app on http://localhost:5173
```

The app reads `public/recommendations.json` and `public/season_lines.json`, written by the pipeline.
The competition data is not in this repository.

**Judge mode** runs the whole pipeline in about ten seconds on a synthetic program with the same
layout, no dataset needed:

```bash
uv venv && uv pip install -r requirements.txt
.venv/bin/python scripts/make_fixture.py
.venv/bin/python scripts/build_data.py --judge
npm run dev
```

**Full data:** unzip the organizers' files anywhere under `data/raw/bayer/`, then
`.venv/bin/python scripts/build_data.py --source bayer` (about 10 minutes on a laptop; the first run
also caches the genotypes).

**Scaling.** Training holds one 2,911 by 2,911 matrix per season, so cost grows with markers, not
lines, and a new season is an update rather than a retrain. On one Anvil (RCAC) node, the full
pipeline from raw files ran in 3 minutes 27 seconds with 7.2 GB of memory (`scripts/job.slurm`).

## Layout

| | |
|---|---|
| `analysis/bayer.py` | data cleaning: plots to line values, testers, genotypes |
| `analysis/model.py` | the 2-Step model, baselines and validation |
| `scripts/build_data.py` | runs the pipeline and writes the app's data |
| `scripts/make_fixture.py` | the synthetic program for judge mode |
| `src/` | the app |
| `docs/` | the memo, the summary and the deck |

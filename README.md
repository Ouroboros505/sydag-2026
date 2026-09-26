# ProMaize: which lines get the ground

**SyDAg 2026 Hackathon, Bayer Genomic Prediction track.** Team: Alexander Baena, Sofia Gerena, Alen Lizarazo.

**Live demo: [promaize.stipe.app](https://promaize.stipe.app)** · how it works, from zero: [promaize.stipe.app/learn](https://promaize.stipe.app/learn/)

It is January 2008. The plot budget has been cut, and 15,962 new lines from 157 biparental
families are waiting for their first testcross season. None of those families has ever been in a
field. ProMaize predicts each line's general combining ability from its DNA and its parents,
prices it in dollars per acre, and tells the pipeline which lines to plant, how many plots that is
worth, and how far to trust it. Every number below comes from predicting years the model had not
seen, then checking against what the field actually did.

## Contents

1. [Problem and decision context](#1-problem-and-decision-context)
2. [Solution overview](#2-solution-overview)
3. [Technical approach](#3-technical-approach)
4. [Results: accuracy, uncertainty, what the field paid](#4-results)
5. [Commercial recommendations](#5-commercial-recommendations)
6. [Broad-acre or location-specific?](#6-broad-acre-or-location-specific)
7. [Limitations and failure modes](#7-limitations-and-failure-modes)
8. [Run it](#8-run-it): judge mode, full data, scaling

## 1. Problem and decision context

The dataset is the first screening stage of the 115 RM pipeline: inbred development within two
heterotic clusters (C1, C2). Each new line is crossed to a tester from the other cluster and the
testcross is grown at about seven locations, once. The field test measures GCA, how good a parent
the line is. Most lines do not beat their parents' average; the job is to find the ones that do.

**The decision:** with fewer plots than lines, which lines get tested? A line that is not tested
can never be advanced, so the ranking decides which genetics the program keeps.

**Who uses it:** the pipeline manager (how many plots, what they buy), population development
(which families deserve plots), field testing (the list, exported as CSV).

What makes this hard, and what most approaches miss: **every family is tested in exactly one
year.** A new cohort is made entirely of families nobody has seen. In 2008, 24 of the 157 families
have neither parent on record from earlier years. A model that learns "which families were good"
has nothing to say about them.

## 2. Solution overview

```
1.07M plots, 2000-2008      ->  trial- and tester-adjusted line means (GCA scale)
153k genotyped lines x 2,911 SNPs, 514 parents with real calls
        |
        v
family mean   <- ridge on the parents' midparent genotype   (between families)
line          <- ridge on sibling differences                (within a family)
        |
        v
yield, moisture, maturity, lodging  ->  $/acre at the breeder's prices, with 90% bands
        |
        v
ProMaize: budget slider, family limit, what 2008 actually paid, strategies compared, CSV list
```

The analysis runs once (about three minutes on a laptop) and writes one JSON file the web app
reads. The app computes only the user's own pricing on top, so it works offline, on a phone.

## 3. Technical approach

### Data integration and preprocessing (`analysis/bayer.py`)

- **Plots to line values.** Each plot is compared with the mean of its own trial (year x location
  x cluster: the two clusters are separate trials even at a shared location), then averaged over
  the line's ~7 locations. Recording errors outside plausible ranges are dropped (e.g. ERM of -24).
- **Tester effects removed, as a BLUP.** A line should not be advanced for the tester it happened
  to be crossed to. Many testers are used by one or two families, so a raw tester mean would be
  mostly those families' own merit. The tester effect is shrunk by the ratio of family to tester
  variance, estimated from the data by a random-effects ANOVA (lambda 4 in C1, 14 in C2), from the
  training years only when training.
- **Lodging is scored on 30-70% of plots.** Missing is treated as missing, never as zero, and
  lodging is also compared within its trial: a line's raw lodging is mostly which storm hit which
  field.
- **Genotypes.** Progeny were genotyped at 49-123 SNPs and imputed to 2,911; parents carry real
  calls at all 2,911. A gap the imputation left is filled from the family, then from the parents,
  then with the neutral code. Families with no imputed file fall back to the raw genome file.
- **Scale.** Parsing ~1,000 genotype files once takes 2.5 minutes; everything is cached to
  `data/processed/` and later runs start in seconds.

### Model (`analysis/model.py`, family-structured section)

| part | predicts | from | why |
|---|---|---|---|
| between families | the family's mean GCA | ridge on the midparent genotype, per cluster, recent cohorts weighted up (half-life 3 years) | a new family's mean can only come from its parents; linkage decays over generations, so recent years transfer better |
| within a family | each line's deviation from its siblings | ridge on within-family deviations of markers and phenotype, all earlier families | tester, trial and family effects cancel inside a family, so this learns which parental segments help |

Both parts train from per-cohort sufficient statistics (within-family X'X, family means), so a
forward validation for any year is a sum and a matrix solve, and next year's data is an update, not
a retrain. The same machinery predicts yield, harvest moisture, relative maturity and lodging;
moisture, maturity and lodging are rescaled to the spread their forward predictions actually
showed on the development years.

**Baselines** (the brief's list, on the same splits): environmental means (r = 0 by construction),
pedigree BLUP (each parent's GCA from its earlier families, no markers), and standard GBLUP (one
ridge over every line, family structure ignored, which is what most entries do).

### Validation (the part that decides whether any of this is real)

**Year-forward, family-disjoint by construction:** to score year Y, train on cohorts before Y
only; every family in Y is new. Repeated for 2003 through 2008. Model settings (the two ridge
penalties, the recency half-life) were chosen on 2005-2007 only; 2008 was held out.

Disclosure: after 2008 was first scored, we found our tester correction was under-shrunk (a fixed
lambda of 1), which subtracted part of each family's own merit as "tester effect" for testers used
by only one or two families. We replaced it with the variance-component BLUP above, for every year,
and at the same time added the recency weighting, whose half-life was chosen on 2005-2007 (it
moved those years by about +0.005). 2008 moved from r = 0.120 to 0.127; the ridge penalties were
not touched.

The leaky number is reported next to the honest one: a random k-fold that lets siblings into
training reads r = 0.56 on the same 2008 lines.

## 4. Results

### Forward accuracy, every year (GCA scale: trial- and tester-adjusted)

| predicted year | families | ProMaize | standard GBLUP | pedigree BLUP | ProMaize, as planted (tester included) |
|---|---|---|---|---|---|
| 2003 | 140 | 0.18 | 0.19 | 0.06 | 0.21 |
| 2004 | 157 | 0.18 | 0.10 | 0.01 | 0.23 |
| 2005 | 141 | **0.31** | 0.26 | 0.13 | 0.37 |
| 2006 | 97 | 0.26 | 0.21 | 0.10 | 0.33 |
| 2007 | 102 | 0.20 | 0.07 | 0.01 | 0.22 |
| **2008 (decision year)** | **157** | **0.13** | **0.07** | **0.05** | **0.12** |
| mean | | **0.21** | 0.15 | 0.06 | 0.25 |

- ProMaize beats standard GBLUP in 5 of 6 years, and doubles it in 2008.
- 2008 split: families ranked at r = 0.09 from their parents' DNA (the hardest year of the six to
  call families; 15% of them had no parent on record, the second-highest share), siblings at r = 0.16.
- Moisture r = 0.21, maturity r = 0.20, lodging r = 0.10 (barely predictable, so it moves the
  ranking little; we do not pretend otherwise).
- Ceiling: line means repeat at 0.46 across locations, so no predictor can exceed r of about 0.68.

### Uncertainty that holds

Each line's 90% band comes from forward errors on earlier years, by how many of its family's
parents are on record. **In 2008 the bands held 90.2% of real results.** Confidence tiers follow the
pedigree: high (both parents have earlier families, 45 families), medium (one, 88), low (neither, 24).

### What the field paid (the backtest)

Each way of spending the same plots, every forward year, valued at $4.50 corn and $0.045/bu/pt
drying on what the chosen lines really yielded. Plant 30% of lines:

| rule | realised $/acre over random, mean of 6 years | in 2008 | real top 10% kept | effective families |
|---|---|---|---|---|
| random | $0.0 | $0.0 | 30% | |
| standard GBLUP, rank by bushels | $5.5 | $1.2 | 36% | 46 |
| ProMaize, rank by bushels | $8.1 | $3.9 | 40% | 70 |
| **ProMaize, rank by $/acre** | **$8.4** | **$4.3** | **40%** | 65 |
| ProMaize, $/acre, max 50 lines per family | $5.2 | $4.4 | 37% | 120 |
| ProMaize, same share of every family | $5.5 | $5.0 | 37% | 125 |

ProMaize's ranking realised **53% more value per acre** than standard GBLUP across six seasons,
and 3.5x as much in 2008. Ranking by dollars instead of bushels adds a little (+$0.25/acre) and
keeps the pipeline's maturity from drifting later (+0.08 days vs +0.21).

## 5. Commercial recommendations

**For the 2008 season** (the demo at 30% of plots, exportable as CSV):

1. **Plant the list in [`docs/advance_2008.csv`](docs/advance_2008.csv):** 4,789 lines (30% of the
   cohort) from 141 families, ranked by predicted $/acre with at most 50 lines from any family,
   each with its 90% band and confidence tier. Regenerate with `scripts/export_list.py` for another
   budget or family limit, or export from the demo at any setting. The top of each cluster:

   | cluster | line | family | predicted $/acre | yield bu/ac (90% band) | moisture % | confidence |
   |---|---|---|---|---|---|---|
   | C1 | C1.401.18 | C1.401 | $856 | 204.8 (189-221) | 20.1 | high |
   | C1 | C1.401.27 | C1.401 | $855 | 202.0 (186-218) | 19.3 | high |
   | C1 | C1.379.88 | C1.379 | $851 | 204.0 (187-221) | 20.6 | medium |
   | C2 | C2.442.165 | C2.442 | $844 | 202.9 (187-219) | 19.8 | low |
   | C2 | C2.385.6 | C2.385 | $843 | 201.8 (185-219) | 19.9 | medium |

   Family C2.442 ranks near the top with neither parent on record: its family mean is a pure
   genomic estimate. That is exactly the bet the family limit caps.
2. **Hedge the family bet this year.** 2008 has an unusual share of families with little pedigree
   on record, and the family-level prediction is weakest exactly then. Across 2003-2008, the more
   brand-new families a cohort has, the worse family means are predicted (correlation -0.51 over
   six years; a rule of thumb, not a law). In such years a family limit costs little and insures
   against a wrong family call: in 2008 the 50-per-family cap realised as much as the uncapped
   ranking ($4.4 vs $4.3) with 108 effective families instead of 71.
3. **Use genomics where it is reliable.** Within-family ranking held up every year (r 0.13-0.23);
   the family call swings with the pedigree on record (0.09-0.47). When in doubt, spread plots
   across families and let markers choose the siblings.
4. **Price breadth explicitly.** The demo's breadth chart shows the $/acre cost of each family
   limit, so narrowing the genetic base is a decision, not an accident.

**For the program:** the planted share can be traded against what it keeps. In 2008, planting the
top 42% by predicted $/acre kept half of the season's real top 10% (random planting needs 50%).
Across the six forward seasons, planting 30% kept 40% of the real top 10% (random: 30%).

**Operational fit:** one command rebuilds everything from the program's files in about three
minutes on a laptop (six the first time, while it caches the genotype files); new years are added
as sufficient statistics; the output is a static page and a CSV.

## 6. Broad-acre or location-specific?

**Broad-acre, and the data says why.** Within a line, plot-to-plot variation across its locations
(SD 16.5 bu, after removing each trial's mean) is 2.3x the spread between lines (SD 7.1 bu). Every
line is tested in exactly one year, so a line's location-specific response is never seen twice and
cannot be learned, validated or trusted. Predicting broad-acre GCA uses all ~7 locations as
replicates of the one thing we can predict. Location-specific placement becomes worthwhile at the
next stage, when advanced lines have multi-year records. The weather and soil covariates
(`environmental_features.csv`, per year x location) are the input for that; the adapter already
loads them (`bayer.environments()`), the model does not use them yet.

## 7. Limitations and failure modes

- **Families with no parent on record** get a purely genomic family mean. The confidence tier
  flags them; the 90% band is widest there.
- **A year like 2008**, with many new parents, degrades the family-level prediction to near zero;
  the within-family part still works. Mitigation: the family limit (recommendation 2).
- **New testers** (5 in 2008) have no estimated effect; their families are compared on the
  trial-adjusted scale only.
- **Population structure shifts**: marker effects are learned from earlier cohorts, weighted to
  recent ones; a new germplasm source degrades them without warning. The confidence tier catches
  the common case (parents never seen before), not a wholesale shift.
- **Costs are inputs**: drying cost, corn price and lodging loss are sliders with typical values,
  not the program's own numbers.
- **Lodging** is barely predictable from markers here; it enters the dollars as an expectation.

## 8. Run it

### Judge mode: the whole pipeline in about ten seconds, no dataset needed

```bash
uv venv .venv --python 3.12 && uv pip install --python .venv/bin/python -r requirements.txt
npm install
.venv/bin/python scripts/make_fixture.py              # synthetic program in the real file layout
.venv/bin/python scripts/build_data.py --judge        # forward validation, backtest, JSON
npm run dev                                           # http://localhost:5173, flagged "synthetic"
```

`make_fixture.py` writes a synthetic breeding program in the exact layout of the Bayer files:
two clusters with recurring parents, winners joining the parent pool, testers with their own
effects, progeny built from parental chromosome segments, about seven locations per family, and
plot noise matched to the real data (line-mean repeatability 0.43 vs 0.46 real).

### Full data

Put the organizers' files anywhere under `data/raw/bayer/` (zips extracted), then:

```bash
.venv/bin/python scripts/build_data.py --source bayer   # ~3 min, ~4 GB RAM; caches to data/processed/
npm run build && npm run preview
.venv/bin/python scripts/make_deck.py                   # fills the organizers' slide template
```

### Scaling

The model never holds more than one 2,911 x 2,911 matrix per cohort: training cost grows with the
number of markers squared, not with lines, and adding a year adds one matrix. The genotype cache
is float16 (0.9 GB for 153k lines). For bigger panels the same statistics accumulate in chunks on
Anvil (RCAC); `scripts/anvil.md` and `scripts/job.slurm` hold the setup.

### Layout

```
analysis/bayer.py      the Bayer adapter: plots, families, genotypes, caches
analysis/model.py      the family-structured model and forward validation (and the earlier G2F model)
scripts/build_data.py  pipeline -> public/recommendations.json (the app's only input)
scripts/make_fixture.py, make_deck.py   judge mode, slides
src/                   the React app: lib/econ.ts is the pricing, components/ the panels
src/learn/             the from-zero walkthrough at /learn
```

The contract between analysis and app is `src/lib/types.ts`. Team setup and conventions:
[docs/setup.md](docs/setup.md), [CLAUDE.md](CLAUDE.md).

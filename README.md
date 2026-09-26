# ProMaize: which lines get the ground

**SyDAg 2026 Hackathon, Bayer Genomic Prediction track.** Team: Alexander Baena, Sofia Gerena, Alen Lizarazo.

**Live demo: [promaize.stipe.app](https://promaize.stipe.app)** · how it works, from zero: [promaize.stipe.app/learn](https://promaize.stipe.app/learn/) · one-page summary: [docs/ProMaize_summary.pdf](docs/ProMaize_summary.pdf) · slides: [docs/ProMaize_deck.pptx](docs/ProMaize_deck.pptx)

It is January 2008. The plot budget has been cut, and 15,962 new lines from 157 biparental
families are waiting for their first testcross season. None of those families has ever been in a
field. ProMaize predicts each line's general combining ability from its DNA and its parents,
prices it in dollars per acre, and tells the pipeline which lines to plant, how many plots that is
worth, and how far to trust it. Every number below comes from predicting years the model had not
seen, then checking against what the field actually did.

## Results at a glance

Every number is from predicting seasons the model had not seen (year-forward: each year's families
predicted from earlier years only), then checking what the field did.

- **Accuracy:** beats standard GBLUP in all 6 seasons (mean r 0.22 vs 0.15); in 2008, the
  decision year, r = 0.13 vs 0.07. Plot noise caps any predictor near 0.68.
- **Value:** planting 30% of lines by ProMaize's $/acre ranking realised $8.8/acre over random,
  60% more than standard GBLUP ($5.5), averaged over six seasons; 4x as much in 2008.
- **Plots:** the standard ranking needed 1,277 more lines in 2008 (about 8,900 plots) to keep the
  same real winners.
- **Risk:** the 90% bands held 90.2% of real 2008 results; every line carries a confidence tier.
- **Recommendation for 2008:** plant the same share of every family and let markers pick the
  siblings (`docs/advance_2008.csv`): the last season with pedigree this thin (2007) showed breadth
  was nearly free, and 2008 confirmed it (8 cents an acre for twice the families).
- **Broad vs specific:** location-specific response is not predictable here (r = 0.03 on 82,790
  held-out plots), so the recommendation is broad-acre GCA.

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
family mean   <- ridge on the family's genotype: what its parents passed on   (between families)
line          <- ridge on sibling differences                (within a family)
        |
        v
yield, moisture, maturity, lodging  ->  $/acre at the breeder's prices, with 90% bands
        |
        v
ProMaize: budget, allocation (rank all / same share per family), what 2008 paid, strategies, CSV
```

The analysis runs once (about five minutes on a laptop) and writes one JSON file the web app
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

**Data quality, counted:**

| | |
|---|---|
| field plots | 1,072,276, 2000-2008 |
| yield / harvest moisture recorded | 95.9% / 97.3% of plots |
| relative maturity (ERM) recorded | 59.5% of plots; 1,069 impossible values (e.g. -24, 383) set to missing |
| lodging (root or stalk) recorded | 72.0% of plots; unscored is missing, never zero |
| lines with genotypes | 143,726 of 154,330 (93.1%): 65-93% in 2000-2003, 99-100% from 2004 |
| genotype cells unknown after imputation | 0.065%, set to the neutral code |

### Model (`analysis/model.py`, family-structured section)

| part | predicts | from | why |
|---|---|---|---|
| between families | the family's mean GCA | ridge on the family's mean genotype (what its parents passed on: three quarters of one parent in a backcross), per cluster, recent cohorts weighted up (half-life 3 years) | a new family's mean can only come from its parents; a quarter of families are backcrosses, which a 50/50 midparent misrepresents; linkage decays over generations, so recent years transfer better |
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

Disclosure. With the first model, settings frozen on 2005-2007, 2008 scored **r = 0.120**. Three
changes came after that, each chosen on 2005-2007 and applied to every year:

1. the tester correction was under-shrunk (a fixed lambda of 1), which subtracted part of each
   family's own merit as "tester effect" for testers with one or two families; replaced by the
   variance-component BLUP above (a fix to the yardstick as much as the model);
2. recency weighting of training cohorts (+0.005 on 2005-2007);
3. the family's mean genotype in place of the 50/50 midparent (+0.015 on 2005-2007, better in each
   of those three years).

2008 now scores r = 0.132. The ridge penalties were never changed.

The leaky number is reported next to the honest one: a random k-fold that lets siblings into
training reads r = 0.56 on the same 2008 lines.

### What we tried that did not make it in (all judged on 2005-2007 only)

| idea | result on the development years | kept? |
|---|---|---|
| one ridge over all lines (standard GBLUP) | r 0.18; the family structure is the gain | baseline |
| pedigree only: parents' earlier families, no markers | r 0.08 | baseline |
| parents + tester one-hot, raw target | looked strong (0.22) because it predicts the tester, not the line | no |
| local models from half-sib families only | r 0.18-0.24, worse than the global sibling model (0.25) | no |
| Gaussian kernel on the midparent | r 0.25, no gain over ridge | no |
| parents scored with the within-family allele effects, blended in | +0.004, within noise | no |
| rescaling the yield model's two parts | hurt the ranking (0.234 vs 0.252) | no (kept for moisture, maturity) |
| do parents appear as earlier tested lines? | 474 of 514 parents' closest genotype is their own child: no | no |
| 50/50 midparent as the family genotype (first version) | r 0.256; the family's mean genotype gives 0.271 | replaced |
| within-family penalty and weight re-tuned after that change | 0.264-0.274 across the grid: a plateau around the current setting | unchanged |
| weighting each trial by its reliability (1/noise variance) | 0.270-0.271 vs 0.271 | no |

## 4. Results

### Forward accuracy, every year (GCA scale: trial- and tester-adjusted)

| predicted year | families | ProMaize | standard GBLUP | pedigree BLUP | ProMaize, as planted (tester included) |
|---|---|---|---|---|---|
| 2003 | 140 | 0.19 | 0.19 | 0.06 | 0.23 |
| 2004 | 157 | 0.17 | 0.10 | 0.01 | 0.23 |
| 2005 | 141 | **0.31** | 0.26 | 0.13 | 0.37 |
| 2006 | 97 | 0.30 | 0.21 | 0.10 | 0.36 |
| 2007 | 102 | 0.21 | 0.07 | 0.01 | 0.23 |
| **2008 (decision year)** | **157** | **0.13** | **0.07** | **0.05** | **0.13** |
| mean | | **0.22** | 0.15 | 0.06 | 0.26 |

- ProMaize beats standard GBLUP in all 6 years (2003 narrowly: 0.192 vs 0.188), and doubles it in 2008.
- 2008 split: families ranked at r = 0.10 from what their parents passed on (the hardest year of
  the six to call families; 15% of them had no parent on record, the second-highest share),
  siblings at r = 0.16.
- Moisture r = 0.21, maturity r = 0.20, lodging r = 0.09 (barely predictable, so it moves the
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
| ProMaize, rank by bushels | $8.5 | $4.6 | 41% | 72 |
| **ProMaize, rank by $/acre** | **$8.8** | **$5.1** | **41%** | 67 |
| ProMaize, same share of every family | $5.5 | $5.0 | 37% | 125 |
| ProMaize, $/acre, max 50 lines per family | $5.2 | $4.2 | 37% | 121 |

ProMaize's ranking realised **60% more value per acre** than standard GBLUP across six seasons,
and 4x as much in 2008. Ranking by dollars instead of bushels adds a little (+$0.30/acre) and keeps
the pipeline's maturity from drifting later (+0.08 days vs +0.21).

**In plots:** to keep as many of the real top 10% as ProMaize keeps with 30% of the lines, the
standard ranking had to plant 32-38% of them (34% on average): about 790 more lines a season, and
1,277 more in 2008. At about seven locations per line, that is roughly 8,900 plots in 2008.

## 5. Commercial recommendations

**For the 2008 season** (30% of plots; the demo exports any setting as CSV):

1. **Plant [`docs/advance_2008.csv`](docs/advance_2008.csv): the same share of every family, with
   markers choosing the siblings.** 4,789 lines, all 157 families represented, each line with its
   predicted $/acre, 90% band and confidence tier.
   *Why this, in January 2008:* the family-level call is only as good as the pedigree on record,
   and 2008's is thin: 15% of its families have no parent with an earlier family and 56% have just
   one. The last season like that was 2007 (21% with none). There, splitting plots evenly across
   families gave up only $0.33/acre of realised value against the full ranking while advancing
   about twice as many families (89 vs 40 effective), and 2007's results were in hand by January.
   Across all six seasons the share of families with no parent on record correlates -0.54 with
   family-level accuracy. This first stage is general germplasm evaluation, and next year's crosses
   come from this year's winners, so breadth has value a one-season number does not count.
   *What 2008 then did:* the even split realised $4.98/acre over random against $5.06 for the full
   ranking, a difference of eight cents, with 138 effective families instead of 71.
2. **When the pedigree is well recorded, rank every line:**
   [`docs/advance_2008_ranked.csv`](docs/advance_2008_ranked.csv) is the full $/acre ranking. On
   average over the six seasons it realised the most ($8.8/acre vs $5.5 for an even split), and in
   seasons with good records the even split cost $2-7/acre. The top of each cluster:

   | cluster | line | family | predicted $/acre | yield bu/ac (90% band) | moisture % | confidence |
   |---|---|---|---|---|---|---|
   | C1 | C1.401.18 | C1.401 | $855 | 204.6 (188-221) | 20.1 | high |
   | C1 | C1.401.27 | C1.401 | $854 | 201.8 (186-218) | 19.4 | high |
   | C1 | C1.379.88 | C1.379 | $851 | 204.2 (188-221) | 20.6 | medium |
   | C2 | C2.442.165 | C2.442 | $844 | 202.8 (187-219) | 19.8 | low |
   | C2 | C2.385.6 | C2.385 | $842 | 201.6 (185-218) | 19.9 | medium |

   Family C2.442 ranks near the top with neither parent on record: its family mean is a pure
   genomic estimate, and the low tier says so. The even split keeps its best siblings without
   betting 30% of the family on that estimate.
3. **Use genomics where it is reliable.** Within-family ranking held up every year (r 0.13-0.23);
   the family call swings with the pedigree on record (0.10-0.49).
4. **Price breadth explicitly.** The demo's allocation switch (rank all lines / same share per
   family), family limit and breadth chart show the $/acre cost of any setting, so narrowing the
   genetic base is a decision, not an accident. A hard cap of 50 per family was the costliest way
   to buy breadth in our backtest; an even split did better.

**For the program:** the planted share can be traded against what it keeps. In 2008, planting the
top 39% by predicted $/acre kept half of the season's real top 10% (random planting needs 50%), and
72% kept 80% of them. Across the six forward seasons, planting 30% kept 41% of the real top 10%
(random: 30%).

**Operational fit:** one command rebuilds everything from the program's files in about five
minutes on a laptop (eight the first time, while it caches the genotype files); new years are added
as sufficient statistics; the output is a static page and a CSV.

## 6. Broad-acre or location-specific?

**Broad-acre, and we tested the alternative.** Within a line, plot-to-plot variation across its
locations (SD 14.7 bu, after removing each trial's mean) is twice the spread between lines (SD 7.1
bu). Is any of that location-to-location response predictable? We fitted a genomic reaction norm
(marker effects on a line's sensitivity to how productive a location is) on 2000-2007 plots and
asked it for each 2008 line's deviation at each of its locations: **r = 0.025 on 82,790 held-out
plots**, using each location's productivity in earlier years (what is known in January), and
r = -0.003 even when told each 2008 trial's real productivity. Every line is tested in exactly one
year, so its location response is never seen twice and cannot be learned. Broad-acre GCA uses all
~7 locations as replicates of the one thing we can predict (`model.location_response_check`
reproduces the test). Placement by location becomes worthwhile at the next stage, when advanced
lines have multi-year records; the weather and soil covariates (`environmental_features.csv`,
loaded by `bayer.environments()`) are the input for that.

## 7. Limitations and failure modes

- **Families with no parent on record** get a purely genomic family mean. The confidence tier
  flags them; the 90% band is widest there.
- **A year like 2008**, with many new parents, degrades the family-level prediction (r 0.10); the
  within-family part still works. Mitigation: in such years spread plots across families, which
  then costs little (recommendation 1).
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
python3 -m venv .venv && .venv/bin/pip install -r requirements-judge.txt   # numpy, pandas, pyarrow, scikit-learn
.venv/bin/python scripts/make_fixture.py              # synthetic program in the real file layout
.venv/bin/python scripts/build_data.py --judge        # forward validation, backtest, JSON: ~10 s
npm install && npm run dev                            # http://localhost:5173, flagged "synthetic"
```

Verified from a fresh clone with only those four packages: 8.6 seconds end to end. The full
toolkit (`requirements.txt`) is only needed for team work beyond this pipeline.

`make_fixture.py` writes a synthetic breeding program in the exact layout of the Bayer files:
two clusters with recurring parents, winners joining the parent pool, testers with their own
effects, progeny built from parental chromosome segments, about seven locations per family, and
plot noise matched to the real data (line-mean repeatability 0.43 vs 0.46 real).

### Full data

Put the organizers' files anywhere under `data/raw/bayer/` (zips extracted), then:

```bash
.venv/bin/python scripts/build_data.py --source bayer   # ~5 min, ~4 GB RAM; caches to data/processed/
.venv/bin/python scripts/export_list.py                 # docs/advance_2008.csv and _ranked.csv
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

### Provenance

The toolchain and the app shell (pricing, budget and breadth panels, the learning page) were set
up before the event on public stand-in data (Genomes to Fields), as the git history shows.
Everything that touches the Bayer data was built at the event, from 25 September: the adapter,
the family-structured model, the tester correction, the forward validation, the backtests, the
location test and the recommendations.

The contract between analysis and app is `src/lib/types.ts`. Team setup: [docs/setup.md](docs/setup.md).

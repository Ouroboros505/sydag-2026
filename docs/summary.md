# ProMaize: which lines get the ground

**SyDAg 2026 · Bayer Genomic Prediction track** · Alexander Baena, Sofia Gerena, Alen Lizarazo · **promaize.stipe.app**

**The decision.** January 2008: plots are cut, and 15,962 new lines from 157 biparental families wait
for their first testcross season. Every family is new; 24 have neither parent on record. A line that
is not tested can never be advanced.

**The insight.** This program tests each family once, so a model that learns "which families were
good" has nothing to say about next year's. ProMaize splits the question the way a breeder does:

- **the family's mean GCA** from what its parents passed on (the family's mean genotype, which gets
  backcrosses right), recent years weighted up;
- **which siblings** from which parental segments each line inherited (a sibling-difference model,
  where tester, trial and family effects cancel);
- the **tester's effect removed** as a BLUP, so lines are not credited for their tester;
- yield, moisture, maturity and lodging priced into **$/acre** at the breeder's prices.

**Evidence, from seasons the model never saw** (each year's families predicted from earlier years only):

| | ProMaize | standard GBLUP | pedigree BLUP |
|---|---|---|---|
| forward r, mean of 2003-2008 | **0.22** | 0.15 | 0.06 |
| forward r, 2008 (decision year) | **0.13** | 0.07 | 0.05 |
| seasons won against standard GBLUP | **6 of 6** | | |
| realised $/acre over random, plant 30%, 6-season mean | **$8.8** | $5.5 | |
| real top 10% kept, plant 30% (random: 30%) | **41%** | 36% | |

- 2008 gain over standard GBLUP: 0.03 to 0.11 in r (95%, resampling families); 6 of 6 seasons, sign test p = 0.016.
- 90% bands held **90.2%** of real 2008 results. Plot noise caps any predictor near r = 0.68.
- Standard GBLUP needed **1,277 more lines** (about 8,900 plots) in 2008 to keep the same winners.
- Location-specific response is not predictable here (**r = 0.03** on 82,790 held-out plots):
  broad-acre GCA is the right target at this stage.

**Recommendation for 2008.** Plant the same share of every family and let markers choose the
siblings (`docs/advance_2008.csv`, 4,789 lines, all 157 families). With pedigree this thin, the
family call is weak: in 2007, the last comparable season, the even split cost $0.33/acre for twice the
families; in 2008 it cost $0.08. With a well-recorded pedigree, rank every line by $/acre instead
(`docs/advance_2008_ranked.csv`).

**Rigor.** Settings chosen on 2005-2007; 2008 held out. The first frozen model scored 0.120 on 2008;
three later changes, each chosen on 2005-2007 and applied to every year, are disclosed. A leaky
random k-fold reads 0.56 on the same lines and is shown only for contrast.

**Run it.** `python scripts/make_fixture.py && python scripts/build_data.py --judge`: the whole
pipeline on a synthetic program in the real file layout, 10 seconds, four packages. Full data: about
five minutes on a laptop; training uses per-season sufficient statistics, so a new year is an update.

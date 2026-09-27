# ProMaize

Your plot plan, optimized.

**Live demo: https://promaize.stipe.app**

Built for the SyDAg 2026 Hackathon at Purdue (Bayer track: genomic prediction).

## The problem

A maize breeding program makes far more new lines than it can test. In the Bayer data, January 2008:
15,962 new lines from 157 families, none of them grown in a field yet, and room to test about a third.
A line that doesn't get a plot is dropped for good. Which ones get the plots?

## What ProMaize does

- Predicts each line's yield, grain moisture and lodging from its DNA, and turns them into income per
  acre at your prices: yield times price, minus drying cost, minus lodging loss.
- Gives every family the same share of the plots and plants the best-predicted siblings in each one.
  Which family wins was hard to call in 2008, when most parents had no field record. Which sibling wins
  was not.
- Forecasts in January what the plan will earn, with a range, and checks it against the harvest.

Two prediction engines, chosen by the shape of the data:

- **2-Step**, for lines that come in families: rates each cross from its parents' DNA, then ranks the
  siblings inside it.
- **Standard** (GBLUP), for lines that don't.

## Results

Every season is predicted only from the seasons before it. 2008 was held out as the final test.
At $4.50 corn and 30% of the lines planted:

- January forecast: **+$5.41 an acre** over a random pick (likely range $3.76 to $6.22).
  The harvest paid **+$4.98**.
- Inside each family, the tenth of lines ranked best earned $9 an acre above the family average, and the
  tenth ranked worst $7 below. The January forecast for each tenth landed within about $2.
- Accuracy against real yield: 2-Step beat Standard in all six seasons, 0.22 against 0.15 on average.
  Field noise caps any method near 0.68 on this data.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

The app reads `public/recommendations.json` and `public/season_lines.json`, which the pipeline writes.
The competition data is not in this repository. To run everything on a synthetic program with the
same layout:

```bash
uv venv && uv pip install -r requirements.txt
.venv/bin/python scripts/make_fixture.py
.venv/bin/python scripts/build_data.py --judge
```

With the organizers' data unzipped under `data/raw/bayer/`:

```bash
.venv/bin/python scripts/build_data.py --source bayer    # about 10 minutes
```

## Layout

| | |
|---|---|
| `analysis/` | data cleaning (`bayer.py`), models and validation (`model.py`) |
| `scripts/build_data.py` | runs the pipeline and writes the app's data |
| `src/` | the app: React and TypeScript |
| `docs/` | the memo for the breeding lead, the summary and the deck |

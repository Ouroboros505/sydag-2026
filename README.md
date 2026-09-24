# SyDAg 2026 Hackathon

Purdue Symposium of Digital Agriculture hackathon, **25–27 September 2026**, room ABE1164.

| | |
|---|---|
| Track reveal | Fri 25th, ~6:30 PM opening |
| Mentor check-ins | **Sat 26th, 9 AM – 1 PM (mandatory)** |
| Submission | **Sun 27th, 11:00 AM** |
| Presentations | Sun 27th, 12:30 PM |
| Finals + awards | Mon 28th, Beck Ag Center, 1:30 PM |

The two tracks (Bayer, IoT4Ag) are announced at the Friday opening. This repo is a **verified,
empty workspace** — a complete local toolkit with no domain content, so nothing anchors us to a
problem shape before we know what the problem is.

## Setup

**Do this before Friday.** New here → [docs/setup.md](docs/setup.md), or paste
[docs/bootstrap-prompt.md](docs/bootstrap-prompt.md) into Claude Code and let it run.

```bash
bash scripts/doctor.sh
```

When that prints **Ready**, your machine costs the team zero setup time at the event.

## The demo: Trial Planner

A budget allocator for line advancement. It ranks candidate lines that have never been
field-tested by **dollars per acre** — predicted yield after drying cost and lodging loss at
prices the user sets — and shows what a bushel ranking would leave on the table.

```
npm run data          # analysis -> public/recommendations.json  (real pipeline)
npm run data:synthetic  # placeholder with the same shape, clearly flagged in the UI
npm run dev           # http://localhost:5173
```

How the pieces connect — **analysis computes, the app displays**:

```
data/raw/<dataset>/  ->  analysis/<adapter>.py   ->  analysis/model.py  ->  scripts/build_data.py  ->  public/recommendations.json  ->  src/
                          hybrids() + markers()      ridge (GBLUP-equiv.)   emits the contract         (gitignored data never leaves)
```

`analysis/g2f.py` is the adapter for the public Genomes to Fields set, used as the stand-in
until the challenge data arrives. **Plugging in a new dataset is one new adapter file** with
the same two functions and one import swap in `scripts/build_data.py`. The contract the app
reads is `src/lib/types.ts`; nothing in `src/` knows what the raw data looked like.

Validation is year-forward on lines never seen in training, with the leaky random-k-fold
number shown beside it so nobody mistakes one for the other.

## Stack

Everything installs **locally per machine** and is gitignored. Only source goes to git.

| | |
|---|---|
| Front end / demo | React 19 + TypeScript + Vite 6, PWA, Dexie (IndexedDB) |
| Analysis | Python 3.12 in `.venv` via `uv` — pandas, sklearn, xgboost, geopandas, rasterio, opencv, streamlit, fastapi |
| Stats | R — tidyverse, tidymodels, sf, terra, arrow |
| Deep learning | `requirements-ml.txt`, optional (torch, transformers, ultralytics) |
| Heavy compute | Anvil (RCAC/ACCESS) — [scripts/anvil.md](scripts/anvil.md) |

```bash
npm run dev        # dev server on :5173
npm run phone      # reachable URLs + QR code for phone testing
npm run build      # typecheck + production build
npm run data       # analysis -> public/*.json
```

## How the pieces connect

**Analysis computes, the app displays.**

```
data/raw/  ->  analysis/*.py or R/  ->  scripts/build_data.py  ->  public/*.json  ->  src/lib/data.ts
```

The JSON ships with the build, so the demo runs with no network. Venue wifi fails; a demo that
needs the internet is a demo that can die on stage.

## Layout

```
src/              React + TypeScript app; lib/types.ts is the contract, lib/econ.ts the pricing
public/           static assets and the JSON analysis writes
analysis/         Python — data.py (paths), g2f.py (adapter), model.py (ridge + forward validation)
R/                R scripts; setup.R installs the R toolkit
scripts/          build_data.py (pipeline -> JSON), doctor.sh, phone.sh, anvil.md, job.slurm
data/raw/         untouched inputs (gitignored)
data/processed/   cleaned outputs (gitignored)
docs/             setup, bootstrap prompt, track brief, pitch outline
```

## Before the event

Read [docs/track-brief.md](docs/track-brief.md) — what the two sponsors work on, the role
split, and the first-hour protocol.

## Working agreement

- **Commit to `main`, small and often.** `git pull --rebase` before every push.
- **Stay in your own files.** Conflicts come from two people editing one file.
- **`npm run build` must always pass.**
- **No notebooks.** Scripts in `analysis/` or `scripts/`.
- **No data, `node_modules/`, `.venv/` or `dist/` in git.**

## About this repo predating the event

Most hackathons require the submitted *work* be produced during the event. This repo is
toolchain only — environment setup, shared paths, plot styling, docs. No data, no analysis, no
domain logic, nothing track-specific. Confirm the rules at the opening; if organizers want a
repo created after kickoff, we start fresh and copy the scaffolding in, which costs five minutes.

## Before Friday

- [ ] Registered on the Qualtrics form — **individually**, exact same team name
- [ ] `bash scripts/doctor.sh` prints **Ready**
- [ ] ACCESS ID registered (@purdue.edu), sent to Alex
- [ ] SSH public key sent to Alex

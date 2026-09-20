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
src/              React + TypeScript app; src/lib/ for shared logic
public/           static assets and the JSON analysis writes
analysis/         Python — data.py owns all paths, viz.py owns plot styling
R/                R scripts; setup.R installs the R toolkit
scripts/          doctor.sh, build_data.py, phone.sh, anvil.md, job.slurm
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

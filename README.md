# SyDAg 2026 Hackathon

Purdue Symposium of Digital Agriculture hackathon, **25–27 September 2026**, room ABE1164.

| | |
|---|---|
| Track reveal | Fri 25th, ~6:30 PM opening |
| Mentor check-ins | **Sat 26th, 9 AM – 1 PM (mandatory)** |
| Submission | **Sun 27th, 11:00 AM** |
| Presentations | Sun 27th, 12:30 PM |
| Finals + awards | Mon 28th, Beck Ag Center, 1:30 PM |

The two tracks (Bayer, IoT4Ag) are announced at the Friday opening. This repo is a **skeleton
on purpose** — no sample data, no example analysis, nothing that would anchor us to a problem
shape before we know what the problem is.

## About this repo predating the event

Most hackathons require that the submitted *work* be produced during the event. This repo is
deliberately scaffolding only — environment setup, shared paths, plot styling, docs. There is
no data, no analysis, no domain logic, and nothing track-specific, because none of that is
known until Friday. Confirm the rules at the opening; if organizers want a repo created after
the kickoff, we start a fresh one and copy the scaffolding in, which costs about five minutes.

## Setup

New here? → **[docs/setup.md](docs/setup.md)**, or paste
[docs/bootstrap-prompt.md](docs/bootstrap-prompt.md) into Claude Code and let it run.

```bash
cd ~/hackathon/sydag-2026
uv venv && uv pip install -r requirements.txt
source .venv/bin/activate
streamlit run app/app.py
```

## Layout

```
app/app.py              demo shell — empty until we know what we're demoing
src/data.py             paths + load/save. no hardcoded paths anywhere else
src/viz.py              shared plot styling
notebooks/<you>/        your scratch space. nobody else touches it
data/raw/               untouched inputs (gitignored)
data/processed/         cleaned outputs, written via src.data.save (gitignored)
scripts/anvil.md        Anvil / ACCESS cheatsheet
scripts/job.slurm       batch job template
docs/setup.md           WSL setup
docs/bootstrap-prompt.md  paste-in-Claude setup prompt
docs/pitch-outline.md   presentation skeleton
```

## Working agreement

- **Commit to `main`, small and often.** `git pull --rebase` before every push.
- **Stay in your own files.** Conflicts come from two people editing one file.
- **Notebooks are scratch.** Anything that matters moves into `src/`.
- **No data in git.**
- **Never push a broken app.** The demo is the deliverable.

## Before Friday

- [ ] Registered on the Qualtrics form — **individually**, with the exact same team name
- [ ] Repo cloned, `streamlit run app/app.py` works
- [ ] ACCESS ID registered (@purdue.edu), sent to Alex
- [ ] SSH public key sent to Alex

# SyDAg 2026 Hackathon

Purdue Symposium of Digital Agriculture hackathon, **25–27 September 2026**, room ABE1164.

| | |
|---|---|
| Track reveal | Fri 25th, ~6:30 PM opening |
| Mentor check-ins | **Sat 26th, 9 AM – 1 PM (mandatory)** |
| Submission | **Sun 27th, 11:00 AM** |
| Presentations | Sun 27th, 12:30 PM |
| Finals + awards | Mon 28th, Beck Ag Center, 1:30 PM |

## Setup (5 minutes, do this BEFORE Friday)

Windows people: see [docs/setup-windows.md](docs/setup-windows.md) first.

```bash
git clone git@github.com:Ouroboros505/sydag-2026.git
cd sydag-2026
uv venv
uv pip install -r requirements.txt
```

Activate, then check it runs:

```bash
# macOS / Linux
source .venv/bin/activate
# Windows PowerShell
.venv\Scripts\Activate.ps1

streamlit run app/app.py
```

You should get a browser tab with the app shell. If you do, you're ready for Friday.

## Layout

```
app/app.py          the demo — must run at all times
src/data.py         loading + saving. all paths live here
src/viz.py          shared plot style
notebooks/<you>/    your scratch space. nobody else touches it
data/raw/           untouched inputs (gitignored)
data/processed/     cleaned outputs (gitignored)
scripts/anvil.md    HPC cheatsheet
docs/               setup + pitch outline
```

## Working agreement

- **Commit to `main`, small and often.** `git pull --rebase` before every push.
- **Stay in your own files.** Conflicts come from two people editing one file.
- **Notebooks are scratch.** Anything that matters gets moved into `src/`.
- **No data in git.** Share it via the shared folder or a USB stick.
- **Never push a broken app.** The demo is the deliverable.

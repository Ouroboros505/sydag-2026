# Windows setup — do this before Friday 25th

Takes about 15 minutes. Doing it on Friday night costs the team an hour we don't have.

## 1. Git

Install **Git for Windows**: https://git-scm.com/download/win
Accept every default. This also gives you Git Bash, which is a usable terminal.

Then set your identity (use the email on your GitHub account):

```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## 2. GitHub access

1. Make a GitHub account if you don't have one.
2. Send Alex your **GitHub username** so he can add you to the repo.
3. Accept the invite email.

## 3. Python, via uv

`uv` handles Python for you — you don't need to install Python separately.

```powershell
winget install --id=astral-sh.uv -e
```

If `winget` isn't available:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Close and reopen the terminal, then confirm:

```powershell
uv --version
```

## 4. Clone and install

```powershell
git clone https://github.com/OWNER/sydag-2026.git
cd sydag-2026
uv venv
uv pip install -r requirements.txt
.venv\Scripts\Activate.ps1
```

If PowerShell refuses to activate, run once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## 5. Prove it works

```powershell
streamlit run app/app.py
```

A browser tab should open with the app shell. **That's the finish line — stop here.**

## 6. Editor

Install **VS Code** (https://code.visualstudio.com/) plus the *Python* and *Jupyter*
extensions. Open the repo folder, and pick the `.venv` interpreter when prompted.

## 7. Claude Code

```powershell
npm install -g @anthropic-ai/claude-code
```

(Needs Node.js: `winget install OpenJS.NodeJS.LTS`.) Then run `claude` inside the repo folder
and log in with your Claude account.

On the Pro plan, **use Sonnet, not Opus** — it's plenty for this and your limits will last
the whole weekend instead of running out on Saturday afternoon.

## Checklist

- [ ] `git --version` works
- [ ] Added to the GitHub repo, invite accepted
- [ ] `uv --version` works
- [ ] Repo cloned, dependencies installed
- [ ] `streamlit run app/app.py` opens the app
- [ ] Made one test commit and pushed it
- [ ] `claude` runs inside the repo

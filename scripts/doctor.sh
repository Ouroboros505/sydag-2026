#!/usr/bin/env bash
# Checks every part of the toolchain and says exactly what to run for anything missing.
#   bash scripts/doctor.sh
# Run it before Friday. A clean report means zero setup time at the event.
set -uo pipefail
cd "$(dirname "$0")/.."

pass=0; fail=0
ok()   { printf '  \033[32mOK\033[0m    %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  \033[31mMISS\033[0m  %-34s \033[2m%s\033[0m\n' "$1" "$2"; fail=$((fail+1)); }
head_() { printf '\n\033[1m%s\033[0m\n' "$1"; }

head_ "System"
for c in git curl; do
  command -v $c >/dev/null && ok "$c" || bad "$c" "sudo apt install -y $c"
done
command -v gh >/dev/null && ok "gh" || bad "gh" "sudo apt install -y gh"
if command -v gh >/dev/null; then
  gh auth status >/dev/null 2>&1 && ok "gh authenticated" || bad "gh authenticated" "gh auth login --with-token"
fi
git config user.email >/dev/null 2>&1 && ok "git identity" || bad "git identity" "git config --global user.email ..."
command -v qrencode >/dev/null && ok "qrencode (phone QR)" || bad "qrencode (phone QR)" "sudo apt install -y qrencode"

head_ "Node"
if command -v node >/dev/null; then
  v=$(node -v); maj=${v#v}; maj=${maj%%.*}
  [ "$maj" -ge 20 ] && ok "node $v" || bad "node $v too old" "nvm install 22"
else bad "node" "nvm install 22"; fi
command -v npm >/dev/null && ok "npm $(npm -v)" || bad "npm" "comes with node"
[ -d node_modules ] && ok "node_modules installed" || bad "node_modules" "npm install"

head_ "Python"
command -v uv >/dev/null && ok "uv $(uv --version | awk '{print $2}')" || bad "uv" "curl -LsSf https://astral.sh/uv/install.sh | sh"
if [ -x .venv/bin/python ]; then
  ok ".venv exists ($(.venv/bin/python -V 2>&1 | awk '{print $2}'))"
  missing=$(.venv/bin/python - <<'PY' 2>/dev/null
import importlib
mods=['pandas','numpy','scipy','polars','duckdb','sklearn','statsmodels','xgboost','lightgbm',
      'matplotlib','seaborn','plotly','altair','geopandas','rasterio','xarray','shapely','folium',
      'PIL','skimage','cv2','requests','bs4','openpyxl','fitz','streamlit','fastapi','rich','anthropic']
print(' '.join(m for m in mods if not importlib.util.find_spec(m)))
PY
)
  [ -z "$missing" ] && ok "python packages (29)" || bad "python packages: $missing" "uv pip install -r requirements.txt"
else bad ".venv" "uv venv && uv pip install -r requirements.txt"; fi

head_ "R"
if command -v Rscript >/dev/null; then
  ok "R $(Rscript -e 'cat(as.character(getRversion()))' 2>/dev/null)"
  rmiss=$(Rscript -e 'p<-c("tidyverse","ggplot2","data.table","sf","arrow","tidymodels"); cat(paste(setdiff(p, rownames(installed.packages())), collapse=" "))' 2>/dev/null)
  [ -z "$rmiss" ] && ok "R packages" || bad "R packages: $rmiss" "Rscript R/setup.R"
else bad "R" "sudo apt install -y r-base && Rscript R/setup.R"; fi

head_ "Build"
if [ -d node_modules ]; then
  npm run build >/dev/null 2>&1 && ok "npm run build" || bad "npm run build fails" "see: npm run build"
else bad "npm run build" "npm install first"; fi

head_ "Demo"
[ -s public/recommendations.json ] && ok "public/recommendations.json present" || bad "recommendations.json" "npm run data:synthetic"
if [ -x .venv/bin/python ]; then
  .venv/bin/python -c "import sys; sys.path.insert(0,'.'); from analysis import model, g2f, bayer" 2>/dev/null && ok "analysis modules import" || bad "analysis modules" "uv pip install -r requirements.txt"
fi

head_ "Anvil"
[ -f ~/.ssh/id_ed25519.pub ] && ok "ssh key present" || bad "ssh key" "ssh-keygen -t ed25519 -C you@purdue.edu"

printf '\n\033[1m%d passed, %d to fix\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ] && printf '\033[32mReady. Nothing to do at the event.\033[0m\n'
exit 0

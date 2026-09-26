"""Write another program's files, in a different layout, to exercise the custom adapter.

Cuts 160 families out of the Bayer data and rewrites them the way a different company might
deliver them: other column names, yield in t/ha, markers coded 0/1/2, a family column called
"Cross". Output: data/raw/custom/ (field_results.csv, markers.csv, layout.json). Then:

    python scripts/build_data.py --source custom --out /tmp/custom.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analysis import bayer, data  # noqa: E402

out = data.RAW / "custom"
out.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(1)

p = bayer.plots()
p = p[(p["cluster"] == "C2") & p["year"].between(2003, 2007)]
fams = sorted(p["family"].unique())
p = p[p["family"].isin(set(rng.choice(fams, size=min(160, len(fams)), replace=False)))]

X, meta = bayer._genotype_cache()
pos = {i: k for k, i in enumerate(meta["ids"])}
ids = sorted(i for i in p["id"].unique() if i in pos)
cols = np.sort(rng.choice(X.shape[1], size=2000, replace=False))
G = np.asarray(X[[pos[i] for i in ids]], dtype=np.float32)[:, cols] + 1       # -1/0/1 -> 0/1/2
m = pd.DataFrame(np.rint(G).astype(int), index=pd.Index(ids, name="LineName"), columns=[f"SNP{c:05d}" for c in cols])
m.to_csv(out / "markers.csv")

field = pd.DataFrame({
    "LineName": p["id"], "Season": p["year"], "Site": p["location"],
    "Yield_t_ha": (p["yield_bu"] / 15.93).round(3), "Moisture": p["mst"], "LodgedPct": p["lodging"],
    "Cross": p["family"],
})
field.to_csv(out / "field_results.csv", index=False)
(out / "layout.json").write_text(json.dumps({
    "name": "Example program (another layout)",
    "field_file": "field_results.csv", "markers_file": "markers.csv",
    "columns": {"line": "LineName", "year": "Season", "location": "Site", "yield": "Yield_t_ha",
                "moisture": "Moisture", "lodging": "LodgedPct", "family": "Cross"},
    "yield_unit": "t/ha", "markers_coding": "0/1/2",
}, indent=2))
print(f"{out.relative_to(data.ROOT)}: {len(field):,} plots, {len(ids):,} genotyped lines, {field['Cross'].nunique()} families, "
      f"{m.shape[1]} markers, seasons {field['Season'].min()}-{field['Season'].max()}")

#!/usr/bin/env python
"""Write a tiny dataset in the documented population-structured layout to data/raw/bayer/,
so analysis/bayer.py can be exercised before the real files exist.

    python scripts/make_fixture.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from analysis import data  # noqa: E402

BASE = data.RAW / "bayer"
rng = np.random.default_rng(3)
LOCS = ["NEDA", "IAPR", "IADA", "ILBM", "ILMN", "INVI", "MOBU"]
N_MARK = 300


def main() -> None:
    BASE.mkdir(parents=True, exist_ok=True)
    markers = [f"M{rng.integers(1, 99_999_999):08d}" for _ in range(N_MARK)]
    for cluster in ("C1", "C2"):
        gdir = BASE / f"ImputedPopulations{cluster}"
        gdir.mkdir(exist_ok=True)
        pheno = []
        for pop in range(1, 7):
            n_prog = int(rng.integers(15, 30))
            parents = [f"PID{rng.integers(100000, 999999)}" for _ in range(2)]
            P = rng.choice([-1, 1], size=(2, N_MARK))
            prog = np.where(rng.random((n_prog, N_MARK)) < 0.5, P[0], P[1]).astype(float)
            prog[rng.random(prog.shape) < 0.02] = np.nan
            ids = parents + [f"{i:011d}" for i in range(1, n_prog + 1)]
            g = pd.DataFrame(np.vstack([P, prog]), index=ids, columns=markers)
            g.to_csv(gdir / f"{cluster}.{pop}_Imputed.csv", na_rep="NA")
            tested_years = [2006, 2007] if pop <= 4 else []   # pops 5-6 are the untested 2008 cohort
            effect = np.nanmean(prog[:, :40], axis=1) * 6
            for yr in tested_years:
                for loc in rng.choice(LOCS, 3, replace=False):
                    for i in range(n_prog):
                        pheno.append({
                            "YEAR": yr, "LOC": loc, "LINE_UNIQUE_ID": f"{cluster}.{pop}.{i + 1}",
                            "CLUSTER": int(cluster[1]), "YLD_BE": 165 + effect[i] + rng.normal(0, 12),
                            "MST": 18 + rng.normal(0, 1.5), "RTLP": abs(rng.normal(2, 2)),
                            "STLP": abs(rng.normal(5, 4)), "TWT": 56 + rng.normal(0, 1),
                        })
        pd.DataFrame(pheno).to_csv(BASE / f"{cluster}_Phenotype_Data_V2.csv", index=False)
    print(f"fixture written under {BASE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

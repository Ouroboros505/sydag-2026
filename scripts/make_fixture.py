#!/usr/bin/env python
"""Judge mode: write a synthetic breeding program in the exact layout of the Bayer legacy data,
so the whole pipeline runs end to end in about a minute without the 141 MB files.

    python scripts/make_fixture.py                       # -> data/raw/bayer_sample/
    python scripts/build_data.py --source bayer --judge  # pipeline on it, flagged synthetic

What it imitates, because the model depends on it:
  - two clusters, each with its own pool of inbred parents that recur across families,
    and the best new lines joining the pool (the breeding cycle)
  - biparental families, each tested in exactly one year at ~6 locations, crossed to one
    tester from a small tester set with its own main effect
  - progeny made of parental chromosome segments (a few crossovers per chromosome), so
    siblings differ by which parent they took each segment from
  - yield, moisture, relative maturity (linked to moisture), test weight, and lodging
    that is scored on only some plots and is mostly environment
Genetic signal is modest on purpose: plot noise dominates, as in the real data.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from analysis import data  # noqa: E402

YEARS = list(range(2003, 2009))
N_MARK, N_CHROM = 400, 10
FAMILIES_PER_YEAR = 8          # per cluster
LOCS = ["IAAM", "IAPR", "ILBM", "ILMN", "INVI", "MOBU", "NEDA", "NEYO", "OHPI", "MNOL", "WIMA", "KSMA"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(data.RAW / "bayer_sample"))
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()
    out = Path(args.out)
    rng = np.random.default_rng(args.seed)
    markers = [f"M{m:011d}" for m in sorted(rng.choice(10**9, N_MARK, replace=False))]
    chrom = np.repeat(np.arange(N_CHROM), N_MARK // N_CHROM)
    qtl_yield = np.where(rng.random(N_MARK) < 0.15, rng.normal(0, 1.2, N_MARK), 0.0)
    qtl_mat = np.where(rng.random(N_MARK) < 0.08, rng.normal(0, 0.6, N_MARK), 0.0)
    env_yield = {(y, l): rng.normal(0, 18) for y in YEARS for l in LOCS}
    env_mst = {(y, l): rng.normal(0, 2) for y in YEARS for l in LOCS}
    env_lodg = {(y, l): rng.gamma(1.2, 4) for y in YEARS for l in LOCS}
    lat = {l: rng.uniform(38, 44) for l in LOCS}
    lon = {l: rng.uniform(-97, -84) for l in LOCS}

    def child(p1: np.ndarray, p2: np.ndarray) -> np.ndarray:
        """A doubled-haploid-like line: each chromosome a mosaic of the two parents."""
        g = np.empty(N_MARK)
        for c in range(N_CHROM):
            idx = np.flatnonzero(chrom == c)
            cuts = np.sort(rng.choice(len(idx), rng.integers(0, 3), replace=False))
            src = rng.integers(0, 2)
            last = 0
            for cut in list(cuts) + [len(idx)]:
                g[idx[last:cut]] = (p1, p2)[src][idx[last:cut]]
                src, last = 1 - src, cut
        return g

    rows = []
    for cluster in ("C1", "C2"):
        gdir = out / f"Imputed{cluster}Populations" / f"ImputedPopulations{cluster}"
        gdir.mkdir(parents=True, exist_ok=True)
        freq = rng.uniform(0.2, 0.8, N_MARK)
        pool = {f"PID{rng.integers(10**5, 10**7)}": np.where(rng.random(N_MARK) < freq, 1.0, -1.0) for _ in range(30)}
        testers = {f"{rng.integers(10**5, 10**7)}": rng.normal(0, 2.5) for _ in range(6)}
        fam_no = 0
        for year in YEARS:
            best = []
            for _ in range(FAMILIES_PER_YEAR):
                fam_no += 1
                fam = f"{cluster}.{fam_no}"
                a, b = rng.choice(list(pool), 2, replace=False)
                tester = rng.choice(list(testers))
                n = int(rng.integers(40, 90))
                G = np.vstack([child(pool[a], pool[b]) for _ in range(n)])
                gv = G @ qtl_yield
                mat = G @ qtl_mat
                shown = G.copy()
                shown[rng.random(G.shape) < 0.01] = np.nan
                ids = [a, b] + [f"{i:011d}" for i in range(1, n + 1)]
                pd.DataFrame(np.vstack([pool[a], pool[b], shown]), index=ids, columns=markers).to_csv(
                    gdir / f"{fam}_Imputed.csv", na_rep="NA")
                gen = "BC" if rng.random() < 0.2 else "F2"
                for loc in rng.choice(LOCS, int(rng.integers(5, 8)), replace=False):
                    for i in range(n):
                        mst = 19 + 0.5 * mat[i] + env_mst[(year, loc)] + rng.normal(0, 1.2)
                        scored = rng.random() < 0.5
                        rows.append({
                            "YEAR_x": year, "LOC": loc, "LATITUDE": lat[loc], "LONGITUDE": lon[loc],
                            "LINE": i + 1, "ERM": 110 + 2 * mat[i] + rng.normal(0, 2),
                            "MST": round(mst, 1), "TWT": round(57 - 0.1 * mat[i] + rng.normal(0, 1), 1),
                            "YLD_BE": round(195 + env_yield[(year, loc)] + testers[tester] + gv[i]
                                            + 0.8 * mat[i] + rng.normal(0, 14), 2),
                            "RTLP": round(max(0.0, env_lodg[(year, loc)] + rng.normal(0, 3)), 1) if scored else np.nan,
                            "STLP": round(max(0.0, rng.gamma(1.1, 3)), 1) if scored else np.nan,
                            "CLUSTER": int(cluster[1]),
                            # the real C2 file carries a stray ".0" on its ids; keep the quirk
                            "LINE_UNIQUE_ID": f"{fam}.{i + 1}" + (".0" if cluster == "C2" else ""),
                            "GERMPLASM_ID_TESTER": float(tester), "CROSS": f"{a[3:]}/{b[3:]}",
                            "GENERATION_NAME": gen,
                        })
                best.append((gv.max(), G[np.argmax(gv)]))
            # the breeding cycle: the best new lines join the parent pool, the oldest retire
            for _, g in sorted(best, key=lambda x: -x[0])[:3]:
                pool[f"PID{rng.integers(10**7, 10**8)}"] = g
            for old in list(pool)[:3]:
                del pool[old]
    ph = pd.DataFrame(rows)
    for cluster in ("C1", "C2"):
        ph[ph["CLUSTER"] == int(cluster[1])].to_csv(out / f"{cluster}_Phenotype_Data_V2.csv", index=False)
    env = pd.DataFrame([{"YEAR": y, "LOC": l, "X07_PRCP": rng.gamma(3, 30), "X07_TAVG": rng.normal(24, 2)}
                        for y in YEARS for l in LOCS])
    env.to_csv(out / "environmental_features.csv", index=False)
    print(f"synthetic program written under {out}: {ph['LINE_UNIQUE_ID'].nunique():,} lines, "
          f"{len(ph):,} plots, {len(YEARS)} cohorts")


if __name__ == "__main__":
    main()

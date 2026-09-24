#!/usr/bin/env python
"""Analysis -> public/recommendations.json.

The app never computes what a script could precompute; it reads this file and applies the
user's prices on top. See src/lib/types.ts for the contract.

    npm run data                # or: python scripts/build_data.py
    python scripts/build_data.py --synthetic   # placeholder data, until the real set arrives

Until the challenge dataset is in data/raw/, this emits a clearly-flagged synthetic set
with the same shape as the target data: C1/C2 clusters, C{cluster}.{family}.{line} IDs,
yield in bu/ac, harvest moisture, lodging. The synthetic signal is deliberately weak
(forward-year r ~ 0.15) so the demo doesn't flatter the model. Spreads are calibrated
to the public Genomes to Fields data.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
sys.path.insert(0, str(ROOT))

PRICE_DEFAULTS = {
    "corn_price": 4.50,               # $/bu
    "drying_cost_per_point": 0.045,   # $/bu per point of moisture removed
    "target_moisture": 15.5,          # %
    "lodging_loss_fraction": 0.5,     # share of a lodged plant's yield that is lost
}


def synthetic(n: int = 2000, seed: int = 7) -> dict:
    rng = np.random.default_rng(seed)
    rows = []
    families = {}
    for cluster in ("C1", "C2"):
        n_fam = 60
        fam_mean = rng.normal(0, 6, n_fam)           # family-level breeding value, bu/ac
        fam_mst = rng.normal(0, 1.2, n_fam)          # family maturity shift -> moisture
        for f in range(n_fam):
            families[f"{cluster}.{f + 1}"] = (fam_mean[f], fam_mst[f])
    ids = list(families)
    for i in range(n):
        fam = ids[rng.integers(len(ids))]
        cluster = fam.split(".")[0]
        fmean, fmst = families[fam]
        line_no = int(rng.integers(1, 120))
        # Later-maturing material tends to yield more and dry slower: the trade-off that
        # makes a dollar ranking differ from a bushel ranking.
        maturity = rng.normal(0, 1)
        yld = 152 + fmean + 4.0 * maturity + rng.normal(0, 11)      # sd ~14 bu/ac, as in G2F
        mst = 18.7 + fmst + 0.5 * maturity + rng.normal(0, 0.7)      # sd ~1.3 pts, corr(y,m) ~ +0.15
        lodging = float(np.clip(rng.gamma(1.4, 7.2), 0, 60))         # mean ~10%, p90 ~21%, as in G2F
        conf = rng.choice(["high", "medium", "low"], p=[0.35, 0.45, 0.20])
        half = {"high": 9.0, "medium": 12.5, "low": 17.0}[conf]
        rows.append({
            "id": f"{fam}.{line_no:03d}",
            "group": cluster,
            "family": fam,
            "pred_yield": round(float(yld), 2),
            "lo": round(float(yld - half), 1),
            "hi": round(float(yld + half), 1),
            "pred_mst": round(float(np.clip(mst, 12, 26)), 2),
            "pred_lodging": round(lodging, 2),
            "confidence": str(conf),
            "pc1": round(float(fmean / 3 + rng.normal(0, 1)), 3),
            "pc2": round(float(fmst * 2 + rng.normal(0, 1)), 3),
        })
    # de-duplicate ids
    seen, out = set(), []
    for r in rows:
        if r["id"] in seen:
            continue
        seen.add(r["id"]); out.append(r)
    return {
        "meta": {
            "synthetic": True,
            "target": "YLD_BE",
            "unit": "bu/ac",
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "n_candidates": len(out),
            "notes": "Synthetic placeholder with the target data's shape. Replace by running the "
                     "real pipeline once the challenge dataset is in data/raw/.",
        },
        "price_defaults": PRICE_DEFAULTS,
        "candidates": out,
        "baselines": [
            {"name": "environmental mean", "metric": "r", "value": 0.02},
            {"name": "parent average (mid-parent)", "metric": "r", "value": 0.09},
            {"name": "ridge on markers (GBLUP-equivalent)", "metric": "r", "value": 0.15},
        ],
        "validation": {
            "scheme": "year-forward: train <= 2007, predict 2008 families never seen in training",
            "r": 0.15,
            "top20_recovery": 0.29,
            "n_test": len(out),
            "traits": {"yield": 0.15, "moisture": 0.30, "lodging": 0.10},
        },
    }


def real(source: str = "g2f") -> dict:
    """Run the pipeline on a dataset adapter. Every adapter provides hybrids() and markers();
    adapters for family-structured data (parents genotyped) also enable the two-stage model."""
    import numpy as np
    import pandas as pd
    from analysis import data, model

    if source == "g2f":
        from analysis import g2f as src
        if not (data.RAW / "g2f/Training_data").exists():
            raise SystemExit(
                "No data under data/raw/g2f/. Either\n"
                "  bash scripts/get_g2f.sh                     # public stand-in, ~80 MB\n"
                "  python scripts/build_data.py --synthetic   # placeholder with the same shape"
            )
        h = src.hybrids()
        cand = src.candidates_2024()
        M = src.markers()
        parents = None
    elif source == "bayer":
        from analysis import bayer as src
        h = src.hybrids()
        cand = src.candidates(h)
        M = src.markers(keep=h.index.union(cand.index))
        parents = src._parents()
    else:
        raise SystemExit(f"unknown source {source!r}")

    h = h[h.index.isin(M.index)]
    cand = cand[cand.index.isin(M.index)]
    test_year = int(h.first_year.max())
    alpha = model.pick_alpha(M.loc[h.index], h["yield_adj"])

    # forward validation: single-stage always; two-stage too when parents are genotyped
    val = model.year_forward(h, M, "yield_adj", test_year=test_year, alpha=alpha)
    per_trait = {lab: model.year_forward(h, M, t, test_year=test_year, alpha=alpha).r
                 for lab, t in (("moisture", "mst_adj"), ("lodging", "lodging"))}
    two_stage_r = None
    if parents is not None and "population" in h.columns:
        Mp = src.parent_markers(M.columns)
        tr, te = h[h.first_year < test_year], h[h.first_year == test_year]
        f = model.fit(M.loc[tr.index], tr["yield_adj"], alpha)
        pred = model.two_stage(f, M.loc[te.index], te["population"], Mp, parents)
        two_stage_r = float(np.corrcoef(pred, te["yield_adj"])[0, 1]) if len(te) > 5 else None

    fits = {t: model.fit(M.loc[h.index], h[t], alpha) for t in ("yield_adj", "mst_adj", "lodging")}
    Mc = M.loc[cand.index]
    fam = cand["population"] if "population" in cand.columns else pd.Series(cand.index, index=cand.index)
    if parents is not None:
        Mp = src.parent_markers(M.columns)
        yld = model.two_stage(fits["yield_adj"], Mc, fam, Mp, parents)
    else:
        yld = fits["yield_adj"].predict(Mc)
    yld = yld + h.attrs["mean_yield_bu"]
    mst = fits["mst_adj"].predict(Mc) + h.attrs["mean_mst"]
    lodg = np.clip(fits["lodging"].predict(Mc), 0, None)
    tier = model.relatedness_tier(M.loc[h.index], Mc)
    pcs = model.genomic_pcs(M.loc[h.index.union(cand.index)], cand.index)
    half = 1.645 * val.rmse

    rows = []
    for i, cid in enumerate(cand.index):
        rows.append({
            "id": str(cid), "group": str(cand.parent2.get(cid, "")), "family": str(fam[cid]),
            "pred_yield": round(float(yld[i]), 2),
            "lo": round(float(yld[i] - half), 1), "hi": round(float(yld[i] + half), 1),
            "pred_mst": round(float(mst[i]), 2), "pred_lodging": round(float(lodg[i]), 2),
            "confidence": str(tier[cid]),
            "pc1": round(float(pcs.pc1[cid]), 3), "pc2": round(float(pcs.pc2[cid]), 3),
        })

    # relatives baseline on the same forward split
    tr, te = h[h.first_year < test_year], h[h.first_year == test_year]
    pcols = [c for c in ("parent1", "parent2") if c in h.columns]
    def rel_mean(row):
        ps = [row[c] for c in pcols]
        rel = tr[tr[pcols].isin(ps).any(axis=1)] if pcols else tr.iloc[:0]
        return rel.yield_adj.mean() if len(rel) else np.nan
    pm = te.apply(rel_mean, axis=1); ok = pm.notna()
    r_rel = float(np.corrcoef(pm[ok], te.yield_adj[ok])[0, 1]) if ok.sum() > 10 else float("nan")

    baselines = [
        {"name": "environmental mean (no genetics)", "metric": "r", "value": 0.0},
        {"name": "mean of relatives sharing a parent", "metric": "r", "value": round(r_rel, 3)},
        {"name": "ridge on markers (GBLUP-equivalent)", "metric": "r", "value": round(val.r, 3)},
    ]
    if two_stage_r is not None:
        baselines.append({"name": "two-stage: parents -> family, markers -> line", "metric": "r", "value": round(two_stage_r, 3)})
    baselines.append({"name": "same model, random k-fold (leaky)", "metric": "r", "value": round(val.leaky_r, 3)})
    baselines = [b for b in baselines if np.isfinite(b["value"])]   # NaN is not valid JSON

    return {
        "meta": {
            "synthetic": False, "target": "yield (bu/ac, environment-adjusted)", "unit": "bu/ac",
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "n_candidates": len(rows),
            "notes": f"Source: {source}. {len(h):,} lines with field records, {M.shape[1]:,} markers, "
                     f"ridge alpha={alpha}; {fam.nunique()} families among the candidates.",
        },
        "price_defaults": PRICE_DEFAULTS,
        "candidates": rows,
        "baselines": baselines,
        "validation": {
            "scheme": val.scheme, "r": round(val.r, 3), "top20_recovery": round(val.top20, 3),
            "n_test": val.n_test,
            "traits": {"yield": round(val.r, 3), **{k: round(v, 3) for k, v in per_trait.items()}},
        },
    }


def write(payload: dict, name: str = "recommendations.json") -> Path:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    out = PUBLIC / name
    out.write_text(json.dumps(payload, separators=(",", ":"), allow_nan=False))
    print(f"{out.relative_to(ROOT)}  {out.stat().st_size / 1024:.0f} KB  "
          f"{payload['meta']['n_candidates']:,} candidates  synthetic={payload['meta']['synthetic']}")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--synthetic", action="store_true", help="emit placeholder data")
    ap.add_argument("--source", default="g2f", choices=["g2f", "bayer"], help="dataset adapter")
    ap.add_argument("--n", type=int, default=2000)
    args = ap.parse_args()
    write(synthetic(args.n) if args.synthetic else real(args.source))


if __name__ == "__main__":
    main()

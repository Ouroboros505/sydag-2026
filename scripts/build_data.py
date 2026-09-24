#!/usr/bin/env python
"""Analysis -> public/recommendations.json.

The app never computes what a script could precompute; it reads this file and applies the
user's prices on top. See src/lib/types.ts for the contract.

    npm run data                # or: python scripts/build_data.py
    python scripts/build_data.py --synthetic   # placeholder data, until the real set arrives

Until the challenge dataset is in data/raw/, this emits a clearly-flagged synthetic set
with the same shape as the target data: C1/C2 clusters, C{cluster}.{family}.{line} IDs,
yield in bu/ac, harvest moisture, lodging. The synthetic signal is deliberately weak
(forward-year r ~ 0.15) so the demo doesn't flatter the model.
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
        yld = 168 + fmean + 4.5 * maturity + rng.normal(0, 7)
        mst = 16.8 + fmst + 1.6 * maturity + rng.normal(0, 0.9)
        lodging = float(np.clip(rng.gamma(1.6, 1.8), 0, 30))
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
        },
    }


def real() -> dict:
    """Wire the real pipeline here once data/raw/ has the challenge files:
    load C1/C2 phenotypes + markers via analysis.data, fit the baseline and the model,
    predict the candidate cohort, and return the same dict shape as synthetic()."""
    raise SystemExit("Real pipeline not wired yet — run with --synthetic, or add the data and implement real().")


def write(payload: dict, name: str = "recommendations.json") -> Path:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    out = PUBLIC / name
    out.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"{out.relative_to(ROOT)}  {out.stat().st_size / 1024:.0f} KB  "
          f"{payload['meta']['n_candidates']:,} candidates  synthetic={payload['meta']['synthetic']}")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--synthetic", action="store_true", help="emit placeholder data")
    ap.add_argument("--n", type=int, default=2000)
    args = ap.parse_args()
    write(synthetic(args.n) if args.synthetic else real())


if __name__ == "__main__":
    main()

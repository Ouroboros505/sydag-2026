#!/usr/bin/env python
"""The recommendation as a file: which lines to plant, at the recommended settings.

    python scripts/export_list.py            # -> docs/advance_2008.csv (after build_data.py)
    python scripts/export_list.py --share 0.3 --cap 50   # with a family limit

Same arithmetic as the app (src/lib/econ.ts) at the default prices: rank by predicted $/acre
(optionally at most `cap` lines per family) until `share` of the cohort has a plot. The default is
no family limit: across six forward seasons that ranking realised the most (see README). Only what was known in
January is written; the cohort's real results stay in the app's backtest.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]


def margin(c: pd.DataFrame, p: dict) -> pd.Series:
    y = c["pred_yield"]
    return (y * p["corn_price"] - (c["pred_mst"] - p["target_moisture"]).clip(lower=0) * p["drying_cost_per_point"] * y
            - c["pred_lodging"] / 100 * p["lodging_loss_fraction"] * y * p["corn_price"])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--share", type=float, default=0.3, help="share of the cohort that gets a plot")
    ap.add_argument("--cap", type=int, default=0, help="most lines from one family (0 = no limit)")
    args = ap.parse_args()
    rec = json.loads((ROOT / "public" / "recommendations.json").read_text())
    c = pd.DataFrame(rec["candidates"])
    c["usd_per_acre"] = margin(c, rec["price_defaults"]).round(2)
    c = c.sort_values("usd_per_acre", ascending=False)
    c["rank_in_family"] = c.groupby("family").cumcount() + 1
    k = round(args.share * len(c))
    pick = (c[c["rank_in_family"] <= args.cap] if args.cap else c).head(k).copy()
    pick.insert(0, "rank", range(1, len(pick) + 1))
    cols = ["rank", "id", "group", "family", "tester", "usd_per_acre", "pred_yield", "lo", "hi", "pred_mst",
            "pred_erm", "pred_lodging", "confidence"]
    out = pick[[x for x in cols if x in pick.columns]].rename(columns={
        "id": "line", "group": "cluster", "pred_yield": "pred_yield_bu_ac", "lo": "lo90", "hi": "hi90",
        "pred_mst": "pred_moisture_pct", "pred_erm": "pred_rel_maturity_d", "pred_lodging": "pred_lodging_pct"})
    year = rec["meta"].get("held_out_year", "")
    path = ROOT / "docs" / f"advance_{year}.csv"
    out.to_csv(path, index=False)
    fam = out["family"].value_counts()
    print(f"{path.relative_to(ROOT)}: {len(out):,} of {len(c):,} lines, {fam.size} families "
          f"(largest {fam.iloc[0]}), {out['cluster'].value_counts().to_dict()}")


if __name__ == "__main__":
    main()

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
import time
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
        h = h[h.index.isin(M.index)]
        test_year = int(h.first_year.max())
        h_train = h
        name = "Genomes to Fields"
    elif source == "custom":
        # any program's files, described by data/raw/custom/layout.json (see analysis/custom.py)
        from analysis import custom as src
        h = src.hybrids()
        M = src.markers()
        parents = None
        h = h[h.index.isin(M.index)]
        cand, held = src.candidates(h, M)
        test_year = int(h.first_year.max())
        h_train = h[h.first_year < test_year] if held else h
        name = src.layout().get("name", "Your program")
    else:
        raise SystemExit(f"unknown source {source!r}")

    cand = cand[cand.index.isin(M.index)]
    mean_yield, mean_mst = h.attrs["mean_yield_bu"], h.attrs["mean_mst"]
    t0 = time.time()
    alpha = model.pick_alpha(M.loc[h_train.index], h_train["yield_adj"])
    print(f"[{time.time() - t0:5.0f}s] alpha={alpha}")

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
    print(f"[{time.time() - t0:5.0f}s] forward r={val.r:.3f} (leaky {val.leaky_r:.3f}); traits {per_trait}; two-stage {two_stage_r}")

    # lodging is scored on a minority of plots: each trait trains on the lines that have it
    fits = {}
    for t in ("yield_adj", "mst_adj", "lodging"):
        has = h_train[t].notna()
        fits[t] = model.fit(M.loc[h_train.index[has]], h_train[t][has], alpha)
    Mc = M.loc[cand.index]
    fam = cand["population"] if "population" in cand.columns else pd.Series(cand.index, index=cand.index)
    if parents is not None:
        Mp = src.parent_markers(M.columns)
        yld = model.two_stage(fits["yield_adj"], Mc, fam, Mp, parents)
    else:
        yld = fits["yield_adj"].predict(Mc)
    yld = yld + mean_yield
    mst = fits["mst_adj"].predict(Mc) + mean_mst
    lodg = np.clip(fits["lodging"].predict(Mc), 0, None)
    tier = model.relatedness_tier(M.loc[h_train.index], Mc)
    pcs = model.genomic_pcs(M.loc[h_train.index.union(cand.index)], cand.index)
    half = 1.645 * val.rmse
    print(f"[{time.time() - t0:5.0f}s] {len(cand):,} candidates scored")

    group = cand["tester"] if "tester" in cand.columns else cand.get("parent2", pd.Series("", index=cand.index))
    held_out = "yield_adj" in cand.columns   # the cohort has real results: keep them for the backtest
    rows = []
    for i, cid in enumerate(cand.index):
        row = {
            "id": str(cid), "group": str(group.get(cid, "")), "family": str(fam[cid]),
            "pred_yield": round(float(yld[i]), 2),
            "lo": round(float(yld[i] - half), 1), "hi": round(float(yld[i] + half), 1),
            "pred_mst": round(float(mst[i]), 2), "pred_lodging": round(float(lodg[i]), 2),
            "confidence": str(tier[cid]),
            "pc1": round(float(pcs.pc1[cid]), 3), "pc2": round(float(pcs.pc2[cid]), 3),
        }
        if held_out:
            row["actual_yield"] = round(float(cand.yield_adj[cid] + mean_yield), 2)
            if np.isfinite(cand.mst_adj[cid]):
                row["actual_mst"] = round(float(cand.mst_adj[cid] + mean_mst), 2)
            if np.isfinite(cand.lodging[cid]):
                row["actual_lodging"] = round(float(cand.lodging[cid]), 2)
        rows.append(row)

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
            "notes": f"Source: {source}. {len(h_train):,} lines with field records ({h_train.first_year.min()}-"
                     f"{h_train.first_year.max()}), {M.shape[1]:,} markers, ridge alpha={alpha}; "
                     f"{fam.nunique()} families among the candidates"
                     + (f", the {test_year} cohort, ranked before its field results and scored against them."
                        if held_out else "."),
            "held_out_year": test_year if held_out else None,
            "dataset": f"{name}, {int(h.first_year.min())} to {test_year}",
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


TRAITS = {"yield_adj": "yield", "mst_adj": "moisture", "erm_adj": "maturity", "lodging_adj": "lodging"}
# the cohorts the model's settings (ridge penalties, recency) were chosen on; later ones are held out
TUNED_ON = [2005, 2006, 2007]
# disclosure: 2008's score with the first model, frozen before 2008 was ever scored (README, section 3)
FIRST_FROZEN_R = 0.120


def real_bayer(synthetic: bool = False) -> dict:
    """The Bayer legacy data. The newest cohort is ranked blind, exactly as it stood in January of
    that year: every one of its families is new, and nothing from that year is used in training.
    Its field results come back only to score the ranking (the backtest the app shows)."""
    import numpy as np
    import pandas as pd
    from analysis import bayer as src, model

    t0 = time.time()
    say = lambda *a: print(f"[{time.time() - t0:5.0f}s]", *a, flush=True)  # noqa: E731
    h = src.hybrids()
    X, meta = src._genotype_cache()
    pos = {i: k for k, i in enumerate(meta["ids"])}
    h = h[[i in pos for i in h.index]]
    h = h.iloc[np.argsort(h["family"].to_numpy(), kind="stable")]   # rows grouped by family, once
    say(f"{len(h):,} genotyped lines with field records, cohorts {h.first_year.min()}-{h.first_year.max()}")
    Xl = np.asarray(X[[pos[i] for i in h.index]], dtype=np.float32)
    fd = model.family_data(h, Xl, src.parent_markers(), list(TRAITS))
    del Xl
    cohort = int(fd.year.max())
    years = sorted(int(y) for y in np.unique(fd.year))
    eval_years = [y for y in years if y > years[0] + 2][-6:]      # at least three cohorts to learn from
    dev_years = [y for y in eval_years if y != cohort]
    say(f"{len(fd.families)} families; forward-validating {eval_years}, the headline is {cohort}")

    # forward validation, every trait, every evaluation year
    fwd = {t: {y: model.predict_cohort(fd, t, y) for y in eval_years} for t in TRAITS}
    # moisture, maturity and lodging came out over-spread between families on the development
    # years: rescale their two parts to the spread those years actually showed. Yield is left
    # alone: rescaling it did not help ranking there, and its between-family slope is unstable.
    def slope(x, y):
        ok = np.isfinite(x) & np.isfinite(y)
        x, y = x[ok] - x[ok].mean(), y[ok] - y[ok].mean()
        return float((x * y).sum() / (x * x).sum()) if (x * x).sum() > 0 else 1.0
    slopes = {"yield_adj": (1.0, 1.0)}
    for t in [t for t in TRAITS if t != "yield_adj"]:
        sb = np.mean([slope(fwd[t][y].between, fwd[t][y].truth) for y in dev_years])
        sw = np.mean([slope(fwd[t][y].within, fwd[t][y].truth - fwd[t][y].between) for y in dev_years])
        slopes[t] = (float(np.clip(sb, 0, 1.5)), float(np.clip(sw, 0, 2.0)))
        fwd[t] = {y: model.predict_cohort(fd, t, y, slope_between=slopes[t][0], slope_within=slopes[t][1]) for y in eval_years}
    met = {t: {y: model.cohort_metrics(fwd[t][y], fd, t) for y in eval_years} for t in TRAITS}
    by_year = []
    for y in eval_years:
        cp = fwd["yield_adj"][y]
        g = model.global_ridge_cohort(fd, "yield_adj", y)
        pb = model.pedigree_cohort(fd, "yield_adj", y)
        m = met["yield_adj"][y]
        by_year.append({
            "year": y, "r": round(m["r"], 3), "r_between": round(m["r_between"], 3), "r_within": round(m["r_within"], 3),
            "top20": round(m["top20"], 3), "n_lines": m["n_lines"], "n_families": m["n_families"],
            "r_gblup": round(model._r(g, cp.truth), 3), "r_pedigree": round(model._r(pb, cp.truth), 3),
            "r_as_planted": round(m["r_as_planted"], 3), "r_gblup_as_planted": round(model._r(g, cp.raw), 3),
            # the structure behind the family call: how many of this year's families had 0/1/2 parents on record
            **{f"families_{lab}": int((model.known_parents(fd, y)[np.unique(cp.fam_index)] == c).sum())
               for lab, c in (("none", 0), ("one", 1), ("both", 2))},
        })
        say(f"{y}: ours r={m['r']:.3f} (between {m['r_between']:.3f}, within {m['r_within']:.3f}) | "
            f"standard GBLUP {by_year[-1]['r_gblup']:.3f} | pedigree BLUP {by_year[-1]['r_pedigree']:.3f} | "
            f"as planted: ours {m['r_as_planted']:.3f}, GBLUP {by_year[-1]['r_gblup_as_planted']:.3f}")
    head = met["yield_adj"][cohort]

    # how sure: resample the cohort's families (the unit that was sampled), 2,000 times
    cp_ = fwd["yield_adj"][cohort]
    g_ = model.global_ridge_cohort(fd, "yield_adj", cohort)
    ok_ = np.isfinite(cp_.truth)
    fam_rows = [np.flatnonzero((cp_.fam_index == k) & ok_) for k in np.unique(cp_.fam_index)]
    rng_ = np.random.default_rng(7)
    boot = []
    for _ in range(2000):
        idx = np.concatenate([fam_rows[i] for i in rng_.integers(0, len(fam_rows), len(fam_rows))])
        a_ = np.corrcoef(cp_.pred[idx], cp_.truth[idx])[0, 1]
        b_ = np.corrcoef(g_[idx], cp_.truth[idx])[0, 1]
        boot.append((a_, a_ - b_))
    boot = np.array(boot)
    r_ci = [float(np.quantile(boot[:, 0], q)) for q in (0.025, 0.975)]
    d_ci = [float(np.quantile(boot[:, 1], q)) for q in (0.025, 0.975)]
    wins = sum(1 for y in eval_years if met["yield_adj"][y]["r"] > model._r(model.global_ridge_cohort(fd, "yield_adj", y), fwd["yield_adj"][y].truth))
    say(f"{cohort}: r 95% CI {r_ci[0]:.3f}-{r_ci[1]:.3f}; ours minus standard GBLUP 95% CI {d_ci[0]:.3f}-{d_ci[1]:.3f} "
        f"(families resampled); beats it in {wins} of {len(eval_years)} seasons")

    # uncertainty: forward residuals on the development years, by how many parents are on record
    kp = {y: model.known_parents(fd, y) for y in eval_years}
    sd = {}
    for c in (0, 1, 2):
        res = np.concatenate([(fwd["yield_adj"][y].truth - fwd["yield_adj"][y].pred)[kp[y][fwd["yield_adj"][y].fam_index] == c]
                              for y in dev_years])
        res = res[np.isfinite(res)]
        sd[c] = float(np.std(res)) if len(res) > 50 else float("nan")
    fallback = float(np.nanmax(list(sd.values())))
    sd = {c: (v if np.isfinite(v) else fallback) for c, v in sd.items()}
    cp = fwd["yield_adj"][cohort]
    cls = kp[cohort][cp.fam_index]
    half = 1.645 * np.array([sd[c] for c in cls])
    ok = np.isfinite(cp.truth)
    coverage = float(np.mean(np.abs(cp.truth[ok] - cp.pred[ok]) <= half[ok]))
    by_conf = {c: model._r(cp.pred[cls == c], cp.truth[cls == c]) for c in (0, 1, 2)}
    say(f"90% bands: sd by parents on record {sd}; coverage in {cohort}: {coverage:.3f}; r by class {by_conf}")

    # the leaky number: random 5-fold inside the cohort, so siblings sit in training
    rng = np.random.default_rng(1)
    fold = rng.integers(0, 5, len(cp.truth))
    leak = np.full(len(cp.truth), np.nan)
    for f in range(5):
        tr = (fold != f) & ok
        for k in np.unique(cp.fam_index):
            m = cp.fam_index == k
            if (m & tr).any():
                leak[m & (fold == f)] = np.nanmean(cp.truth[m & tr]) + cp.within[m & (fold == f)]
    leaky_r = model._r(leak, cp.truth)

    # how much of a line's record is repeatable at all: the ceiling on any predictor
    p = src.plots()
    p = p[p["year"] == cohort].dropna(subset=["yield_bu"])
    p = p.assign(adj=p["yield_bu"] - p.groupby("env")["yield_bu"].transform("mean"))
    g = p.groupby("id")["adj"]
    n_i, v_i = g.count(), g.var()
    s2e = float(v_i[n_i > 1].mean())
    s2m = float(g.mean()[n_i > 1].var())
    H = max(0.0, (s2m - s2e * float((1 / n_i[n_i > 1]).mean())) / s2m)
    say(f"line-mean repeatability {H:.2f} -> ceiling r ~ {np.sqrt(H):.2f}; plot noise sd {np.sqrt(s2e):.1f} vs line sd {np.sqrt(max(s2m - s2e / n_i.mean(), 0)):.1f} bu")

    # the test network: where the plots are, each site's climate and soil, and how consistently it
    # ranked lines in earlier years (a weak signal: see the persistence number)
    rel = model.trial_reliability(src.plots())
    def site_mean(d):
        return d.groupby("location").apply(lambda z: pd.Series({
            "r": float(np.average(z["r"], weights=z["n"])), "trials": int(len(z)), "plots": int(z["n"].sum()),
            "level": float(z["trial_mean"].mean())}), include_groups=False)
    past_s, now_s = site_mean(rel[rel["year"] < cohort]), site_mean(rel[rel["year"] == cohort])
    both = past_s.index.intersection(now_s.index)
    persistence = float(np.corrcoef(past_s.loc[both, "r"], now_s.loc[both, "r"])[0, 1]) if len(both) > 10 else float("nan")
    env = src.environments()
    env = env[env["YEAR"] < cohort].copy()
    env["rain"] = env[["X06_PRCP", "X07_PRCP", "X08_PRCP"]].sum(axis=1)
    clim = env.groupby("LOC").agg(rain=("rain", "mean"), heat=("X07_TAVG", "mean"), clay=("clay_0_5cm", "mean"),
                                  sand=("sand_0_5cm", "mean"))
    pl = src.plots()
    coords = pl.dropna(subset=["lat", "lon"]).groupby("location")[["lat", "lon"]].first()
    used = set(pl.loc[pl["year"] == cohort, "location"])
    locations = []
    for loc in sorted(set(past_s.index) | used):
        if loc not in coords.index:
            continue
        row = {"loc": str(loc), "lat": round(float(coords.loc[loc, "lat"]), 2), "lon": round(float(coords.loc[loc, "lon"]), 2),
               "used": loc in used}
        if loc in past_s.index:
            row.update({"r": round(float(past_s.loc[loc, "r"]), 3), "trials": int(past_s.loc[loc, "trials"]),
                        "level": round(float(past_s.loc[loc, "level"]), 1)})
        if loc in clim.index and np.isfinite(clim.loc[loc, "rain"]):
            row.update({"rain": round(float(clim.loc[loc, "rain"]), 0), "heat": round(float(clim.loc[loc, "heat"]), 1),
                        "clay": round(float(clim.loc[loc, "clay"]) / 10, 1), "sand": round(float(clim.loc[loc, "sand"]) / 10, 1)})
        locations.append(row)
    say(f"test network: {len(locations)} locations, {len(used)} used in {cohort}; site reliability persists at r {persistence:.2f}")
    family_sites = {str(f): sorted(map(str, g.dropna().unique())) for f, g in pl[pl["year"] == cohort].groupby("family")["location"]}

    # broad-acre or location-specific: is a line's response across locations predictable at all?
    loc = model.location_response_check(fd, src.plots(), cohort)
    say(f"location-specific response predicted at r {loc['oracle']:.3f} even knowing each trial's productivity, "
        f"{loc['history']:.3f} from locations' history ({loc['n_plots']:,} plots)")
    # weather and soil: can parent DNA x a trial's weather and soil say which family does better where?
    clim = model.family_climate_check(fd, src.plots(), src.environments(), eval_years)
    say(f"weather and soil x parent DNA, which family does better where: forward r {clim['r_typical']:.3f} "
        f"from locations' usual weather, {clim['r_actual']:.3f} even with the season's real weather; by year {clim['by_year_typical']}; "
        f"the interaction itself repeats inside a season at r {clim['split_half']:.2f} (two halves of each family)")
    # the textbook joint fit of trials and families, and why we compare families with their field-mates instead
    jt = model.joint_trial_check(fd, src.plots(), eval_years)
    say(f"joint trial fit: agrees with field-mate comparison at r {jt['r_near_joint']:.2f}; follows test-site latitude "
        f"{jt['lat_corr_joint']:+.2f} (field-mates {jt['lat_corr_near']:+.2f}); DNA predicts a family's test latitude at r "
        f"{np.mean(jt['dna_predicts_site']):.2f}; family call from DNA, forward: field-mates {np.mean(jt['fwd_near']):.3f}, "
        f"joint {np.mean(jt['fwd_joint']):.3f}, joint with location removed {np.mean(jt['fwd_joint_site']):.3f}")

    # genomic map: top two components, fitted on a sample of past lines, applied to the cohort
    past = fd.rows(np.flatnonzero(fd.year < cohort))
    samp = rng.choice(past, min(20000, len(past)), replace=False)
    Z = fd.X[samp]
    mu, s = Z.mean(0), Z.std(0) + 1e-6
    Zs = (Z - mu) / s
    _, V = np.linalg.eigh(Zs.T @ Zs)
    V = V[:, ::-1][:, :2]
    pcs = ((fd.X[cp.rows] - mu) / s) @ V

    means = {"yield_adj": h.attrs["mean_yield_bu"], "mst_adj": h.attrs["mean_mst"], "erm_adj": h.attrs["mean_erm"],
             "lodging_adj": h.attrs["mean_lodging"]}
    # the benchmark engine: standard GBLUP, one ridge over every earlier line, same traits
    gb = {t: model.global_ridge_cohort(fd, t, cohort) for t in ("yield_adj", "mst_adj", "lodging_adj")}
    gres = np.concatenate([fwd["yield_adj"][y].truth - model.global_ridge_cohort(fd, "yield_adj", y) for y in dev_years])
    g_half = 1.645 * float(np.nanstd(gres))
    g_ok = np.isfinite(cp.truth)
    g_cov = float(np.mean(np.abs(cp.truth[g_ok] - gb["yield_adj"][g_ok]) <= g_half))
    say(f"benchmark engine: 90% band +-{g_half:.1f} bu, coverage in {cohort} {g_cov:.3f}")
    pr = {t: fwd[t][cohort] for t in TRAITS}
    conf = np.array(["low", "medium", "high"])[cls]
    fams = fd.families[cp.fam_index]
    rows = []
    for i, r_ in enumerate(cp.rows):
        yv = means["yield_adj"] + pr["yield_adj"].pred[i]
        row = {
            "id": str(fd.ids[r_]), "group": str(fd.cluster[cp.fam_index[i]]), "family": str(fams[i]),
            "tester": str(fd.tester[cp.fam_index[i]]),
            "pred_yield": round(float(yv), 1), "lo": round(float(yv - half[i]), 1), "hi": round(float(yv + half[i]), 1),
            "pred_mst": round(float(means["mst_adj"] + pr["mst_adj"].pred[i]), 2),
            "pred_lodging": round(float(max(0.0, means["lodging_adj"] + pr["lodging_adj"].pred[i])), 2),
            "pred_erm": round(float(means["erm_adj"] + pr["erm_adj"].pred[i]), 1),
            "confidence": str(conf[i]),
            "pc1": round(float(pcs[i, 0]), 2), "pc2": round(float(pcs[i, 1]), 2),
            # benchmark engine predictions (yield, moisture, lodging), so the app can switch engines
            "gy": round(float(means["yield_adj"] + gb["yield_adj"][i]), 1),
            "gm": round(float(means["mst_adj"] + gb["mst_adj"][i]), 2),
            "gl": round(float(max(0.0, means["lodging_adj"] + gb["lodging_adj"][i])), 2),
        }
        for t, key in (("yield_adj", "actual_yield"), ("mst_adj", "actual_mst"), ("erm_adj", "actual_erm"),
                       ("lodging_adj", "actual_lodging")):
            v = pr[t].truth[i]
            if np.isfinite(v):
                row[key] = round(float(max(0.0, means[t] + v) if t == "lodging_adj" else means[t] + v), 1 if t != "mst_adj" else 2)
        rows.append(row)

    # every plot of the held-out season, so the app can score any plan site by site: the chosen lines
    # against the lines left out, in the same fields. Values are relative to each plot's own trial.
    ix = {r_["id"]: i for i, r_ in enumerate(rows)}
    site_ix = {l_["loc"]: k for k, l_ in enumerate(locations)}
    q = pl[(pl["year"] == cohort) & pl["yield_bu"].notna() & pl["id"].isin(ix.keys()) & pl["location"].isin(site_ix.keys())].copy()
    for col in ("yield_bu", "mst", "lodging"):
        q[col] = q[col] - q.groupby("env")[col].transform("mean")
    season_plots = {
        "line": q["id"].map(ix).astype(int).tolist(), "site": q["location"].map(site_ix).astype(int).tolist(),
        "y10": (q["yield_bu"] * 10).round().astype(int).tolist(),                     # bu/ac x 10
        "m100": (q["mst"].fillna(0) * 100).round().astype(int).tolist(),              # moisture points x 100
        "l10": (q["lodging"].fillna(0) * 10).round().astype(int).tolist(),            # lodging % x 10; unscored = trial average
        "means": {"yield": round(float(means["yield_adj"]), 2), "mst": round(float(means["mst_adj"]), 3),
                  "lodging": round(float(means["lodging_adj"]), 3)},
    }
    say(f"{cohort} plots for the site-by-site check: {len(q):,} at {q['location'].nunique()} sites")

    strategies, match = strategy_backtest(fd, fwd, eval_years, means, model)
    lines: dict = {}
    # the app opens at 30% of the lines, rounded to its slider's step of 10: score exactly that share too
    k0 = min(round(len(rows) * 0.3 / 10) * 10, len(rows))
    budgets = tuple(sorted({round(0.05 * i, 2) for i in range(1, 20)} | {k0 / len(rows)}))
    value = engine_value(fd, fwd, eval_years, means, model, budgets=budgets, lines=lines)
    # every graded line, so the opening chart can be redone at the user's prices (loaded after the page)
    out_lines = PUBLIC / "season_lines.json"
    scale = {"py": 1000, "pm": 1000, "pl": 1000, "gy": 1000, "gm": 1000, "gl": 1000, "ry": 100, "rm": 1000, "rl": 100}
    out_lines.write_text(json.dumps({"scale": scale, **lines}, separators=(",", ":")))
    say(f"season lines for the app: {len(lines.get('year', [])):,} lines, {out_lines.stat().st_size / 1024:.0f} KB")
    for m_ in match:
        say(f"{m_['year']}: ProMaize at 30% keeps {m_['ours_kept']:.0%} of the real top 10%; standard GBLUP needs "
            f"{m_['standard_needs']:.0%} of lines for that ({m_['lines_saved']:,} more lines)")
    for row in strategies:
        if row["year"] == "mean":
            say(f"strategy @{row['budget']:.0%}: {row['strategy']:<34s} gain ${row['gain']:6.2f}/ac  "
                f"top10 kept {row['top10_kept']:.2f}  families {row['eff_families']:5.1f}  maturity {row['maturity_shift']:+.2f} d")

    baselines = [
        {"name": "environmental means (no genetics)", "metric": "r", "value": 0.0},
        {"name": "pedigree BLUP: parents' earlier families, no markers", "metric": "r", "value": by_year[-1]["r_pedigree"]},
        {"name": "standard GBLUP: one ridge over all lines", "metric": "r", "value": by_year[-1]["r_gblup"]},
        {"name": "ProMaize: family genotype -> family mean, sibling model -> line", "metric": "r", "value": round(head["r"], 3)},
        {"name": "random k-fold, siblings in training (leaky, for contrast)", "metric": "r", "value": round(leaky_r, 3)},
    ]
    n_new = int((kp[cohort][np.unique(cp.fam_index)] == 0).sum())
    return {
        "meta": {
            "synthetic": synthetic, "target": "testcross yield, trial- and tester-adjusted (GCA), bu/ac", "unit": "bu/ac",
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "n_candidates": len(rows), "held_out_year": cohort,
            "notes": f"Bayer legacy data: {int((fd.year < cohort).sum())} families ({years[0]}-{cohort - 1}) to learn from, "
                     f"{head['n_families']} new families in {cohort}, {n_new} of them with neither parent on record. "
                     f"{fd.X.shape[1]:,} markers. Lodging is barely predictable from DNA here "
                     f"(forward r {round(met['lodging_adj'][cohort]['r'], 2):.2f}), so it moves the $/acre ranking little.",
        },
        "price_defaults": PRICE_DEFAULTS,
        "candidates": rows,
        "locations": locations,
        "family_sites": family_sites,
        "season_plots": season_plots,
        "baselines": baselines,
        "validation": {
            "scheme": f"year-forward: every {cohort} family predicted from {years[0]}-{cohort - 1} only, none of them seen before",
            "r": round(head["r"], 3), "top20_recovery": round(head["top20"], 3), "n_test": head["n_lines"],
            "traits": {TRAITS[t]: round(met[t][cohort]["r"], 3) for t in TRAITS},
            "r_between": round(head["r_between"], 3), "r_within": round(head["r_within"], 3),
            "r_as_planted": round(head["r_as_planted"], 3),
            "by_year": by_year, "coverage90": round(coverage, 3), "ceiling": round(float(np.sqrt(H)), 3),
            "tuned_on": TUNED_ON,
            "r_ci95": [round(x, 3) for x in r_ci], "vs_gblup_ci95": [round(x, 3) for x in d_ci],
            "seasons_won": wins, "seasons": len(eval_years),
            "first_frozen_r": FIRST_FROZEN_R,
            "location_specific": {"r_oracle": round(loc["oracle"], 3), "r_history": round(loc["history"], 3),
                                  "n_plots": loc["n_plots"], "sd_within_line": round(loc["sd_within_line"], 1),
                                  "sd_between_lines": round(float(np.sqrt(max(s2m - s2e / n_i.mean(), 0))), 1)},
            "leaky_r": round(leaky_r, 3),
            "by_confidence": {k: (round(v, 3) if np.isfinite(v) else None) for k, v in zip(("low", "medium", "high"), by_conf.values())},
            "families_by_parents_on_record": {k: int((kp[cohort][np.unique(cp.fam_index)] == c).sum()) for k, c in (("none", 0), ("one", 1), ("both", 2))},
            "strategies": strategies,
            "engines": [
                {"id": "family", "name": "2-Step", "r_mean": round(float(np.mean([b["r"] for b in by_year])), 3),
                 "r_last": round(head["r"], 3), "coverage90": round(coverage, 3)},
                {"id": "gblup", "name": "Standard engine (GBLUP)", "r_mean": round(float(np.mean([b["r_gblup"] for b in by_year])), 3),
                 "r_last": by_year[-1]["r_gblup"], "coverage90": round(g_cov, 3), "half90": round(g_half, 1)},
            ],
            "site_persistence": round(persistence, 3) if np.isfinite(persistence) else None,
            "environment": {
                "climate_r": round(clim["r_typical"], 3), "climate_r_real_weather": round(clim["r_actual"], 3),
                "climate_by_year": clim["by_year_typical"], "cells": clim["cells"],
                "joint_vs_fieldmates": round(jt["r_near_joint"], 2),
                "joint_follows_latitude": round(jt["lat_corr_joint"], 2), "fieldmates_follow_latitude": round(jt["lat_corr_near"], 2),
                "dna_predicts_test_latitude": round(float(np.mean(jt["dna_predicts_site"])), 2),
                "family_call_fieldmates": round(float(np.mean(jt["fwd_near"])), 3),
                "family_call_joint": round(float(np.mean(jt["fwd_joint"])), 3),
                "family_call_joint_minus_location": round(float(np.mean(jt["fwd_joint_site"])), 3),
            },
            "plots_to_match": match,
            "engine_value": value,
        },
    }


def engine_value(fd, fwd, eval_years, means, model, budgets=tuple(round(0.05 * i, 2) for i in range(1, 20)),
                 lines: dict | None = None) -> list[dict]:
    """What each engine's picks were worth, season by season, at many plot budgets, for the chart
    that opens the demo. For every season, engine and plan: the value it forecast in January for its
    own picks (their predicted $/acre above the season's average line) and what they really earned
    above the average line. The app corrects each forecast by how far earlier seasons' forecasts
    overshot, so a season's forecast uses only what was known before it. When `lines` is given, every
    graded line's predictions and real results are collected into it, so the app can redo all of this at
    the user's own prices."""
    import numpy as np
    out = []
    for y in eval_years:
        Y, M, L = (fwd[t][y] for t in ("yield_adj", "mst_adj", "lodging_adj"))
        fam = Y.fam_index
        idx = np.flatnonzero(np.isfinite(Y.truth) & np.isfinite(M.truth))
        pred_l = np.maximum(0, means["lodging_adj"] + L.pred)
        act_l = np.where(np.isfinite(L.truth), np.maximum(0, means["lodging_adj"] + L.truth), pred_l)
        g_y = means["yield_adj"] + model.global_ridge_cohort(fd, "yield_adj", y)
        g_m = means["mst_adj"] + model.global_ridge_cohort(fd, "mst_adj", y)
        g_l = np.maximum(0, means["lodging_adj"] + model.global_ridge_cohort(fd, "lodging_adj", y))
        # the graded lines, rounded to what the app is sent (predictions to 0.001, so near-ties inside a
        # family stay apart); everything below works from these same values and breaks ties by line order,
        # as the app does, so the app redoes these numbers to the cent at any prices
        cols = {"py": (means["yield_adj"] + Y.pred, 1000), "pm": (means["mst_adj"] + M.pred, 1000), "pl": (pred_l, 1000),
                "gy": (g_y, 1000), "gm": (g_m, 1000), "gl": (g_l, 1000),
                "ry": (means["yield_adj"] + Y.truth, 100), "rm": (means["mst_adj"] + M.truth, 1000), "rl": (act_l, 100)}
        ints = {key: np.rint(arr[idx] * scale).astype(np.int64) for key, (arr, scale) in cols.items()}
        v = {key: ints[key] / cols[key][1] for key in cols}
        f_i = fam[idx]
        if lines is not None:
            lines.setdefault("year", []).extend([int(y)] * len(idx))
            lines.setdefault("fam", []).extend(f_i.astype(int).tolist())
            for key, a in ints.items():
                lines.setdefault(key, []).extend(a.tolist())
        real = _margin(v["ry"], v["rm"], v["rl"])
        predicted = {"family": _margin(v["py"], v["pm"], v["pl"]), "gblup": _margin(v["gy"], v["gm"], v["gl"])}
        members = [np.flatnonzero(f_i == f_) for f_ in np.unique(f_i)]
        for engine, pm in predicted.items():
            order = np.argsort(-pm, kind="stable")
            within = [m[np.argsort(-pm[m], kind="stable")] for m in members]   # each family, best first
            for b in budgets:
                aggressive = order[: int(round(b * len(idx)))]
                even = np.concatenate([m[: int(round(b * len(m)))] for m in within])
                for plan, sel in (("aggressive", aggressive), ("conservative", even)):
                    if not len(sel):
                        continue
                    out.append({"year": int(y), "budget": b, "engine": engine, "plan": plan,
                                "predicted": round(float(pm[sel].mean() - pm.mean()), 3),
                                "real": round(float(real[sel].mean() - real.mean()), 3)})
    return out


def _margin(y, m, lodg, p=PRICE_DEFAULTS):
    """$/acre, the same arithmetic as src/lib/econ.ts."""
    import numpy as np
    return (y * p["corn_price"] - np.maximum(0, m - p["target_moisture"]) * p["drying_cost_per_point"] * y
            - lodg / 100 * p["lodging_loss_fraction"] * y * p["corn_price"])


def strategy_backtest(fd, fwd, eval_years, means, model, budgets=(0.3, 0.5), cap=50) -> list[dict]:
    """Every forward year, every way of spending the same plots, scored on what the field did.
    Realised $/acre uses the measured yield and moisture (trial- and tester-adjusted); lodging
    falls back to its prediction where plots were not scored, as in the app."""
    import numpy as np
    out = []
    for y in eval_years:
        Y, M, E, L = (fwd[t][y] for t in ("yield_adj", "mst_adj", "erm_adj", "lodging_adj"))
        fam = Y.fam_index
        ok = np.isfinite(Y.truth) & np.isfinite(M.truth)
        pred_y = means["yield_adj"] + Y.pred
        pred_m = means["mst_adj"] + M.pred
        pred_l = np.maximum(0, means["lodging_adj"] + L.pred)
        act_l = np.where(np.isfinite(L.truth), np.maximum(0, means["lodging_adj"] + L.truth), pred_l)
        realised = _margin(means["yield_adj"] + Y.truth, means["mst_adj"] + M.truth, act_l)
        erm = E.truth
        g = model.global_ridge_cohort(fd, "yield_adj", y)
        g_m = means["mst_adj"] + model.global_ridge_cohort(fd, "mst_adj", y)
        g_l = np.maximum(0, means["lodging_adj"] + model.global_ridge_cohort(fd, "lodging_adj", y))
        scores = {
            "standard GBLUP, rank by bushels": g,
            "standard GBLUP, rank by $/acre": _margin(means["yield_adj"] + g, g_m, g_l),
            "ProMaize, rank by bushels": pred_y,
            "ProMaize, rank by $/acre": _margin(pred_y, pred_m, pred_l),
        }
        idx = np.flatnonzero(ok)
        mean_real = realised[idx].mean()
        top10 = set(idx[np.argsort(-realised[idx])[: max(1, len(idx) // 10)]])
        for b in budgets:
            k = int(round(b * len(idx)))
            picks = {name: idx[np.argsort(-sc[idx])[:k]] for name, sc in scores.items()}
            # the same $ ranking with a family limit: greedy, skipping families already at the cap
            order = idx[np.argsort(-scores["ProMaize, rank by $/acre"][idx])]
            taken, per = [], {}
            for i in order:
                if per.get(fam[i], 0) < cap:
                    taken.append(i); per[fam[i]] = per.get(fam[i], 0) + 1
                if len(taken) == k:
                    break
            picks[f"ProMaize, $/acre, max {cap} per family"] = np.array(taken)
            # every family gets the same share of its lines; markers only choose the siblings
            marg = scores["ProMaize, rank by $/acre"]
            even = []
            for f_ in np.unique(fam[idx]):
                members = idx[fam[idx] == f_]
                q = int(round(b * len(members)))
                even += list(members[np.argsort(-marg[members])[:q]])
            picks["ProMaize, same share of every family"] = np.array(even)
            out.append({"year": int(y), "budget": b, "strategy": "random", "gain": 0.0, "top10_kept": b,
                        "eff_families": float("nan"), "maturity_shift": 0.0})
            for name, sel in picks.items():
                share = np.bincount(fam[sel]) / len(sel)
                out.append({
                    "year": int(y), "budget": b, "strategy": name,
                    "gain": float(realised[sel].mean() - mean_real),
                    "top10_kept": float(len(top10 & set(sel)) / len(top10)),
                    "eff_families": float(1 / (share[share > 0] ** 2).sum()),
                    "maturity_shift": float(np.nanmean(erm[sel]) - np.nanmean(erm[idx])),
                })
    # the same question in plots: how much of the cohort would the standard ranking have to plant
    # to keep as many of the real top 10% as ProMaize keeps with 30%?
    match = []
    for y in eval_years:
        Y, M, L = (fwd[t][y] for t in ("yield_adj", "mst_adj", "lodging_adj"))
        ok = np.isfinite(Y.truth) & np.isfinite(M.truth)
        idx = np.flatnonzero(ok)
        pred_l = np.maximum(0, means["lodging_adj"] + L.pred)
        act_l = np.where(np.isfinite(L.truth), np.maximum(0, means["lodging_adj"] + L.truth), pred_l)
        real = _margin(means["yield_adj"] + Y.truth, means["mst_adj"] + M.truth, act_l)
        top10 = np.zeros(len(real), bool)
        top10[idx[np.argsort(-real[idx])[: max(1, len(idx) // 10)]]] = True
        ours = _margin(means["yield_adj"] + Y.pred, means["mst_adj"] + M.pred, pred_l)
        std = model.global_ridge_cohort(fd, "yield_adj", y)
        def kept_curve(score):
            hits = np.cumsum(top10[idx[np.argsort(-score[idx])]]) / top10.sum()
            return lambda share: hits[max(0, int(round(share * len(idx))) - 1)]
        target = kept_curve(ours)(0.3)
        std_kept = kept_curve(std)
        need = next((b / 100 for b in range(30, 101) if std_kept(b / 100) >= target), 1.0)
        match.append({"year": int(y), "ours_kept": round(float(target), 3), "standard_needs": need,
                      "lines_saved": int(round((need - 0.3) * len(idx)))})
    # averages over the forward years, next to each year
    rows = []
    keys = sorted({(r["budget"], r["strategy"]) for r in out}, key=lambda x: (x[0], x[1] != "random", x[1]))
    for b, name in keys:
        rs = [r for r in out if r["budget"] == b and r["strategy"] == name]
        vals = {m: [r[m] for r in rs if np.isfinite(r[m])] for m in ("gain", "top10_kept", "eff_families", "maturity_shift")}
        rows.append({"year": "mean", "budget": b, "strategy": name,
                     **{m: float(np.mean(v)) if v else float("nan") for m, v in vals.items()}})
    return ([{k: (round(v, 3) if isinstance(v, float) else v) for k, v in r.items()} for r in rows + out],
            match)


def _finite(v):
    """NaN is not valid JSON: an undefined number goes out as null."""
    if isinstance(v, dict):
        return {k: _finite(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_finite(x) for x in v]
    if isinstance(v, float) and not np.isfinite(v):
        return None
    return v


def write(payload: dict, name: str = "recommendations.json") -> Path:
    payload = _finite(payload)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    out = PUBLIC / name
    out.write_text(json.dumps(payload, separators=(",", ":"), allow_nan=False))
    print(f"{out.relative_to(ROOT)}  {out.stat().st_size / 1024:.0f} KB  "
          f"{payload['meta']['n_candidates']:,} candidates  synthetic={payload['meta']['synthetic']}")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--synthetic", action="store_true", help="emit placeholder data")
    ap.add_argument("--source", default="g2f", choices=["g2f", "bayer", "custom"], help="dataset adapter")
    ap.add_argument("--out", help="write the JSON here instead of public/recommendations.json")
    ap.add_argument("--n", type=int, default=2000)
    ap.add_argument("--judge", action="store_true",
                    help="judge mode: run the Bayer pipeline on the synthetic program from scripts/make_fixture.py")
    args = ap.parse_args()
    if args.synthetic:
        write(synthetic(args.n))
    elif args.judge:
        from analysis import bayer, data
        sample = data.RAW / "bayer_sample"
        if not any(sample.rglob("*Phenotype*.csv")):
            raise SystemExit("No judge-mode data yet: python scripts/make_fixture.py")
        bayer.use(sample, "bayer_sample")
        write(real_bayer(synthetic=True))
    else:
        payload = real_bayer() if args.source == "bayer" else real(args.source)
        if args.out:
            out = Path(args.out)
            out.write_text(json.dumps(_finite(payload), separators=(",", ":"), allow_nan=False))
            print(f"{out}  {out.stat().st_size / 1024:.0f} KB  {payload['meta']['n_candidates']:,} candidates")
        else:
            write(payload)


if __name__ == "__main__":
    main()

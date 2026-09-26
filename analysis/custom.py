"""Adapter: any breeding program's files -> the two tables the model needs, driven by a layout file.

Put the files under data/raw/custom/ with a layout.json that says which column is which:

    {
      "field_file": "field_results.csv",     one row per plot
      "markers_file": "markers.csv",         one row per line, first column the line name
      "columns": {"line": "Genotype", "year": "Season", "location": "Site", "yield": "Yield",
                  "moisture": "Moisture", "lodging": "Lodging", "parent1": "Mother",
                  "parent2": "Father", "family": "Cross", "group": "Pool"},
      "yield_unit": "bu/ac",                 or "t/ha" / "Mg/ha"
      "markers_coding": "-1/0/1",            or "0/1/2"
      "rank": "auto"                         "new", "newest_season" or "auto"
    }

Only line, year, location and yield are required. The cleaning is the Bayer adapter's: names
trimmed and a stray ".0" removed, impossible values set to missing, missing kept missing, every
plot compared with its own trial (year x location, x group when given). What gets ranked: "new" is
the genotyped lines that never appear in the field file (next season's candidates); "newest_season"
holds out the newest season, ranks it blind and scores it against its results, as with the Bayer
data; "auto" (the default) takes the new lines when there are at least 50 of them.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd

from . import data

BASE = data.RAW / "custom"
BU_PER_T_HA = 15.93          # maize: 1 t/ha = 15.93 bu/ac
PLAUSIBLE = {"yield": (20, 350), "moisture": (5, 45), "lodging": (0, 100)}


def layout() -> dict:
    path = BASE / "layout.json"
    if not path.exists():
        raise SystemExit(f"No {path.relative_to(data.ROOT)}: see the docstring of analysis/custom.py")
    lay = json.loads(path.read_text())
    missing = [k for k in ("line", "year", "location", "yield") if k not in lay.get("columns", {})]
    if missing:
        raise SystemExit(f"layout.json: no column given for {', '.join(missing)}")
    return lay


def _clean_id(s: pd.Series) -> pd.Series:
    return s.astype(str).str.strip().str.replace(r"\.0$", "", regex=True)


def plots() -> pd.DataFrame:
    """Every plot, renamed to our names and cleaned."""
    lay = layout()
    cols = lay["columns"]
    t = pd.read_csv(BASE / lay.get("field_file", "field_results.csv"), low_memory=False)
    absent = [v for v in cols.values() if v not in t.columns]
    if absent:
        raise SystemExit(f"layout.json names columns the field file doesn't have: {', '.join(absent)}")
    p = pd.DataFrame({"id": _clean_id(t[cols["line"]]),
                      "year": pd.to_numeric(t[cols["year"]], errors="coerce"),
                      "location": t[cols["location"]].astype(str).str.strip()})
    for ours in ("yield", "moisture", "lodging"):
        p[ours] = pd.to_numeric(t[cols[ours]], errors="coerce") if ours in cols else np.nan
    if lay.get("yield_unit", "bu/ac").lower() in ("t/ha", "mg/ha"):
        p["yield"] = p["yield"] * BU_PER_T_HA
    for c, (lo, hi) in PLAUSIBLE.items():
        p.loc[(p[c] < lo) | (p[c] > hi), c] = np.nan
    for c in ("parent1", "parent2", "family", "group"):
        p[c] = _clean_id(t[cols[c]]).replace("nan", "") if c in cols else ""
    p = p.dropna(subset=["year"])
    p["year"] = p["year"].astype(int)
    p["trial"] = p["year"].astype(str) + "_" + p["location"] + "_" + p["group"]
    return p


def hybrids() -> pd.DataFrame:
    """One row per line: trial-adjusted trait means, first season, parents and family."""
    p = plots()
    p = p[p["yield"].notna()]
    for c in ("yield", "moisture", "lodging"):
        p[c + "_adj"] = p[c] - p.groupby("trial")[c].transform("mean")
    g = p.groupby("id")
    h = pd.DataFrame({
        "yield_adj": g["yield_adj"].mean(), "mst_adj": g["moisture_adj"].mean(), "lodging": g["lodging"].mean(),
        "n_env": g["trial"].nunique(), "first_year": g["year"].min(),
    })
    first = p.drop_duplicates("id").set_index("id")
    for c in ("parent1", "parent2", "family"):
        h[c] = first[c].reindex(h.index).to_numpy()
    h["population"] = _family(h)
    h.attrs["mean_yield_bu"] = float(p["yield"].mean())
    h.attrs["mean_mst"] = float(p["moisture"].mean()) if p["moisture"].notna().any() else 0.0
    return h


def _family(h: pd.DataFrame) -> pd.Series:
    """The family column if given, else the two parents, else the line itself."""
    fam = h["family"].where(h["family"] != "", h["parent1"] + "/" + h["parent2"])
    return fam.where(fam.str.strip("/") != "", pd.Series(h.index, index=h.index))


def markers() -> pd.DataFrame:
    lay = layout()
    m = pd.read_csv(BASE / lay.get("markers_file", "markers.csv"), index_col=0, low_memory=False)
    m.index = _clean_id(pd.Series(m.index)).to_numpy()
    m = m[~m.index.duplicated()]
    m = m.apply(pd.to_numeric, errors="coerce")
    if lay.get("markers_coding", "-1/0/1") == "0/1/2":
        m = m - 1
    m = m.loc[:, m.notna().mean() > 0.8]          # drop markers mostly missing
    m = m.fillna(m.mean())                          # mean-impute the rest
    return m.loc[:, m.std() > 0]                    # drop monomorphic


def candidates(h: pd.DataFrame, M: pd.DataFrame) -> tuple[pd.DataFrame, bool]:
    """The lines to rank, and whether they are a held-out season with results to score against."""
    mode = layout().get("rank", "auto")
    # new means never in the field file at all, not just short of a usable yield
    new = M.index.difference(pd.Index(plots()["id"].unique()))
    if mode == "new" and not len(new):
        raise SystemExit('layout.json asks to rank new lines, but every genotyped line is already in the field file')
    if mode == "new" or (mode == "auto" and len(new) >= 50):
        c = pd.DataFrame(index=new)
        c["population"] = c.index
        return c, False
    return h[h["first_year"] == h["first_year"].max()].copy(), True

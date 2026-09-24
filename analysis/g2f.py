"""Adapter: Genomes to Fields public data -> the two tables the model needs.

Any dataset plugs in by providing the same two outputs:
  hybrids : one row per line, env-adjusted trait means + first year seen + parents
  markers : DataFrame indexed by line id, one column per marker, numeric, no NaN

Friday: write bayer.py with the same two functions and swap the import in
scripts/build_data.py. Nothing downstream changes.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import data

BU_PER_MG_HA = 15.93  # maize: 1 Mg/ha = 15.93 bu/ac


def hybrids(min_envs: int = 2) -> pd.DataFrame:
    t = pd.read_csv(data.RAW / "g2f/Training_data/1_Training_Trait_Data_2014_2023.csv", low_memory=False)
    stand = t["Stand_Count_plants"].replace(0, np.nan)
    t["lodging_pct"] = 100 * (t["Root_Lodging_plants"].fillna(0) + t["Stalk_Lodging_plants"].fillna(0)) / stand
    t["yield_bu"] = t["Yield_Mg_ha"] * BU_PER_MG_HA
    # remove location/year effects the same way a trial analysis would: deviation from env mean
    for c in ("yield_bu", "Grain_Moisture", "lodging_pct"):
        t[c + "_adj"] = t[c] - t.groupby("Env")[c].transform("mean")
    g = t.groupby("Hybrid")
    h = pd.DataFrame({
        "yield_adj": g["yield_bu_adj"].mean(),
        "mst_adj": g["Grain_Moisture_adj"].mean(),
        "lodging": g["lodging_pct"].mean(),
        "n_env": g["Env"].nunique(),
        "first_year": g["Year"].min(),
        "last_year": g["Year"].max(),
        "parent1": g["Hybrid_Parent1"].first(),
        "parent2": g["Hybrid_Parent2"].first(),
    })
    h = h[h.n_env >= min_envs].dropna(subset=["yield_adj"])
    # population-level anchors so predictions can be reported in absolute units
    h.attrs["mean_yield_bu"] = float(t["yield_bu"].mean())
    h.attrs["mean_mst"] = float(t["Grain_Moisture"].mean())
    return h


def markers() -> pd.DataFrame:
    path = data.RAW / "g2f/Training_data/5_Genotype_Data_All_2014_2025_Hybrids_numerical.txt"
    m = pd.read_csv(path, sep="\t", skiprows=1, index_col=0, na_values=["NA"])
    m.index.name = "Hybrid"
    m = m.apply(pd.to_numeric, errors="coerce")
    m = m.loc[:, m.notna().mean() > 0.8]          # drop markers mostly missing
    m = m.fillna(m.mean())                          # mean-impute the rest
    m = m.loc[:, m.std() > 0]                       # drop monomorphic
    return m


def candidates_2024() -> pd.DataFrame:
    """The cohort to rank: 2024 hybrids from the competition template, none in training."""
    s = pd.read_csv(data.RAW / "g2f/Testing_data/1_Submission_Template_2024.csv")
    c = s[["Hybrid"]].drop_duplicates().set_index("Hybrid")
    parts = c.index.to_series().str.split("/", n=1, expand=True)
    c["parent1"], c["parent2"] = parts[0], parts[1]
    # GEMS-0227_FBLL_0016 -> GEMS-0227_FBLL: lines from one source population share a family
    c["population"] = c["parent1"].str.replace(r"_\d{3,4}$", "", regex=True)
    return c

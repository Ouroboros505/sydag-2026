"""Adapter: population-structured breeding data -> the two tables the model needs.

Written against the documented layout of the corn breeding dataset (clusters C1/C2,
per-population genotype files, YLD_BE in bu/ac). Expects, under data/raw/bayer/:

  C1_Phenotype_Data_V2.csv, C2_Phenotype_Data_V2.csv
      YEAR, LOC, <id column: LINE_UNIQUE_ID or UID = C{cluster}.{population}.{line}>,
      YLD_BE, MST, RTLP, STLP, TWT, ...
  ImputedPopulationsC1/C1.<pop>_Imputed.csv, ImputedPopulationsC2/C2.<pop>_Imputed.csv
      first column = individual id; first two rows = the population's parents (PID...);
      remaining rows = progeny numbered 00000000001...; other columns = markers, 1/0/-1, NA

Same two outputs as g2f.py, so scripts/build_data.py swaps one import. Column names
are matched case-insensitively and the file glob is loose, so small naming differences
on the day are absorbed here, not downstream.
"""
from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import pandas as pd

from . import data

BASE = data.RAW / "bayer"
ID_PATTERNS = ("LINE_UNIQUE_ID", "UID", "LINEUNIQUEID")


def _find(df: pd.DataFrame, *names: str) -> str:
    cols = {c.upper(): c for c in df.columns}
    for n in names:
        if n.upper() in cols:
            return cols[n.upper()]
    raise KeyError(f"none of {names} in columns {list(df.columns)[:12]}...")


def _phenotype_files() -> list[Path]:
    fs = sorted(BASE.glob("*Phenotype*.csv"))
    if not fs:
        raise FileNotFoundError(f"no *Phenotype*.csv under {BASE}")
    return fs


def hybrids(min_envs: int = 1) -> pd.DataFrame:
    frames = []
    for f in _phenotype_files():
        t = pd.read_csv(f, low_memory=False)
        idc = _find(t, *ID_PATTERNS)
        t = t.rename(columns={
            idc: "id", _find(t, "YEAR"): "year", _find(t, "LOC"): "location", _find(t, "YLD_BE"): "yield_bu",
            _find(t, "MST"): "mst",
        })
        for c, src_ in (("rtlp", "RTLP"), ("stlp", "STLP")):
            try:
                t[c] = pd.to_numeric(t[_find(t, src_)], errors="coerce")
            except KeyError:
                t[c] = 0.0
        frames.append(t[["id", "year", "location", "yield_bu", "mst", "rtlp", "stlp"]])
    t = pd.concat(frames, ignore_index=True)
    for c in ("yield_bu", "mst"):
        t[c] = pd.to_numeric(t[c], errors="coerce")
    t["lodging_pct"] = t["rtlp"].fillna(0) + t["stlp"].fillna(0)
    t["env"] = t["year"].astype(str) + "_" + t["location"].astype(str)
    for c in ("yield_bu", "mst", "lodging_pct"):
        t[c + "_adj"] = t[c] - t.groupby("env")[c].transform("mean")
    g = t.groupby("id")
    h = pd.DataFrame({
        "yield_adj": g["yield_bu_adj"].mean(),
        "mst_adj": g["mst_adj"].mean(),
        "lodging": g["lodging_pct"].mean(),
        "n_env": g["env"].nunique(),
        "first_year": g["year"].min(),
        "last_year": g["year"].max(),
    })
    h = h[h.n_env >= min_envs].dropna(subset=["yield_adj"])
    pop = h.index.to_series().str.extract(r"^(C\d+\.\d+)\.")[0]
    h["population"] = pop
    parents = _parents()
    h["parent1"] = pop.map(lambda p: parents.get(p, ("", ""))[0])
    h["parent2"] = pop.map(lambda p: parents.get(p, ("", ""))[1])
    h.attrs["mean_yield_bu"] = float(t["yield_bu"].mean())
    h.attrs["mean_mst"] = float(t["mst"].mean())
    return h


_POP_RE = re.compile(r"(C\d+)\.(\d+)_", re.I)


def _genotype_files() -> list[tuple[str, Path]]:
    out = []
    for f in sorted(BASE.rglob("*_Imputed.csv")):
        m = _POP_RE.search(f.name)
        if m:
            out.append((f"{m.group(1).upper()}.{int(m.group(2))}", f))
    if not out:
        raise FileNotFoundError(f"no *_Imputed.csv under {BASE}")
    return out


def _read_pop(pop: str, f: Path) -> tuple[pd.DataFrame, tuple[str, str]]:
    g = pd.read_csv(f, index_col=0, na_values=["NA", "NaN", ""], low_memory=False)
    g = g.apply(pd.to_numeric, errors="coerce").astype("float32")
    parents = tuple(str(i) for i in g.index[:2])
    prog = g.iloc[2:].copy()
    prog.index = [f"{pop}.{int(str(i))}" for i in prog.index]   # 00000000002 -> C1.1.2
    return prog, (parents[0], parents[1] if len(parents) > 1 else "")


_parent_cache: dict[str, tuple[str, str]] = {}


def _parents() -> dict[str, tuple[str, str]]:
    if not _parent_cache:
        for pop, f in _genotype_files():
            with open(f) as fh:
                next(fh)
                p1 = next(fh).split(",", 1)[0]
                p2 = next(fh).split(",", 1)[0]
            _parent_cache[pop] = (p1, p2)
    return _parent_cache


def markers(keep: pd.Index | None = None) -> pd.DataFrame:
    """Progeny marker matrix. Pass `keep` (line ids) to bound memory on the full dataset —
    a fully flattened table of every population is tens of GB; the lines with phenotypes
    plus the candidate cohort are a small fraction of that."""
    parts = []
    for pop, f in _genotype_files():
        prog, _ = _read_pop(pop, f)
        if keep is not None:
            prog = prog[prog.index.isin(keep)]
        if len(prog):
            parts.append(prog)
    m = pd.concat(parts)
    m = m.loc[:, m.notna().mean() > 0.8]
    m = m.fillna(m.mean())
    m = m.loc[:, m.std() > 0]
    m.index.name = "id"
    return m


def candidates(h: pd.DataFrame) -> pd.DataFrame:
    """The cohort to rank: genotyped progeny with no phenotype record."""
    ids = []
    for pop, f in _genotype_files():
        with open(f) as fh:
            next(fh); next(fh); next(fh)
            for line in fh:
                ids.append(f"{pop}.{int(line.split(',', 1)[0])}")
    c = pd.DataFrame(index=pd.Index([i for i in ids if i not in h.index], name="id"))
    pop = c.index.to_series().str.extract(r"^(C\d+\.\d+)\.")[0]
    parents = _parents()
    c["parent1"] = pop.map(lambda p: parents.get(p, ("", ""))[0])
    c["parent2"] = pop.map(lambda p: parents.get(p, ("", ""))[1])
    c["population"] = pop
    return c

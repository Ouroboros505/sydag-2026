"""Adapter: the Bayer legacy dataset -> the tables the model needs.

Layout as delivered, under data/raw/bayer/ (any depth):

  C1_Phenotype_Data_V2.csv, C2_Phenotype_Data_V2.csv     one row per plot, 2000-2008
      YEAR_x, LOC, LINE_UNIQUE_ID = C{cluster}.{family}.{line} (C2 ids carry a stray ".0"),
      YLD_BE (bu/ac), MST, ERM, TWT, RTLP, STLP, GERMPLASM_ID_TESTER, CROSS (the two parent ids)
  Imputed*Populations/**/C1.<fam>_Imputed.csv, C2.<fam>_Imputed.csv     999 families
      first column = individual id, quoted; rows 1-2 = the family's parents (PID...);
      then progeny 00000000001...; 2,911 markers coded 1/0/-1, NA. Progeny were genotyped
      at 49-123 SNPs; the rest was imputed from the parents.
  Unimputed_C{1,2}_Genome_Data.csv     raw calls for every family, the fallback below
  environmental_features.csv           year x location weather and soil

Structure that matters for the model: every family is tested in exactly one year, ~160 lines,
~7 locations each, one tester. A new year's cohort is therefore made of families nobody has
seen; the only bridge to the past is their parents, who recur across families.

Parsing ~1,000 genotype files takes minutes, so the first call writes a cache under
data/processed/ and later calls load it in seconds. Delete the cache to rebuild.
"""
from __future__ import annotations

import json
import re
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

from . import data

BASE = data.RAW / "bayer"
CACHE = data.PROCESSED
ID_PATTERNS = ("LINE_UNIQUE_ID", "UID", "LINEUNIQUEID")
PHENO_COLS = ("YEAR_x", "YEAR", "LOC", "LINE_UNIQUE_ID", "YLD_BE", "MST", "ERM", "RTLP", "STLP", "TWT",
              "GERMPLASM_ID_TESTER", "CROSS", "GENERATION_NAME", "LATITUDE", "LONGITUDE")
# a plot outside these is a recording error, not a line effect
PLAUSIBLE = {"yield_bu": (20, 350), "mst": (5, 45), "erm": (80, 140), "twt": (40, 70),
             "rtlp": (0, 100), "stlp": (0, 100)}


def _find(df: pd.DataFrame, *names: str) -> str:
    cols = {c.upper(): c for c in df.columns}
    for n in names:
        if n.upper() in cols:
            return cols[n.upper()]
    raise KeyError(f"none of {names} in columns {list(df.columns)[:12]}...")


def _clean_id(s: pd.Series) -> pd.Series:
    return s.astype(str).str.strip().str.replace(r"\.0$", "", regex=True)


def family_of(ids) -> pd.Series:
    """C1.12.7 -> C1.12"""
    return pd.Series(list(ids), dtype=object).str.extract(r"^(C\d+\.\d+)\.")[0]


# ------------------------------------------------------------------ plots

def use(base: Path, cache_name: str) -> None:
    """Point the adapter at another copy of the layout (judge mode), with its own cache."""
    global BASE, CACHE
    BASE, CACHE = Path(base), data.PROCESSED / cache_name


def plots() -> pd.DataFrame:
    """Every field plot, cleaned: one row per line x location x year."""
    path = CACHE / "bayer_plots.parquet"
    if path.exists():
        return pd.read_parquet(path)
    frames = []
    for f in sorted(BASE.rglob("*Phenotype*.csv")):
        head = pd.read_csv(f, nrows=0)
        use = [c for c in head.columns if c.upper() in {p.upper() for p in PHENO_COLS}]
        t = pd.read_csv(f, usecols=use, low_memory=False)
        out = pd.DataFrame({
            "id": _clean_id(t[_find(t, *ID_PATTERNS)]),
            "year": pd.to_numeric(t[_find(t, "YEAR", "YEAR_X")], errors="coerce").astype("Int64"),
            "location": t[_find(t, "LOC")].astype(str),
        })
        for c, src in (("yield_bu", "YLD_BE"), ("mst", "MST"), ("erm", "ERM"), ("twt", "TWT"),
                       ("rtlp", "RTLP"), ("stlp", "STLP"), ("lat", "LATITUDE"), ("lon", "LONGITUDE")):
            try:
                out[c] = pd.to_numeric(t[_find(t, src)], errors="coerce").astype("float32")
            except KeyError:
                out[c] = np.float32(np.nan)
        for c, src in (("tester", "GERMPLASM_ID_TESTER"), ("cross", "CROSS"), ("generation", "GENERATION_NAME")):
            try:
                out[c] = _clean_id(t[_find(t, src)]).replace("nan", "")
            except KeyError:
                out[c] = ""
        frames.append(out)
    if not frames:
        raise FileNotFoundError(f"no *Phenotype*.csv under {BASE}")
    p = pd.concat(frames, ignore_index=True)
    for c, (lo, hi) in PLAUSIBLE.items():
        p.loc[(p[c] < lo) | (p[c] > hi), c] = np.nan
    p["family"] = family_of(p["id"]).to_numpy()
    p["cluster"] = p["family"].str.slice(0, 2)
    p = p.dropna(subset=["family", "year"])
    # the two clusters are separate trials even at a shared location: compare within one
    p["env"] = p["year"].astype(str) + "_" + p["location"] + "_" + p["cluster"]
    p["lodging"] = p[["rtlp", "stlp"]].sum(axis=1, min_count=1)   # missing is not zero
    CACHE.mkdir(parents=True, exist_ok=True)
    p.to_parquet(path, index=False)
    return p


def hybrids(min_envs: int = 1) -> pd.DataFrame:
    """One row per line: environment-adjusted trait means over its plots (each plot minus
    its trial's mean), plus cohort, family, cluster, parents and tester."""
    p = plots()
    p = p[p["yield_bu"].notna()]
    traits = ("yield_bu", "mst", "erm", "twt", "lodging")
    # every trait relative to its own trial: lodging most of all, which is mostly which storm
    # hit which field, not the line
    adj = {c: p[c] - p.groupby("env")[c].transform("mean") for c in traits}
    t = pd.DataFrame({"id": p["id"], **{c + "_adj": adj[c] for c in traits}, **{c: p[c] for c in traits},
                      "env": p["env"], "year": p["year"]})
    g = t.groupby("id", sort=False)
    h = pd.DataFrame({
        "yield_adj": g["yield_bu_adj"].mean(),
        "mst_adj": g["mst_adj"].mean(),
        "erm_adj": g["erm_adj"].mean(),
        "twt_adj": g["twt_adj"].mean(),
        "lodging_adj": g["lodging_adj"].mean(),
        "lodging": g["lodging"].mean(),
        "yield_raw": g["yield_bu"].mean(),
        "n_env": g["env"].nunique(),
        "first_year": g["year"].min().astype(int),
    })
    h = h[h.n_env >= min_envs].dropna(subset=["yield_adj"])
    first = p.drop_duplicates("id").set_index("id")
    h["family"] = first["family"].reindex(h.index).to_numpy()
    h["cluster"] = first["cluster"].reindex(h.index).to_numpy()
    h["tester"] = first["tester"].reindex(h.index).to_numpy()
    h["generation"] = first["generation"].reindex(h.index).to_numpy()
    h["population"] = h["family"]
    fam = families()
    h["parent1"] = fam["parent1"].reindex(h["family"]).fillna("").to_numpy()
    h["parent2"] = fam["parent2"].reindex(h["family"]).fillna("").to_numpy()
    h.attrs["mean_yield_bu"] = float(p["yield_bu"].mean())
    h.attrs["mean_mst"] = float(p["mst"].mean())
    h.attrs["mean_erm"] = float(p["erm"].mean())
    h.attrs["mean_lodging"] = float(p["lodging"].mean())
    return h


# ------------------------------------------------------------------ genotypes

_POP_RE = re.compile(r"(C\d+)\.(\d+)_", re.I)


def _genotype_files() -> list[tuple[str, Path]]:
    out = []
    for f in sorted(BASE.rglob("*_Imputed.csv")):
        m = _POP_RE.search(f.name)
        if m and "__MACOSX" not in f.parts:
            out.append((f"{m.group(1).upper()}.{int(m.group(2))}", f))
    return out


def _fill_nan(a: np.ndarray, fill: np.ndarray) -> np.ndarray:
    """Column-wise NaN fill in place, in numpy. DataFrame.fillna(Series) walks 2,911 columns
    one by one and re-splits the block each time: minutes per family, hours in total."""
    np.copyto(a, np.broadcast_to(fill.astype(a.dtype), a.shape), where=np.isnan(a))
    return a


def _nanmean0(a: np.ndarray) -> np.ndarray:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)   # all-NaN columns are allowed here
        return np.nanmean(a, axis=0)


def _read_family(fam: str, f: Path, markers: list[str]) -> tuple[list[str], np.ndarray, dict[str, np.ndarray]]:
    g = pd.read_csv(f, index_col=0, na_values=["NA", "NaN", ""], low_memory=False)
    g = g.reindex(columns=markers)
    try:
        v = g.to_numpy(dtype=np.float32)
    except (ValueError, TypeError):   # a stray non-numeric cell: the slow, forgiving path
        v = g.apply(pd.to_numeric, errors="coerce").to_numpy(dtype=np.float32)
    ids = [str(i).strip().strip('"') for i in g.index]
    parents = {ids[k]: v[k] for k in range(min(2, len(ids)))}
    keep = [k for k in range(2, len(ids)) if ids[k].isdigit()]   # a few rows carry ids like 000000161.1
    prog = v[keep]
    # a gap the imputation left is best guessed from the family itself, else from its parents
    _fill_nan(prog, _nanmean0(prog))
    if parents:
        _fill_nan(prog, _nanmean0(np.vstack(list(parents.values()))))
    np.nan_to_num(prog, copy=False)   # missing in the family and both parents: the neutral code
    return [f"{fam}.{int(ids[k])}" for k in keep], prog, parents


def _unimputed(fams: set[str], markers: list[str]) -> dict[str, tuple[list[str], np.ndarray, dict[str, np.ndarray]]]:
    """Families with no imputed file: take them from the raw genome file. A marker a line was
    not genotyped at gets its parents' average, the family's expectation for it."""
    out = {}
    for f in BASE.rglob("*_Genome_Data.csv"):
        if "__MACOSX" in f.parts:
            continue
        chunks = [c[c["shorthand"].isin(list(fams))] for c in pd.read_csv(f, chunksize=4000, low_memory=False)]
        chunks = [c for c in chunks if len(c)]
        if not chunks:
            continue
        u = pd.concat(chunks)
        line = u["LINE"].astype(str).str.strip().to_numpy()
        v = u.reindex(columns=markers).apply(pd.to_numeric, errors="coerce").to_numpy(dtype=np.float32)
        fam_col = u["shorthand"].astype(str).to_numpy()
        for fam in np.unique(fam_col):
            rows = np.flatnonzero(fam_col == fam)
            par = {line[r]: v[r] for r in rows if line[r].startswith("PID")}
            prog_rows = [r for r in rows if line[r].isdigit()]
            prog = v[prog_rows]
            if par:
                _fill_nan(prog, _nanmean0(np.vstack(list(par.values()))))
            np.nan_to_num(prog, copy=False)
            out[str(fam)] = ([f"{fam}.{int(line[r])}" for r in prog_rows], prog, par)
    return out


def _build_genotype_cache() -> None:
    files = _genotype_files()
    if not files:
        raise FileNotFoundError(f"no *_Imputed.csv under {BASE}")
    markers = [str(c) for c in pd.read_csv(files[0][1], nrows=0, index_col=0).columns]
    ids: list[str] = []
    blocks: list[np.ndarray] = []
    parents: dict[str, np.ndarray] = {}
    fam_parents: dict[str, list[str]] = {}
    seen = set()
    for fam, f in files:
        try:
            i, v, par = _read_family(fam, f, markers)
        except Exception as e:  # noqa: BLE001
            warnings.warn(f"skipping {f.name}: {e}")
            continue
        seen.add(fam)
        ids += i
        blocks.append(v.astype(np.float16))
        parents.update(par)
        fam_parents[fam] = list(par)
    want = {f for f in families().index if f not in seen}
    for fam, (i, v, par) in _unimputed(want, markers).items():
        ids += i
        blocks.append(v.astype(np.float16))
        parents.update(par)
        fam_parents[fam] = list(par)
    X = np.vstack(blocks)
    CACHE.mkdir(parents=True, exist_ok=True)
    np.save(CACHE / "bayer_markers.npy", X)
    P = np.vstack([parents[k] for k in parents]).astype(np.float32)
    np.save(CACHE / "bayer_parent_markers.npy", P)
    (CACHE / "bayer_markers.json").write_text(json.dumps({
        "ids": ids, "markers": markers, "parents": list(parents), "family_parents": fam_parents,
        "from_raw_file": sorted(want & set(fam_parents)),
    }))


def _genotype_cache() -> tuple[np.ndarray, dict]:
    if not (CACHE / "bayer_markers.npy").exists():
        _build_genotype_cache()
    meta = json.loads((CACHE / "bayer_markers.json").read_text())
    return np.load(CACHE / "bayer_markers.npy", mmap_mode="r"), meta


def markers(keep=None) -> pd.DataFrame:
    """Progeny marker matrix, float32, lines x markers. Pass `keep` (line ids) to bound memory:
    all ~160k lines x 2,911 markers is 1.9 GB."""
    X, meta = _genotype_cache()
    ids = meta["ids"]
    if keep is not None:
        want = set(map(str, keep))
        rows = np.fromiter((k for k, i in enumerate(ids) if i in want), dtype=np.int64)
    else:
        rows = np.arange(len(ids))
    M = pd.DataFrame(np.asarray(X[rows], dtype=np.float32), index=pd.Index([ids[k] for k in rows], name="id"),
                     columns=meta["markers"])
    return M


def parent_markers(columns: pd.Index | None = None) -> pd.DataFrame:
    """Genotypes of every family's two parents (real calls at all 2,911 markers)."""
    _, meta = _genotype_cache()
    P = pd.DataFrame(np.load(CACHE / "bayer_parent_markers.npy"), index=meta["parents"], columns=meta["markers"])
    if columns is not None:
        P = P.reindex(columns=columns)
    a = P.to_numpy(dtype=np.float32, copy=True)   # pandas 3 hands back a read-only view otherwise
    _fill_nan(a, np.nan_to_num(_nanmean0(a)))
    return pd.DataFrame(a, index=P.index, columns=P.columns)


# ------------------------------------------------------------------ families

def families() -> pd.DataFrame:
    """One row per family: cluster, cohort year, tester, parents, lines tested."""
    path = CACHE / "bayer_families.parquet"
    if path.exists():
        return pd.read_parquet(path).set_index("family")
    p = plots()
    first = p.drop_duplicates("family").set_index("family")
    fam = pd.DataFrame({
        "cluster": first["cluster"],
        "year": p.groupby("family")["year"].min().astype(int),
        "tester": first["tester"],
        "n_lines": p.groupby("family")["id"].nunique(),
    })
    cross = first["cross"].str.split("/", expand=True)
    fam["parent1"] = ("PID" + cross[0].fillna("")).where(cross[0].fillna("") != "", "")
    fam["parent2"] = ("PID" + cross[1].fillna("")).where(cross[1].fillna("") != "", "") if cross.shape[1] > 1 else ""
    # the genotype files name the parents too, and are the ones whose markers we hold
    for fam_id, f in _genotype_files():
        with open(f) as fh:
            next(fh)
            ids = [next(fh).split(",", 1)[0].strip().strip('"') for _ in range(2)]
        if fam_id in fam.index and all(i.startswith("PID") for i in ids):
            fam.loc[fam_id, ["parent1", "parent2"]] = ids
    fam.index.name = "family"
    CACHE.mkdir(parents=True, exist_ok=True)
    fam.reset_index().to_parquet(path, index=False)
    return fam


def environments() -> pd.DataFrame:
    """Year x location weather and soil, as delivered."""
    f = next(iter(sorted(BASE.rglob("environmental_features.csv"))), None)
    if f is None:
        raise FileNotFoundError(f"no environmental_features.csv under {BASE}")
    return pd.read_csv(f)

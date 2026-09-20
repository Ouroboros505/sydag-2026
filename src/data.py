"""Data loading. One place that knows where files live, so nobody hardcodes paths.

Rule for the weekend: raw files land in data/raw/ untouched. Anything you clean
gets written to data/processed/ by a function in here, never by a notebook.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"


def find(name: str) -> Path:
    """Locate a file by name anywhere under data/. Saves arguing about paths."""
    for base in (RAW, PROCESSED):
        hits = sorted(base.rglob(name))
        if hits:
            return hits[0]
    raise FileNotFoundError(f"{name!r} not found under {RAW} or {PROCESSED}")


def load(name: str, **kwargs) -> pd.DataFrame:
    """Read csv/tsv/parquet/xlsx/json by extension. `name` is a filename or a path."""
    path = Path(name)
    if not path.exists():
        path = find(path.name)
    suffix = path.suffix.lower()
    if suffix in {".csv", ".txt"}:
        return pd.read_csv(path, **kwargs)
    if suffix in {".tsv", ".tab"}:
        return pd.read_csv(path, sep="\t", **kwargs)
    if suffix == ".parquet":
        return pd.read_parquet(path, **kwargs)
    if suffix in {".xlsx", ".xls"}:
        return pd.read_excel(path, **kwargs)
    if suffix in {".json", ".geojson"}:
        return pd.read_json(path, **kwargs)
    raise ValueError(f"no loader for {suffix!r}")


def save(df: pd.DataFrame, name: str) -> Path:
    """Write to data/processed/ as parquet. Returns the path."""
    PROCESSED.mkdir(parents=True, exist_ok=True)
    out = PROCESSED / (name if name.endswith(".parquet") else f"{name}.parquet")
    df.to_parquet(out, index=False)
    return out


def overview(df: pd.DataFrame) -> pd.DataFrame:
    """First thing to run on any new dataset: dtype, nulls, cardinality, a sample value."""
    return pd.DataFrame(
        {
            "dtype": df.dtypes.astype(str),
            "nulls": df.isna().sum(),
            "null_pct": (df.isna().mean() * 100).round(1),
            "unique": df.nunique(),
            "sample": [df[c].dropna().iloc[0] if df[c].notna().any() else None for c in df.columns],
        }
    )

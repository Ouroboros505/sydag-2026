"""Paths and IO. One place that knows where files live, so nobody hardcodes a path.

Convention: raw inputs land in data/raw/ untouched. Anything cleaned gets written to
data/processed/ through save() — not by a notebook writing wherever it feels like.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"


def find(name: str) -> Path:
    """Locate a file by name anywhere under data/."""
    for base in (RAW, PROCESSED):
        hits = sorted(base.rglob(name))
        if hits:
            return hits[0]
    raise FileNotFoundError(f"{name!r} not found under {RAW} or {PROCESSED}")


def load(name: str, **kwargs) -> pd.DataFrame:
    """Read by extension. `name` is a filename (searched for) or an explicit path."""
    path = Path(name)
    if not path.exists():
        path = find(path.name)
    match path.suffix.lower():
        case ".csv" | ".txt":
            return pd.read_csv(path, **kwargs)
        case ".tsv" | ".tab":
            return pd.read_csv(path, sep="\t", **kwargs)
        case ".parquet":
            return pd.read_parquet(path, **kwargs)
        case ".xlsx" | ".xls":
            return pd.read_excel(path, **kwargs)
        case ".json" | ".geojson":
            return pd.read_json(path, **kwargs)
        case other:
            raise ValueError(f"no loader for {other!r}")


def save(df: pd.DataFrame, name: str) -> Path:
    """Write to data/processed/ as parquet. Returns the path."""
    PROCESSED.mkdir(parents=True, exist_ok=True)
    out = PROCESSED / (name if name.endswith(".parquet") else f"{name}.parquet")
    df.to_parquet(out, index=False)
    return out

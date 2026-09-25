#!/usr/bin/env python
"""First look at a new dataset: what's there, how it's shaped, and whether the IDs join.

    python scripts/inspect_data.py data/raw/bayer
"""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

import pandas as pd

root = Path(sys.argv[1] if len(sys.argv) > 1 else "data/raw/bayer")
files = sorted(p for p in root.rglob("*") if p.is_file())
print(f"== {root}: {len(files)} files, {sum(p.stat().st_size for p in files) / 1e6:.1f} MB")
for d, n in Counter(str(p.parent.relative_to(root)) for p in files).most_common(12):
    print(f"   {n:6d} files in {d}/")
archives = [p for p in files if p.suffix.lower() in {".zip", ".gz", ".tar", ".7z"}]
if archives:
    print("   ARCHIVES (unzip first):", ", ".join(p.name for p in archives))

tables = [p for p in files if p.suffix.lower() in {".csv", ".tsv", ".txt"}]
geno = [p for p in tables if "imput" in p.name.lower() or "geno" in p.name.lower()]
others = [p for p in sorted(tables, key=lambda p: -p.stat().st_size) if p not in geno][:8]

for p in others:
    sep = "\t" if p.suffix.lower() in {".tsv", ".txt"} else ","
    try:
        df = pd.read_csv(p, sep=sep, nrows=5000, low_memory=False)
    except Exception as e:  # noqa: BLE001
        print(f"\n-- {p.name}: could not read ({e})")
        continue
    print(f"\n-- {p.relative_to(root)}  ({p.stat().st_size / 1e6:.1f} MB)  {df.shape[1]} columns")
    print("   columns:", ", ".join(map(str, df.columns[:40])) + (" ..." if df.shape[1] > 40 else ""))
    for c in df.columns:
        if str(c).upper() in {"YEAR", "LOC", "CLUSTER"}:
            print(f"   {c}: {sorted(df[c].dropna().unique().tolist())[:15]}")
    num = df.select_dtypes("number")
    if len(num.columns):
        print("   filled:", ", ".join(f"{c} {num[c].notna().mean():.0%}" for c in num.columns[:14]))
    idc = next((c for c in df.columns if str(c).upper() in {"LINE_UNIQUE_ID", "UID", "LINEUNIQUEID", "LINE", "HYBRID"}), None)
    if idc:
        print(f"   id column {idc!r}, e.g. {df[idc].dropna().astype(str).head(3).tolist()}")

if geno:
    print(f"\n== genotype files: {len(geno)} (e.g. {geno[0].relative_to(root)})")
    g = pd.read_csv(geno[0], index_col=0, nrows=60, low_memory=False)
    vals = Counter(v for col in g.columns[:500] for v in g[col].astype(str))
    total = sum(vals.values())
    print(f"   {g.shape[1]} markers; first rows: {list(map(str, g.index[:4]))}")
    print("   value counts:", {k: f"{v / total:.1%}" for k, v in vals.most_common(6)})
    zero = sum(v for k, v in vals.items() if k in {"0", "0.0"}) / total
    print(f"   share of 0 (unsettled spots): {zero:.1%}")

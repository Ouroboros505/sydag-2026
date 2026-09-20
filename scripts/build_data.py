#!/usr/bin/env python
"""Analysis -> public/*.json.

The app never computes what a script could precompute. Run this, commit the JSON,
and the front end reads it with loadJson() — which also means the demo works with
no network.

    npm run data          # or: python scripts/build_data.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

sys.path.insert(0, str(ROOT))


def write(name: str, payload) -> Path:
    """Write payload to public/<name>.json and report the size."""
    PUBLIC.mkdir(parents=True, exist_ok=True)
    out = PUBLIC / (name if name.endswith(".json") else f"{name}.json")
    out.write_text(json.dumps(payload, separators=(",", ":"), default=str))
    print(f"{out.relative_to(ROOT)}  {out.stat().st_size / 1024:.1f} KB")
    return out


def main() -> None:
    # Build the JSON the app needs here, e.g.:
    #   from analysis import data
    #   df = data.load("something.csv")
    #   write("something", df.to_dict(orient="records"))
    print("nothing to build yet — add it in main()")


if __name__ == "__main__":
    main()

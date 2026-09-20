"""Demo shell. Deliberately empty — build the real thing once the track is known.

Run:  streamlit run app/app.py
Its only job right now is to prove the toolchain works end to end.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import streamlit as st

st.set_page_config(page_title="SyDAg 2026", layout="wide")

st.title("SyDAg 2026")
st.caption("Team name / track — fill in Friday night.")

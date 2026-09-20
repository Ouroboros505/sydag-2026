"""Demo app. This is what the judges see — keep it runnable at ALL times.

Run:  streamlit run app/app.py
Rule: if `main` is broken, the demo is broken. Never push a non-running app.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd
import streamlit as st

from src import data, viz

st.set_page_config(page_title="SyDAg 2026", page_icon="*", layout="wide")


@st.cache_data(show_spinner=False)
def get_data(name: str) -> pd.DataFrame:
    return data.load(name)


# ---------------------------------------------------------------- sidebar
with st.sidebar:
    st.title("SyDAg 2026")
    st.caption("TEAM NAME — track TBD")
    files = sorted(p.name for p in data.RAW.rglob("*") if p.is_file() and not p.name.startswith("."))
    choice = st.selectbox("Dataset", files) if files else None
    if not files:
        st.info("Drop files into `data/raw/` to get started.")

# ---------------------------------------------------------------- body
st.title("Project title goes here")
st.markdown("**One sentence: who has the problem, and what this does about it.**")

tab_problem, tab_data, tab_model, tab_impact = st.tabs(
    ["Problem", "Data", "Solution", "Impact"]
)

with tab_problem:
    st.subheader("The problem")
    st.markdown(
        "- Who feels it (grower, agronomist, breeder, co-op)\n"
        "- What it costs them today, in dollars or acres or time\n"
        "- Why existing tools don't solve it"
    )

with tab_data:
    st.subheader("Data")
    if choice:
        df = get_data(choice)
        c1, c2, c3 = st.columns(3)
        c1.metric("Rows", f"{len(df):,}")
        c2.metric("Columns", f"{df.shape[1]:,}")
        c3.metric("Missing", f"{df.isna().mean().mean() * 100:.1f}%")
        st.dataframe(df.head(50), use_container_width=True)
        with st.expander("Column overview"):
            st.dataframe(data.overview(df), use_container_width=True)

with tab_model:
    st.subheader("What we built")
    st.markdown("_Interactive piece goes here — the thing a judge can click._")

with tab_impact:
    st.subheader("Why it matters")
    c1, c2, c3 = st.columns(3)
    c1.metric("Headline metric", "--", help="e.g. $/acre saved")
    c2.metric("Second metric", "--")
    c3.metric("Third metric", "--")
    st.caption("Numbers here are what the judges remember. Fill them in early, refine later.")

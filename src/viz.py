"""Shared plot styling, so the deck doesn't look like three different projects."""
from __future__ import annotations

import plotly.express as px
import plotly.graph_objects as go

# Muted, colorblind-safe, prints fine in a slide.
PALETTE = ["#2E7D5B", "#C97B2C", "#3A6EA5", "#8E5A9E", "#B5443B", "#6B7B8C"]

LAYOUT = dict(
    template="plotly_white",
    font=dict(family="Inter, Segoe UI, Helvetica, sans-serif", size=13),
    margin=dict(l=50, r=20, t=50, b=45),
    colorway=PALETTE,
    hoverlabel=dict(font_size=12),
)


def style(fig: go.Figure, title: str | None = None, y: str | None = None, x: str | None = None) -> go.Figure:
    fig.update_layout(**LAYOUT)
    if title:
        fig.update_layout(title=dict(text=title, x=0, xanchor="left", font=dict(size=16)))
    if x:
        fig.update_xaxes(title_text=x)
    if y:
        fig.update_yaxes(title_text=y)
    fig.update_xaxes(showgrid=False)
    fig.update_yaxes(gridcolor="#E8E8E8", zeroline=False)
    return fig


def bar(df, x, y, title=None, **kw):
    return style(px.bar(df, x=x, y=y, **kw), title, y=y, x=x)


def line(df, x, y, title=None, **kw):
    return style(px.line(df, x=x, y=y, markers=True, **kw), title, y=y, x=x)


def scatter(df, x, y, title=None, **kw):
    return style(px.scatter(df, x=x, y=y, **kw), title, y=y, x=x)

"""Shared plot styling, so three people's figures look like one deck."""
from __future__ import annotations

import plotly.graph_objects as go

# Muted, colorblind-safe, survives a projector.
PALETTE = ["#2E7D5B", "#C97B2C", "#3A6EA5", "#8E5A9E", "#B5443B", "#6B7B8C"]

LAYOUT = dict(
    template="plotly_white",
    font=dict(family="Inter, Segoe UI, Helvetica, sans-serif", size=13),
    margin=dict(l=50, r=20, t=50, b=45),
    colorway=PALETTE,
)


def style(fig: go.Figure, title: str | None = None) -> go.Figure:
    """Apply the team look to any plotly figure. Call it on everything."""
    fig.update_layout(**LAYOUT)
    if title:
        fig.update_layout(title=dict(text=title, x=0, xanchor="left", font=dict(size=16)))
    fig.update_xaxes(showgrid=False)
    fig.update_yaxes(gridcolor="#E8E8E8", zeroline=False)
    return fig

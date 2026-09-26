#!/usr/bin/env python
"""Fill the organizers' slide template with our current results -> docs/ProMaize_deck.pptx.

    python scripts/make_deck.py            # after build_data.py; rerun whenever numbers change

Reads public/recommendations.json, so the deck can never disagree with the demo. Charts are
native PowerPoint charts in the team palette (analysis/viz.py), editable by anyone. The
template is the organizers' "Template Presentation.pptx", found anywhere under data/raw/.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from analysis import data  # noqa: E402
from analysis.viz import PALETTE  # noqa: E402

TEAM = ["Alexander Baena", "Sofia Gerena", "Alen Lizarazo"]
DEMO_URL = "promaize.stipe.app"
GREY = RGBColor(0x55, 0x55, 0x55)


def rgb(hex_: str) -> RGBColor:
    return RGBColor.from_string(hex_.lstrip("#"))


def body(slide, title_ph) -> tuple[Emu, Emu, Emu, Emu]:
    """The free area under a slide's title."""
    left = title_ph.left
    top = title_ph.top + title_ph.height + Inches(0.15)
    return left, top, title_ph.width, Inches(7.5) - top - Inches(0.5)


def bullets(slide, box, lines: list[str | tuple[str, int]], size: int = 20) -> None:
    left, top, width, height = box
    tf = slide.shapes.add_textbox(left, top, width, height).text_frame
    tf.word_wrap = True
    for i, item in enumerate(lines):
        text, level = (item, 0) if isinstance(item, str) else item
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        bold = text.startswith("**")
        p.text = ("    " * level + ("- " if level else "")) + text.strip("*")
        p.font.size = Pt(size - 3 * level)
        p.font.bold = bold
        p.space_after = Pt(8)


def fmt(v, d=2):
    return "n/a" if v is None else f"{v:.{d}f}"


def main() -> None:
    rec = json.loads((ROOT / "public" / "recommendations.json").read_text())
    v, meta = rec["validation"], rec["meta"]
    tpl = data.find("Template Presentation.pptx")
    prs = Presentation(str(tpl))
    slides = list(prs.slides)
    title = {s.shapes.title.text.strip(): s for s in slides if s.shapes.title is not None}
    year = meta.get("held_out_year")
    by_year = v.get("by_year", [])
    head = next((y for y in by_year if y["year"] == year), None)
    strat = [r for r in v.get("strategies", []) if r["year"] == "mean" and r["budget"] == 0.3]

    # opening banner: our name on the organizers' art
    for sh in slides[0].shapes:
        if sh.has_text_frame and sh.text_frame.text.strip() == "SURVIVAL GUIDE":
            sh.text_frame.text = "ProMaize: which lines get the ground"
    s = title["Team Intro/Logo"]
    bullets(s, body(s, s.shapes.title), ["**Team ProMaize, Bayer Genomic Prediction track"] + TEAM +
            ["", f"Live demo: {DEMO_URL}"], 24)

    s = title["Intro to the problem"]
    fams = v.get("families_by_parents_on_record", {})
    bullets(s, body(s, s.shapes.title), [
        f"**January {year}: the plot budget is cut. {meta['n_candidates']:,} new lines are waiting.",
        f"They come from {head['n_families'] if head else '?'} biparental families that have never been in a field;"
        f" {fams.get('none', '?')} of those families have neither parent on record.",
        "The field test measures GCA: each line crossed to a tester from the other cluster, ~7 locations.",
        "Every line we cannot test is a line we can never advance. Which ones get the ground?",
        ("Users: pipeline managers (the budget), population development (which families), field testing (the list).", 1),
    ], 22)

    s = title["Analysis Goal"]
    bullets(s, body(s, s.shapes.title), [
        "**Rank lines nobody has grown by what they are worth, with an honest error bar.",
        "Predict broad-acre GCA: trial- and tester-adjusted testcross yield, moisture, maturity, lodging.",
        "Turn it into $/acre (yield x price - drying - lodging loss) at prices the breeder sets.",
        "Choose the plots: how many, which families, which siblings, and what that costs in breadth.",
        "Prove it the only honest way: predict each year's new families from earlier years only.",
    ], 22)

    s = title["Tech Stack"]
    bullets(s, body(s, s.shapes.title), [
        "**Python: numpy, pandas, scikit-learn. The model trains from sufficient statistics.",
        ("Full dataset (1.07M plots, 153k genotyped lines x 2,911 markers): about 3 minutes on a laptop.", 1),
        ("Anvil (RCAC) for the heavy runs; a synthetic judge-mode program runs end to end in about a minute.", 1),
        "**React + TypeScript + Vite, installable web app: the demo works with no network.",
        f"Hosted at {DEMO_URL}; every state is a URL (budget, family limit, prices).",
    ], 22)

    s = title["Technical Approach"]
    left, top, width, height = body(s, s.shapes.title)
    bullets(s, (left, top, int(width * 0.46), height), [
        "**Two questions, two models",
        "Family mean <- the parents' genotypes (ridge on the midparent, recent years weighted up).",
        "Sibling differences <- which parental segments each line inherited (ridge on within-family deviations).",
        "Tester effect removed as a BLUP: advance lines, not testers.",
        "**Baselines: environmental means, pedigree BLUP, standard GBLUP.",
    ], 18)
    if by_year:
        cd = CategoryChartData()
        cd.categories = [str(y["year"]) for y in by_year]
        cd.add_series("ProMaize", [y["r"] for y in by_year])
        cd.add_series("standard GBLUP", [y["r_gblup"] for y in by_year])
        cd.add_series("pedigree BLUP", [y["r_pedigree"] for y in by_year])
        ch = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, left + int(width * 0.5), top,
                                int(width * 0.5), height, cd).chart
        ch.has_legend = True
        ch.legend.position = XL_LEGEND_POSITION.BOTTOM
        ch.legend.include_in_layout = False
        ch.has_title = True
        ch.chart_title.text_frame.text = "Forward accuracy (r), each year's new families"
        for i, ser in enumerate(ch.series):
            ser.format.fill.solid()
            ser.format.fill.fore_color.rgb = rgb((PALETTE[0], PALETTE[5], PALETTE[1])[i])

    s = title["Demo/Prototype"]
    left, top, width, height = body(s, s.shapes.title)
    shot = ROOT / "docs" / "screens" / "demo.png"
    if shot.exists():
        s.shapes.add_picture(str(shot), left, top, height=height - Inches(0.4))
    bullets(s, (left, top + height - Inches(0.4), width, Inches(0.4)), [f"Live: {DEMO_URL}"], 16)

    s = title["Business Value"]
    left, top, width, height = body(s, s.shapes.title)
    lines = [f"**Scored on what the field did, every year {by_year[0]['year']}-{by_year[-1]['year']} (plant 30% of lines):"] if by_year else []
    for r in strat:
        lines.append((f"{r['strategy']}: ${r['gain']:.1f}/acre over random, keeps {r['top10_kept']:.0%} of the real top 10%", 1))
    lines += [
        f"**Honest error bars: the 90% bands held {v.get('coverage90', 0):.0%} of real {year} results.",
        f"**{year} was the hardest year on record for new families, and ProMaize still doubled standard GBLUP"
        f" (r {fmt(head['r'] if head else None)} vs {fmt(head['r_gblup'] if head else None)}).",
    ]
    bullets(s, (left, top, width, height), lines, 18)

    s = title["Future Development"]
    bullets(s, body(s, s.shapes.title), [
        "**Location-specific placement once lines have multi-year records (today each line is tested once).",
        "Choose crosses, not only lines: predict each family's mean and spread before it is made.",
        "The program's own costs: plot, drying, and discount schedules in place of our defaults.",
        "Multi-trait economic index with test weight and maturity windows per market.",
    ], 22)

    out = ROOT / "docs" / "ProMaize_deck.pptx"
    prs.save(str(out))
    print(f"{out.relative_to(ROOT)} written from {tpl.name}")


if __name__ == "__main__":
    main()

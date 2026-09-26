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


SLIDE_W, SLIDE_H = Inches(13.333), Inches(7.5)
TEXT = RGBColor(0x22, 0x22, 0x22)


def body(slide, title_ph) -> tuple[Emu, Emu, Emu, Emu]:
    """The free area under a slide's title, full slide width."""
    left = title_ph.left
    top = title_ph.top + title_ph.height + Inches(0.2)
    return left, top, SLIDE_W - 2 * left, SLIDE_H - top - Inches(0.45)


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
        p.font.color.rgb = TEXT if (bold or not level) else GREY   # the template's default text is white
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
            sh.text_frame.text = "ProMaize"
    s = title["Team Intro/Logo"]
    bullets(s, body(s, s.shapes.title), ["**Team ProMaize, Bayer Genomic Prediction track"] + TEAM +
            ["", f"Live demo: {DEMO_URL}"], 24)

    s = title["Intro to the problem"]
    fams = v.get("families_by_parents_on_record", {})
    left, top, width, height = body(s, s.shapes.title)
    ped = [y for y in by_year if y.get("families_none") is not None]
    if ped:
        # the structure of the data that drives the answer: every season is new families, and in some
        # of them most parents have never been tested
        cd = CategoryChartData()
        cd.categories = [str(y["year"]) for y in ped]
        cd.add_series("both parents on record", [y["families_both"] for y in ped])
        cd.add_series("one", [y["families_one"] for y in ped])
        cd.add_series("neither", [y["families_none"] for y in ped])
        ch = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_STACKED, left + int(width * 0.55), top, int(width * 0.45),
                                height, cd).chart
        ch.has_title = True
        ch.chart_title.text_frame.text = "Every season is new families; parents on record?"
        ch.has_legend = True
        ch.legend.position = XL_LEGEND_POSITION.BOTTOM
        ch.legend.include_in_layout = False
        ch.font.size = Pt(13)
        ch.font.color.rgb = TEXT
        for i, ser in enumerate(ch.series):
            ser.format.fill.solid()
            ser.format.fill.fore_color.rgb = rgb((PALETTE[0], PALETTE[5], PALETTE[1])[i])
        width = int(width * 0.53)
    bullets(s, (left, top, width, height), [
        f"**January {year}: the plot budget is cut. {meta['n_candidates']:,} new lines are waiting.",
        f"They come from {head['n_families'] if head else '?'} biparental families that have never been in a field;"
        f" {fams.get('none', '?')} of those families have neither parent on record.",
        "The field test measures GCA: each line crossed to a tester from the other cluster, ~7 locations.",
        "Every line we cannot test is a line we can never advance. Which ones get the ground?",
        ("Users: pipeline managers (the budget), population development (which families), field testing (the list).", 1),
    ], 20)

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
        ("Full dataset (1.07M plots, 153k genotyped lines x 2,911 markers): about 5 minutes on a laptop.", 1),
        ("On Anvil (RCAC), from the raw files: 3.5 minutes on one node, every number reproduced.", 1),
        ("A synthetic judge-mode program runs the whole pipeline in about ten seconds.", 1),
        "**React + TypeScript + Vite, installable web app: the demo works with no network.",
        f"Hosted at {DEMO_URL}; every state is a URL (budget, family limit, prices).",
    ], 22)

    s = title["Technical Approach"]
    left, top, width, height = body(s, s.shapes.title)
    bullets(s, (left, top, int(width * 0.46), height), [
        "**Two questions, two models",
        "Family mean <- what the parents passed on (the family's mean genotype; ridge, recent years weighted up).",
        "Sibling differences <- which parental segments each line inherited (ridge on within-family deviations).",
        "Tester effect removed as a BLUP: advance lines, not testers.",
        "**Baselines: environmental means, pedigree BLUP, standard GBLUP.",
    ] + ([f"**Broad-acre, tested: location response predicted at r = {fmt(v['location_specific']['r_history'])}"
          f" ({v['location_specific']['n_plots']:,} held-out plots)."] if v.get("location_specific") else []), 18)
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
        ch.font.size = Pt(14)
        ch.font.color.rgb = TEXT
        for i, ser in enumerate(ch.series):
            ser.format.fill.solid()
            ser.format.fill.fore_color.rgb = rgb((PALETTE[0], PALETTE[5], PALETTE[1])[i])

    s = title["Demo/Prototype"]
    left, top, width, height = body(s, s.shapes.title)
    shot = ROOT / "docs" / "screens" / "1-default.png"
    pic_w = 0
    if shot.exists():
        pic = s.shapes.add_picture(str(shot), left, top, height=height - Inches(0.5))
        pic_w = pic.width
    bullets(s, (left, top + height - Inches(0.4), width, Inches(0.4)), [f"Live: {DEMO_URL}"], 16)
    bullets(s, (left + pic_w + Inches(0.3), top, width - pic_w - Inches(0.3), height - Inches(0.5)), [
        "**In the order we show it",
        "The strip: every number from seasons the model never saw.",
        f"What {year} actually said: the ranking, scored on the real field.",
        "Which way to spend the plots: six rules, six seasons.",
        "The list: every line with $/acre, 90% band, confidence; CSV.",
        "Allocation: rank all lines, or the same share per family.",
        "How much to trust this: forward tests, baselines, bands.",
        "**Works offline, on a phone; every state is a URL.",
    ], 16)

    s = title["Business Value"]
    left, top, width, height = body(s, s.shapes.title)
    bullets(s, (left, top, width, Inches(0.5)), [
        f"**Same plots (30% of lines), six ways, scored on what the field paid, {by_year[0]['year']}-{by_year[-1]['year']}"
        if by_year else "**Same plots, six ways, scored on what the field paid"], 18)
    y08 = {r["strategy"]: r for r in v.get("strategies", []) if r["year"] == year and r["budget"] == 0.3}
    rows_ = sorted(strat, key=lambda r: -r["gain"])
    tbl = s.shapes.add_table(len(rows_) + 1, 4, left, top + Inches(0.55), int(width * 0.78), Inches(0.34) * (len(rows_) + 1)).table
    heads = ["Rule", "Realised $/acre over random (6-year mean)", f"in {year}", "Real top 10% kept"]
    for j, t_ in enumerate(heads):
        tbl.cell(0, j).text = t_
    for i, r in enumerate(rows_, start=1):
        vals = [r["strategy"], f"${r['gain']:.1f}", f"${y08.get(r['strategy'], {}).get('gain', 0):.1f}", f"{r['top10_kept']:.0%}"]
        for j, t_ in enumerate(vals):
            tbl.cell(i, j).text = t_
    tbl.columns[0].width = int(width * 0.34)
    for j in range(1, 4):
        tbl.columns[j].width = int(width * 0.148)
    tbl.rows[0].height = Inches(0.6)
    for i in range(1, len(rows_) + 1):
        tbl.rows[i].height = Inches(0.34)
    for i in range(len(rows_) + 1):
        ours = i > 0 and rows_[i - 1]["strategy"] == "ProMaize, rank by $/acre"
        for j in range(4):
            cell = tbl.cell(i, j)
            cell.fill.solid()
            cell.fill.fore_color.rgb = rgb(PALETTE[0]) if i == 0 else (RGBColor(0xDD, 0xEE, 0xE5) if ours else RGBColor(0xF6, 0xF6, 0xF4))
            for p in cell.text_frame.paragraphs:
                p.font.size = Pt(13)
                p.font.bold = i == 0 or ours
                p.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF) if i == 0 else TEXT
    table_bottom = top + Inches(0.55) + Inches(0.6) + Inches(0.34) * len(rows_)
    match = v.get("plots_to_match") or []
    even = y08.get("ProMaize, same share of every family"); rank = y08.get("ProMaize, rank by $/acre")
    even_cost = rank["gain"] - even["gain"] if even and rank else None
    even_fam, rank_fam = (even or {}).get("eff_families") or 0, (rank or {}).get("eff_families") or 0
    needs = sum(m["standard_needs"] for m in match) / len(match) if match else None
    bullets(s, (left, table_bottom + Inches(0.15), width, Inches(1.4)), ([
        f"**In plots: to keep the real winners ProMaize keeps with 30% of lines, standard GBLUP had to plant"
        f" {needs:.0%} of them.", ] if needs else []) + [
        f"**Honest error bars: the 90% bands held {v.get('coverage90', 0):.0%} of real {year} results.",
    ] + ([f"**Recommendation for {year}: the same share of every family, markers pick the siblings. With pedigree"
          f" this thin, breadth is nearly free: ${even_cost:.2f}/acre for {even_fam:.0f} families instead of {rank_fam:.0f}."]
         if even_cost is not None else []), 15)

    s = title["Future Development"]
    bullets(s, body(s, s.shapes.title), [
        "**Location-specific placement once lines have multi-year records (today each line is tested once).",
        "Choose crosses, not only lines: predict each family's mean and spread before it is made.",
        "The program's own costs: plot, drying, and discount schedules in place of our defaults.",
        "Multi-trait economic index with test weight and maturity windows per market.",
    ], 22)

    # speaker notes: the pitch (docs/pitch.md), slide by slide, numbers from the same JSON
    ly = {r["strategy"]: r for r in v.get("strategies", []) if r["year"] == "mean" and r["budget"] == 0.3}
    ours, std = ly.get("ProMaize, rank by $/acre"), ly.get("standard GBLUP, rank by bushels")
    lift = f"{ours['gain'] / std['gain'] - 1:.0%}" if ours and std and std["gain"] > 0 else "n/a"
    m08 = next((m for m in v.get("plots_to_match", []) if m["year"] == year), None)
    notes = {
        "Intro to the problem": f"January {year}. The plot budget has been cut. {meta['n_candidates']:,} new lines are waiting, "
            "from families that have never been in a field (the chart: every season is new families, and in some most "
            "parents are untested). Every line we don't plant is a line we can never advance. ProMaize decides which "
            "lines get the ground, in dollars per acre, and says how far to trust it. (30 s, then go live)",
        "Analysis Goal": "This program tests every family once, in one year. A model that learns 'which families were good' "
            "has nothing to say about next year's families: they are all new. So we split the question the way a breeder "
            "does: the family's mean from what its parents passed on, the sibling from which parental segments it inherited. "
            "Then price it in dollars per acre. (30 s)",
        "Tech Stack": "Not shown in the 4 minutes; for Q&A: five minutes on a laptop from the raw files, 3.5 on one "
            "Anvil node, a static web app that works with no network.",
        "Technical Approach": f"Point at the chart. Each bar is a separate forward test: that year's families predicted from "
            f"earlier years only. We beat standard GBLUP in all six seasons; in {year} we double it, "
            f"r {fmt(head['r'] if head else None)} vs {fmt(head['r_gblup'] if head else None)}. The same data under a random "
            f"k-fold reads {fmt(v.get('leaky_r'))}: that is siblings in training, and we show it so nobody mistakes one for "
            "the other. (45 s)",
        "Demo/Prototype": "Not shown in the 4 minutes: go live instead. 1) The strip (15 s). 2) What "
            f"{year} actually said (30 s). 3) Which way to spend the plots: aggressive vs conservative (35 s). 4) The "
            "pedigree chart, then click 'conservative' (25 s). 5) The list, hover a $/acre cell (15 s). 6) Trust (15 s).",
        "Business Value": f"Same plots, six rules, six seasons, scored on what the field paid. The standard approach realised "
            f"${std['gain']:.1f} an acre over random; ours ${ours['gain']:.1f}: {lift} more value from the same plots. "
            + (f"In plots: the standard ranking needed {m08['lines_saved']:,} more lines in {year} to keep the same winners. "
               if m08 else "")
            + f"Recommendation for {year}: the conservative plan, the same share of every family, DNA picking the "
            "siblings: 4,789 lines in docs/advance_2008.csv, with a one-page memo for the breeding lead. We need from "
            "them: their plot budget, their drying costs, and confirmation that lines are judged on GCA. (45 s)",
        "Future Development": "Limits first: the family call is weak in a year like 2008; lodging is barely predictable from "
            "DNA; costs are sliders with typical values. Next: choose crosses, not only lines; location placement once lines "
            "have multi-year records; the program's own costs. (30 s)",
    }
    for s_ in prs.slides:
        t_ = s_.shapes.title.text.strip() if s_.shapes.title is not None else ""
        if t_ in notes:
            s_.notes_slide.notes_text_frame.text = notes[t_]

    out = ROOT / "docs" / "ProMaize_deck.pptx"
    prs.save(str(out))
    print(f"{out.relative_to(ROOT)} written from {tpl.name}")


if __name__ == "__main__":
    main()

import { useMemo, useState } from 'react'

const usd = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/* ---------------------------------------------------------------- 9. bushels -> dollars */

export function MoneyLine() {
  const [yld, setYld] = useState(180)
  const [mst, setMst] = useState(19)
  const [lodg, setLodg] = useState(8)
  const price = 4.5
  const dryPerPoint = 0.045
  const target = 15.5
  const loss = 0.5
  const gross = yld * price
  const drying = Math.max(0, mst - target) * dryPerPoint * yld
  const lodging = (lodg / 100) * loss * yld * price
  const net = gross - drying - lodging
  const pct = (v: number) => `${(v / gross) * 100}%`
  return (
    <div>
      <div className="three">
        <label className="field">Yield <b>{yld} bu/ac</b>
          <input type="range" min={140} max={220} value={yld} onChange={(e) => setYld(+e.target.value)} /></label>
        <label className="field">Moisture at harvest <b>{mst}%</b>
          <input type="range" min={14} max={26} step={0.5} value={mst} onChange={(e) => setMst(+e.target.value)} /></label>
        <label className="field">Plants fallen over <b>{lodg}%</b>
          <input type="range" min={0} max={40} value={lodg} onChange={(e) => setLodg(+e.target.value)} /></label>
      </div>
      <div className="money">
        <div className="mbar" role="img" aria-label="Gross value split into net, drying cost and lodging loss">
          <div className="seg net" style={{ width: pct(net) }} />
          <div className="seg dry" style={{ width: pct(drying) }} />
          <div className="seg lodg" style={{ width: pct(lodging) }} />
        </div>
        <div className="mrows">
          <div><span>{yld} bu × ${price.toFixed(2)}</span><b>{usd(gross)}</b></div>
          <div><span><i className="sw dry" />drying {Math.max(0, mst - target).toFixed(1)} points down to {target}%</span><b>−{usd(drying)}</b></div>
          <div><span><i className="sw lodg" />lost to fallen plants</span><b>−{usd(lodging)}</b></div>
          <div className="total"><span><i className="sw net" />what the acre is worth</span><b>{usd(net)}</b></div>
        </div>
      </div>
      <p className="explain">
        A <b>bushel</b> is the US unit corn is sold in, about 25 kg. Yield is <b>bushels per acre</b> (~180 is a good field,
        about 11 tonnes per hectare). But corn is harvested wet, and wet corn has to be dried with gas before it can be
        stored: every point of moisture costs money. And plants that fall over (<b>lodging</b>) can't be harvested
        properly. So two lines with the same bushels can be worth very different money. Drag moisture to 24% and watch.
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------- 10. the decision */

type Cand = { id: string; fam: string; bu: number; usd: number }
const CANDS: Cand[] = [
  { id: 'C1.7.1', fam: 'C1.7', bu: 188, usd: 790 },
  { id: 'C1.7.3', fam: 'C1.7', bu: 186, usd: 785 },
  { id: 'C1.7.5', fam: 'C1.7', bu: 185, usd: 781 },
  { id: 'C1.7.6', fam: 'C1.7', bu: 184, usd: 776 },
  { id: 'C1.9.2', fam: 'C1.9', bu: 191, usd: 742 },
  { id: 'C1.9.4', fam: 'C1.9', bu: 189, usd: 735 },
  { id: 'C1.11.1', fam: 'C1.11', bu: 179, usd: 770 },
  { id: 'C1.11.3', fam: 'C1.11', bu: 176, usd: 758 },
  { id: 'C1.12.2', fam: 'C1.12', bu: 181, usd: 766 },
  { id: 'C1.12.5', fam: 'C1.12', bu: 172, usd: 731 },
  { id: 'C1.14.1', fam: 'C1.14', bu: 174, usd: 749 },
  { id: 'C1.14.2', fam: 'C1.14', bu: 169, usd: 722 },
]
const FAM_CLASS: Record<string, string> = { 'C1.7': 'f1', 'C1.9': 'f2', 'C1.11': 'f3', 'C1.12': 'f4', 'C1.14': 'f5' }

export function DecisionToy() {
  const [plots, setPlots] = useState(4)
  const [by, setBy] = useState<'usd' | 'bu'>('bu')
  const [limit, setLimit] = useState(false)
  const chosen = useMemo(() => {
    const sorted = [...CANDS].sort((a, b) => (by === 'usd' ? b.usd - a.usd : b.bu - a.bu))
    const n = new Map<string, number>()
    const out: string[] = []
    for (const c of sorted) {
      if (out.length >= plots) break
      if (limit && (n.get(c.fam) ?? 0) >= 2) continue
      out.push(c.id); n.set(c.fam, (n.get(c.fam) ?? 0) + 1)
    }
    return new Set(out)
  }, [plots, by, limit])
  const picked = CANDS.filter((c) => chosen.has(c.id))
  const fams = new Set(picked.map((c) => c.fam))
  const avgUsd = picked.reduce((s, c) => s + c.usd, 0) / (picked.length || 1)
  return (
    <div>
      <div className="three">
        <label className="field">Plots this season <b>{plots}</b>
          <input type="range" min={1} max={10} value={plots} onChange={(e) => setPlots(+e.target.value)} /></label>
        <div className="field">Rank by
          <div className="toggle">
            <button className={by === 'bu' ? 'on' : ''} onClick={() => setBy('bu')}>bushels</button>
            <button className={by === 'usd' ? 'on' : ''} onClick={() => setBy('usd')}>dollars</button>
          </div>
        </div>
        <div className="field">Family limit
          <div className="toggle">
            <button className={!limit ? 'on' : ''} onClick={() => setLimit(false)}>none</button>
            <button className={limit ? 'on' : ''} onClick={() => setLimit(true)}>max 2 per family</button>
          </div>
        </div>
      </div>
      <div className="cands">
        {CANDS.map((c) => (
          <div key={c.id} className={'cand ' + (chosen.has(c.id) ? 'in' : 'out')}>
            <span className={'famtag ' + FAM_CLASS[c.fam]}>{c.fam}</span>
            <span className="mono">{c.id}</span>
            <span className="small">{c.bu} bu</span>
            <span className="small">{usd(c.usd)}/ac</span>
          </div>
        ))}
      </div>
      <div className="verdict strong">
        {plots} plots · average <b>{usd(avgUsd)}/ac</b> · <b>{fams.size}</b> famil{fams.size === 1 ? 'y' : 'ies'} represented
      </div>
      <p className="explain">
        Try it: rank by <b>bushels</b> and C1.9's high-yield lines win, but they're wet and fall over, so they're worth less.
        Switch to <b>dollars</b> and the list changes: that's ProMaize's main idea. Then look at the families: ranking hard
        puts most plots into C1.7. Turn on the <b>family limit</b> and the choice gets broader, for a small cost. A breeder
        needs variety: next year's crosses come from this year's winners.
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------- glossary */

export const GLOSSARY: [string, string][] = [
  ['Line', 'A pure breed of corn: plant its seeds and every plant comes out the same. Even purer than a dog breed, every plant is basically an identical twin.'],
  ['Self-pollination (selfing)', 'A plant making seed with its own pollen. Do it for about six seasons and the plant settles into a line.'],
  ['F1, F2', 'F1 = the first-generation plants of a cross (all alike). F2 = their offspring after selfing (all different: the genes get reshuffled).'],
  ['Doubled haploid', 'The lab shortcut: grow a plant with just one copy of its DNA, then make it photocopy it. Both copies match, so it is a settled line in one step instead of six seasons.'],
  ['Breeding cycle', 'Lines in a pool are crossed, the kids are tested, and the winners become next year\'s parents.'],
  ['Inbred', 'A line made pure by self-pollinating for generations, so both copies of every chromosome match. Weaker on its own; valuable as a parent.'],
  ['Hybrid', 'A crossbreed of two pure breeds (lines) from different pools. What farmers actually plant. Much more vigorous than either parent, and every seed from that cross comes out the same.'],
  ['Pool (cluster)', 'A gene pool kept apart on purpose (breeders say heterotic group). US corn has three big ones; this dataset uses two, C1 and C2. New lines are made within a pool; hybrids across pools.'],
  ['Family (population)', 'All the kids of one cross between two parents. Siblings.'],
  ['Candidate', 'A new line from this year\'s families. DNA known, never field-tested. The thing we rank.'],
  ['Tester', 'One fixed, proven line from the other pool. Every candidate is crossed with it so they can be compared fairly.'],
  ['Testcross', 'Candidate × tester. The hybrid that actually gets planted to score a candidate.'],
  ['Test hybrid', 'The seed from crossing a kid with the tester. Planted once, measured, then discarded, like a blood sample. The results are filed under the kid.'],
  ['Combining ability (GCA)', 'How good a line is as a parent: how well its hybrids do, on average. It is what the field test really measures, and what the model predicts. Bayer\'s brief calls this stage a "GCA assessment".'],
  ['Plot', 'A small strip of field for one testcross at one location. The scarce, expensive resource.'],
  ['Advance', 'Keep testing a line next season. Lines not advanced are dropped.'],
  ['Marker (SNP), the M in M1', 'One position in the genome where lines differ by a single letter. Datasets like this one have a few thousand.'],
  ['Allele / version', 'One of the two letters that can appear at a marker.'],
  ['Genotype code', '−1 / 0 / +1: two copies of version 1, one of each, two copies of version 2.'],
  ['Bushel (bu)', 'US unit for grain, about 25 kg of corn. Prices are per bushel.'],
  ['bu/ac', 'Bushels per acre, the US way to express yield. 180 bu/ac ≈ 11 t/ha.'],
  ['YLD_BE', 'The yield column in the Bayer data, in bushels per acre (most likely adjusted to a standard moisture so plots compare fairly).'],
  ['MST', 'Grain moisture at harvest, %.'],
  ['STLP / RTLP', 'Stalk lodging / root lodging: % of plants broken at the stalk, or tipped over at the root.'],
  ['TWT', 'Test weight: how heavy a fixed volume of grain is. A quality measure.'],
  ['PHT / EHT', 'Plant height / ear height.'],
  ['Moisture', 'Water in the grain at harvest. Above ~15.5% it has to be dried, which costs money.'],
  ['Lodging', 'Plants falling over, at the stalk or the root. Fallen corn is partly lost at harvest.'],
  ['Genomic prediction', 'Predicting how a line will perform from its DNA, using past lines where both DNA and results are known.'],
  ['Ridge regression / GBLUP', 'The standard model for that: one small weight per marker, kept small on purpose so thousands of markers don\'t overfit. The two names are the same maths.'],
  ['r (correlation)', 'How well predictions rank the truth. 1 = perfect, 0 = coin flip. Honest values here are ~0.15.'],
  ['Leakage', 'Accidentally testing on relatives of training lines. Makes a model look far better than it is.'],
]

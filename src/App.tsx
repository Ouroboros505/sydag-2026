import { useEffect, useMemo, useState } from 'react'
import CandidateTable from './components/CandidateTable'
import Controls from './components/Controls'
import Breadth from './components/Breadth'
import Frontier from './components/Frontier'
import GenomicMap from './components/GenomicMap'
import Scenarios from './components/Scenarios'
import StatTiles from './components/StatTiles'
import ThemeToggle from './components/ThemeToggle'
import { loadJson } from './lib/data'
import { advanceOrder, backtest, byYieldOrder, captureCurve, evenShare, frontier, meanOf, score, summarize, type Prices } from './lib/econ'
import type { Recommendations } from './lib/types'
import Backtest from './components/Backtest'
import Validation from './components/Validation'
import Strategies from './components/Strategies'
import Evidence from './components/Evidence'
import Pedigree from './components/Pedigree'

export default function App() {
  const [data, setData] = useState<Recommendations | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prices, setPrices] = useState<Prices | null>(null)
  const [budget, setBudget] = useState(300)
  const [cap, setCap] = useState(Infinity)
  const [even, setEven] = useState(false)   // same share of every family, instead of a ranking across them

  useEffect(() => {
    loadJson<Recommendations>('recommendations.json')
      .then((d) => {
        const q = new URLSearchParams(location.search)
        const num = (k: string, fallback: number) => {
          const v = Number(q.get(k))
          return q.has(k) && Number.isFinite(v) ? v : fallback
        }
        const p = d.price_defaults
        setData(d)
        setPrices({
          corn_price: num('price', p.corn_price),
          drying_cost_per_point: num('drying', p.drying_cost_per_point),
          target_moisture: num('target', p.target_moisture),
          lodging_loss_fraction: num('lodging', p.lodging_loss_fraction),
        })
        // default: a 30% plot budget, the scenario's 'significantly reduced' season
        setBudget(Math.min(num('budget', Math.round(d.candidates.length * 0.3 / 10) * 10), d.candidates.length))
        setCap(num('cap', Infinity))
        setEven(q.get('even') === '1')
      })
      .catch((e) => setError(String(e)))
  }, [])

  const scored = useMemo(() => (data && prices ? score(data.candidates, prices) : []), [data, prices])
  const maxFamily = useMemo(() => {
    const n = new Map<string, number>()
    for (const c of scored) n.set(c.family, (n.get(c.family) ?? 0) + 1)
    return Math.max(1, ...n.values())
  }, [scored])
  const reachable = useMemo(() => (even ? scored.length : advanceOrder(scored, cap).length), [scored, cap, even])
  const k = Math.min(budget, reachable)
  const curve = useMemo(
    () => (scored.length ? frontier(scored, cap, Math.max(1, Math.floor(scored.length / 200))) : []),
    [scored, cap],
  )
  const summary = useMemo(() => (scored.length ? summarize(scored, k, cap, even) : null), [scored, k, cap, even])
  const yieldList = useMemo(
    () => (even ? evenShare(byYieldOrder(scored), k) : advanceOrder(byYieldOrder(scored), cap).slice(0, k)),
    [scored, cap, k, even],
  )
  const yieldSet = useMemo(() => new Set(yieldList.map((c) => c.id)), [yieldList])
  const advancedIds = useMemo(() => new Set(summary?.advanced.map((c) => c.id) ?? []), [summary])
  const bt = useMemo(
    () => (summary && prices ? backtest(scored, summary.advanced, yieldList, prices) : null),
    [scored, summary, yieldList, prices],
  )
  const heldOut = data?.meta.held_out_year ?? null
  const curve10 = useMemo(() => (prices && heldOut ? captureCurve(scored, prices) : []), [scored, prices, heldOut])
  const maturity = useMemo(() => {
    if (!summary) return null
    const hasActual = scored.some((c) => c.actual_erm != null)
    const f = hasActual ? (c: { actual_erm?: number }) => c.actual_erm : (c: { pred_erm?: number }) => c.pred_erm
    const all = meanOf(scored, f)
    if (all == null) return null
    const m = meanOf(summary.advanced, f)
    const y = meanOf(yieldList, f)
    return { cohort: all, byMargin: m == null ? null : m - all, byYield: y == null ? null : y - all,
      source: hasActual ? 'actual' as const : 'predicted' as const }
  }, [scored, summary, yieldList])

  if (error) return <main><p>Could not load recommendations.json: {error}</p></main>
  if (!data || !prices || !summary) return <main><p className="muted">Loading…</p></main>

  return (
    <main>
      <header>
        <h1>ProMaize</h1>
        <span className="sub">trial planner · which lines get the ground this season</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {data.meta.synthetic && <span className="banner" style={{ marginLeft: 0 }}>synthetic placeholder data</span>}
          <a className="pill" href="/learn/" title="The breeding problem, the data and the model, explained from zero">
            New to breeding? How this works →
          </a>
          <ThemeToggle />
        </span>
      </header>
      <p className="lede">
        {data.meta.n_candidates.toLocaleString()} candidate lines
        {heldOut
          ? <>, the real {heldOut} cohort, ranked as it stood in January {heldOut} before any of them was planted,</>
          : <>, none of them field-tested yet,</>}{' '}
        and plots for {k.toLocaleString()}. Predictions come from markers and parentage; the ranking is by{' '}
        <b>dollars per acre</b>, not bushels: yield after drying cost and lodging loss at the prices you set.
      </p>

      <Evidence v={data.validation} heldOut={heldOut} />

      <div className="layout">
        <Controls
          n={scored.length} budget={budget} cap={cap} maxFamily={maxFamily} prices={prices} even={even}
          onBudget={setBudget} onCap={(c) => { setCap(c); setEven(false) }} onPrices={setPrices} onEven={setEven}
        />
        <div className="stack">
          {k < budget && (
            <p className="muted" style={{ margin: 0 }}>
              The family limit leaves only {k.toLocaleString()} eligible lines. Loosen it or lower the budget.
            </p>
          )}
          <StatTiles {...summary} capped={even || Number.isFinite(cap)} />
          {bt && heldOut && <Backtest bt={bt} year={heldOut} k={k} curve={curve10} maturity={maturity} />}
          {data.validation.strategies && data.validation.strategies.length > 0 && (
            <Strategies rows={data.validation.strategies} heldOut={heldOut} match={data.validation.plots_to_match} />
          )}
          {data.validation.by_year && <Pedigree years={data.validation.by_year} heldOut={heldOut} />}
          <CandidateTable advanced={summary.advanced} yieldSet={yieldSet} prices={prices} />
          <Validation v={data.validation} baselines={data.baselines} notes={data.meta.notes} heldOut={heldOut} />
          <Breadth scored={scored} budget={k} cap={cap} even={even} onCap={(c) => { setCap(c); setEven(false) }} onEven={() => setEven(true)} />
          <details className="more">
            <summary>More tools: the budget curve, price scenarios, the genomic map</summary>
            <div className="stack" style={{ marginTop: 12 }}>
              <Frontier points={curve} budget={k} onBudget={setBudget} />
              <Scenarios candidates={data.candidates} prices={prices} budget={k} cap={cap} even={even} />
              <GenomicMap all={scored} advanced={advancedIds} />
            </div>
          </details>
        </div>
      </div>
    </main>
  )
}

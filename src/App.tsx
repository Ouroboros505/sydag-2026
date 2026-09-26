import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import CandidateTable from './components/CandidateTable'
import Controls from './components/Controls'
import Breadth from './components/Breadth'
import Frontier from './components/Frontier'
import GenomicMap from './components/GenomicMap'
import Scenarios from './components/Scenarios'
import StatTiles from './components/StatTiles'
import ThemeToggle from './components/ThemeToggle'
import { loadJson } from './lib/data'
import { advanceOrder, backtest, backtestBase, byYieldOrder, captureCurve, evenShare, frontier, meanOf, score, summarize, withEngine, type Prices } from './lib/econ'
import type { EngineId, Recommendations } from './lib/types'
import Backtest from './components/Backtest'
import Validation from './components/Validation'
import Strategies from './components/Strategies'
import Evidence from './components/Evidence'
import Pedigree from './components/Pedigree'
import TestSites from './components/TestSites'

export default function App() {
  const [data, setData] = useState<Recommendations | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prices, setPrices] = useState<Prices | null>(null)
  const [budget, setBudget] = useState(300)
  const [cap, setCap] = useState(Infinity)
  const [even, setEven] = useState(false)   // same share of every family, instead of a ranking across them
  const [engine, setEngine] = useState<EngineId>('family')

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
        const e = q.get('engine')
        if (d.validation.engines?.some((x) => x.id === e)) setEngine(e as EngineId)
      })
      .catch((e) => setError(String(e)))
  }, [])

  // The controls move with the immediate values; the heavy recalculation uses deferred copies, so a
  // slider never waits for 16k lines to be re-ranked (React renders the slider first, the rest after).
  const dPrices = useDeferredValue(prices)
  const dBudget = useDeferredValue(budget)
  const dCap = useDeferredValue(cap)
  const dEven = useDeferredValue(even)
  const dEngine = useDeferredValue(engine)
  const stale = dPrices !== prices || dBudget !== budget || dCap !== cap || dEven !== even || dEngine !== engine
  const [moreOpen, setMoreOpen] = useState(false)
  const onCap = useCallback((c: number) => { setCap(c); setEven(false) }, [])
  const onEvenOn = useCallback(() => setEven(true), [])

  const half90 = data?.validation.engines?.find((e) => e.id === dEngine)?.half90
  const cands = useMemo(() => (data ? withEngine(data.candidates, dEngine, half90) : []), [data, dEngine, half90])
  const nFamilies = useMemo(() => new Set(data?.candidates.map((c) => c.family)).size, [data])
  const scored = useMemo(() => (dPrices ? score(cands, dPrices) : []), [cands, dPrices])
  const byYield = useMemo(() => byYieldOrder(scored), [scored])
  const maxFamily = useMemo(() => {
    const n = new Map<string, number>()
    for (const c of scored) n.set(c.family, (n.get(c.family) ?? 0) + 1)
    return Math.max(1, ...n.values())
  }, [scored])
  const reachable = useMemo(() => (dEven ? scored.length : advanceOrder(scored, dCap).length), [scored, dCap, dEven])
  const k = Math.min(dBudget, reachable)
  const curve = useMemo(
    () => (moreOpen && scored.length ? frontier(scored, dCap, Math.max(1, Math.floor(scored.length / 200)), byYield) : []),
    [moreOpen, scored, dCap, byYield],
  )
  const summary = useMemo(() => (scored.length ? summarize(scored, k, dCap, dEven, byYield) : null), [scored, k, dCap, dEven, byYield])
  const yieldList = useMemo(
    () => (dEven ? evenShare(byYield, k) : advanceOrder(byYield, dCap).slice(0, k)),
    [byYield, dCap, k, dEven],
  )
  const yieldSet = useMemo(() => new Set(yieldList.map((c) => c.id)), [yieldList])
  const advancedIds = useMemo(() => new Set(summary?.advanced.map((c) => c.id) ?? []), [summary])
  const btBase = useMemo(() => (dPrices ? backtestBase(scored, dPrices) : null), [scored, dPrices])
  const bt = useMemo(
    () => (summary && btBase ? backtest(btBase, summary.advanced, yieldList) : null),
    [btBase, summary, yieldList],
  )
  const heldOut = data?.meta.held_out_year ?? null
  const curve10 = useMemo(() => (dPrices && heldOut ? captureCurve(scored, dPrices) : []), [scored, dPrices, heldOut])
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
  if (!data || !prices || !dPrices || !summary) return <main><p className="muted">Loading…</p></main>

  return (
    <main>
      <header>
        <h1>ProMaize</h1>
        <span className="sub">trial planner · which lines get the ground this season</span>
        <span style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {data.meta.synthetic && <span className="banner" style={{ marginLeft: 0 }}>synthetic placeholder data</span>}
          <a className="pill" href="/cleaning/" title="What we did to the data before any model saw it">
            How we cleaned the data →
          </a>
          <a className="pill" href="/learn/" title="The breeding problem, the data and the model, explained from zero">
            New to breeding? How this works →
          </a>
          <ThemeToggle />
        </span>
      </header>
      <div className="lede">
        <p>
          <b>{heldOut ? `January ${heldOut}. ` : ''}The field budget has been cut.</b>{' '}
          {data.meta.n_candidates.toLocaleString()} new lines{nFamilies > 1 ? <>, from {nFamilies} families never grown in a field,</> : null}{' '}
          are waiting, and there are plots for {k.toLocaleString()}. A line that gets no plot is dropped for good.
        </p>
        <p>
          <b>ProMaize chooses which lines get the plots.</b> It predicts each line's value from its DNA, in dollars per
          acre at your prices, and shows how far each prediction can be trusted.
        </p>
        <p className="who">
          Built for the people who own that budget: the heads of maize breeding at Bayer Crop Science, Corteva,
          Syngenta and KWS.
        </p>
      </div>

      <Evidence v={data.validation} heldOut={heldOut} />

      <div className="layout">
        <Controls
          n={scored.length} budget={budget} cap={cap} maxFamily={maxFamily} prices={prices} even={even}
          onBudget={setBudget} onCap={onCap} onPrices={setPrices} onEven={setEven}
          engines={data.validation.engines} engine={engine} onEngine={setEngine} heldOut={heldOut} seasons={data.validation.by_year?.length}
        />
        <div className="stack" style={{ opacity: stale ? 0.72 : 1, transition: 'opacity 120ms' }}>
          {k < dBudget && (
            <p className="muted" style={{ margin: 0 }}>
              The family limit leaves only {k.toLocaleString()} eligible lines. Loosen it or lower the budget.
            </p>
          )}
          <StatTiles {...summary} capped={dEven || Number.isFinite(dCap)} />
          {bt && heldOut && <Backtest bt={bt} year={heldOut} k={k} curve={curve10} maturity={maturity} />}
          {data.validation.strategies && data.validation.strategies.length > 0 && (
            <Strategies rows={data.validation.strategies} heldOut={heldOut} match={data.validation.plots_to_match} />
          )}
          {data.validation.by_year && <Pedigree years={data.validation.by_year} heldOut={heldOut} />}
          {data.locations && data.locations.length > 0 && (
            <TestSites sites={data.locations} year={heldOut} persistence={data.validation.site_persistence} />
          )}
          <CandidateTable advanced={summary.advanced} yieldSet={yieldSet} prices={dPrices} />
          <Validation v={data.validation} baselines={data.baselines} notes={data.meta.notes} heldOut={heldOut} />
          <Breadth scored={scored} budget={k} cap={dCap} even={dEven} onCap={onCap} onEven={onEvenOn} />
          <details className="more" onToggle={(e) => setMoreOpen((e.currentTarget as HTMLDetailsElement).open)}>
            <summary>More tools: the budget curve, price scenarios, the genomic map</summary>
            {moreOpen && (
              <div className="stack" style={{ marginTop: 12 }}>
                <Frontier points={curve} budget={k} onBudget={setBudget} />
                <Scenarios candidates={cands} prices={dPrices} budget={k} cap={dCap} even={dEven} />
                <GenomicMap all={scored} advanced={advancedIds} />
              </div>
            )}
          </details>
        </div>
      </div>
    </main>
  )
}

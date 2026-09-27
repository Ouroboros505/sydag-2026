import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import CandidateTable from './components/CandidateTable'
import Controls from './components/Controls'
import Frontier from './components/Frontier'
import GenomicMap from './components/GenomicMap'
import Scenarios from './components/Scenarios'
import StatTiles from './components/StatTiles'
import ThemeToggle from './components/ThemeToggle'
import { loadJson } from './lib/data'
import { advanceOrder, backtest, backtestBase, byYieldOrder, captureCurve, evenShare, forecastFrom, frontier, meanOf, score, seasonsFromRows, seasonValues, summarize, withEngine, type Prices } from './lib/econ'
import type { EngineId, Recommendations, SeasonLines } from './lib/types'
import Backtest from './components/Backtest'
import Evidence from './components/Evidence'
import TestSites from './components/TestSites'
import SeasonForecast from './components/SeasonForecast'

export default function App() {
  const [data, setData] = useState<Recommendations | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prices, setPrices] = useState<Prices | null>(null)
  const [budget, setBudget] = useState(300)
  // every family gets a fair share of the plots: no ranking across families, no cap
  const cap = Infinity
  const even = true
  const [engine, setEngine] = useState<EngineId>('family')
  const [revealed, setRevealed] = useState(false)   // January: the decision year's results are not known yet
  const [lines, setLines] = useState<SeasonLines | null>(null)   // every graded line, for the forecast at any prices

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
        const e = q.get('engine')
        if (d.validation.engines?.some((x) => x.id === e)) setEngine(e as EngineId)
        setRevealed(q.get('view') === 'harvest')
      })
      .catch((e) => setError(String(e)))
    // the forecast works from the pipeline's fixed-price record until this arrives
    loadJson<SeasonLines>('season_lines.json').then(setLines).catch(() => {})
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

  const half90 = data?.validation.engines?.find((e) => e.id === dEngine)?.half90
  const cands = useMemo(() => (data ? withEngine(data.candidates, dEngine, half90) : []), [data, dEngine, half90])
  const nFamilies = useMemo(() => new Set(data?.candidates.map((c) => c.family)).size, [data])
  // how the lines are organized decides the engine: families of siblings, or lines that stand alone
  const shape = useMemo(() => {
    if (!data) return undefined
    const n = new Map<string, number>()
    for (const c of data.candidates) n.set(c.family, (n.get(c.family) ?? 0) + 1)
    const sizes = [...n.values()].filter((k) => k >= 2).sort((a, b) => a - b)
    return { lines: data.candidates.length, families: sizes.length, inFamilies: sizes.reduce((a, k) => a + k, 0),
      perFamily: sizes[Math.floor(sizes.length / 2)] ?? 0 }
  }, [data])
  const scored = useMemo(() => (dPrices ? score(cands, dPrices) : []), [cands, dPrices])
  const byYield = useMemo(() => byYieldOrder(scored), [scored])
  const reachable = useMemo(() => (dEven ? scored.length : advanceOrder(scored, dCap).length), [scored, dCap, dEven])
  const k = Math.min(dBudget, reachable)
  // every season's forecast and real value, both engines, at the prices, plots and share on screen
  const heldOutYear = data?.meta.held_out_year ?? null
  const share = k / Math.max(1, data?.meta.n_candidates ?? 1)
  const seasons = useMemo(() => {
    if (!data || !dPrices) return null
    const calc = (e: EngineId) => (lines ? seasonValues(lines, e, dPrices, share)
      : data.validation.engine_value ? seasonsFromRows(data.validation.engine_value, e, share) : [])
    return { family: calc('family'), gblup: calc('gblup') }
  }, [data, lines, dPrices, share])
  const forecast = useMemo(() => (seasons && heldOutYear ? forecastFrom(seasons[dEngine === 'gblup' ? 'gblup' : 'family'], heldOutYear) : null),
    [seasons, dEngine, heldOutYear])
  // what each engine's picks really earned in past seasons, for the engine card
  const real = useMemo(() => {
    if (!seasons || !heldOutYear) return undefined
    const avg = (xs: { year: number; real: number }[]) => {
      const past = xs.filter((x) => x.year < heldOutYear)
      return past.length ? past.reduce((a, x) => a + x.real, 0) / past.length : undefined
    }
    return { family: avg(seasons.family), gblup: avg(seasons.gblup) }
  }, [seasons, heldOutYear])
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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'center' }}>
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <h1>ProMaize</h1>
        </span>
        <span className="version" title={`ProMaize v${__VERSION__}, built ${__BUILD__} UTC`}>v{__VERSION__}</span>
        <span className="sub">trial planner · which lines get the ground this season</span>
        <span style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {data.meta.synthetic && <span className="banner" style={{ marginLeft: 0 }}>synthetic placeholder data</span>}
          <a className="pill" href="/cleaning/" title="What we did to the data before any model saw it">
            How we cleaned the data →
          </a>
          <a className="pill" href="/method/" title="What happens after cleaning: the engines, the tests, how accuracy is measured">
            How we analyzed it →
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
          {data.meta.n_candidates.toLocaleString('en-US')} new lines{nFamilies > 1 ? <>, from {nFamilies} families never grown in a field,</> : null}{' '}
          are waiting, and there are plots for {k.toLocaleString('en-US')}. A line that gets no plot is dropped for good.
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

      <Evidence v={data.validation} heldOut={heldOut} revealed={revealed} />

      <div className="layout">
        <Controls
          n={scored.length} budget={budget} prices={prices}
          onBudget={setBudget} onPrices={setPrices}
          engines={data.validation.engines} engine={engine} onEngine={setEngine} heldOut={heldOut} seasons={data.validation.by_year?.length} dataset={data.meta.dataset} shape={shape} real={real} ceiling={data.validation.ceiling}
        />
        <div className="stack" style={{ opacity: stale ? 0.72 : 1, transition: 'opacity 120ms' }}>
          {k < dBudget && (
            <p className="muted" style={{ margin: 0 }}>
              The family limit leaves only {k.toLocaleString('en-US')} eligible lines. Loosen it or lower the budget.
            </p>
          )}
          {heldOut && data.validation.engine_value && (
            <SeasonForecast f={forecast} heldOut={heldOut} engine={dEngine} corn={dPrices.corn_price}
              revealed={revealed} onReveal={setRevealed} />
          )}
          <StatTiles {...summary} capped={dEven || Number.isFinite(dCap)} />
          {bt && heldOut && <Backtest bt={bt} year={heldOut} k={k} curve={curve10} maturity={maturity} />}
          {data.locations && data.locations.length > 0 && data.season_plots && (
            <TestSites sites={data.locations} year={heldOut} candidates={data.candidates} plots={data.season_plots}
              prices={dPrices} advanced={summary.advanced} />
          )}
          <CandidateTable advanced={summary.advanced} yieldSet={yieldSet} prices={dPrices} />
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

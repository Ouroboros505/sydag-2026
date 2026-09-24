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
import { advanceOrder, byYieldOrder, frontier, score, summarize, type Prices } from './lib/econ'
import type { Recommendations } from './lib/types'
import Info from './components/Info'

export default function App() {
  const [data, setData] = useState<Recommendations | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prices, setPrices] = useState<Prices | null>(null)
  const [budget, setBudget] = useState(300)
  const [cap, setCap] = useState(Infinity)

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
        setBudget(Math.min(num('budget', 300), d.candidates.length))
        setCap(num('cap', Infinity))
      })
      .catch((e) => setError(String(e)))
  }, [])

  const scored = useMemo(() => (data && prices ? score(data.candidates, prices) : []), [data, prices])
  const maxFamily = useMemo(() => {
    const n = new Map<string, number>()
    for (const c of scored) n.set(c.family, (n.get(c.family) ?? 0) + 1)
    return Math.max(1, ...n.values())
  }, [scored])
  const reachable = useMemo(() => advanceOrder(scored, cap).length, [scored, cap])
  const k = Math.min(budget, reachable)
  const curve = useMemo(
    () => (scored.length ? frontier(scored, cap, Math.max(1, Math.floor(scored.length / 200))) : []),
    [scored, cap],
  )
  const summary = useMemo(() => (scored.length ? summarize(scored, k, cap) : null), [scored, k, cap])
  const yieldSet = useMemo(
    () => new Set(advanceOrder(byYieldOrder(scored), cap).slice(0, k).map((c) => c.id)),
    [scored, cap, k],
  )
  const advancedIds = useMemo(() => new Set(summary?.advanced.map((c) => c.id) ?? []), [summary])

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
        {data.meta.n_candidates.toLocaleString()} candidate lines, none of them field-tested yet, and plots for{' '}
        {k.toLocaleString()}. Predictions come from markers and parentage; the ranking is by <b>dollars per acre</b>,
        not bushels: yield after drying cost and lodging loss at the prices you set.
      </p>

      <div className="layout">
        <Controls
          n={scored.length} budget={budget} cap={cap} maxFamily={maxFamily} prices={prices}
          onBudget={setBudget} onCap={setCap} onPrices={setPrices}
        />
        <div className="stack">
          {k < budget && (
            <p className="muted" style={{ margin: 0 }}>
              The family limit leaves only {k.toLocaleString()} eligible lines. Loosen it or lower the budget.
            </p>
          )}
          <StatTiles {...summary} capped={Number.isFinite(cap)} />
          <Frontier points={curve} budget={k} onBudget={setBudget} />
          <Scenarios candidates={data.candidates} prices={prices} budget={k} cap={cap} />
          <Breadth scored={scored} budget={k} cap={cap} onCap={setCap} />
          <GenomicMap all={scored} advanced={advancedIds} />
          <CandidateTable advanced={summary.advanced} yieldSet={yieldSet} prices={prices} />
          <div className="panel validation">
            <h2>How much to trust this<Info wide>
              How good the predictions are, measured honestly: the model learned only from earlier years, then predicted
              lines it had never seen, and was checked against their real results. <b>r</b> is the correlation between
              predicted and real (1 = perfect ranking, 0 = no better than random). The <b>baselines</b> are simpler
              methods to beat. The <b>leaky</b> number is what you'd get by testing on relatives of training lines: it
              looks better and isn't real, and it's shown so nobody confuses the two.
            </Info></h2>
            <p>
              <b>{data.validation.scheme}.</b> On {data.validation.n_test.toLocaleString()} held-out lines the model's
              correlation with realised yield is <b>r = {data.validation.r.toFixed(2)}</b>, and it recovers{' '}
              <b>{Math.round(data.validation.top20_recovery * 100)}%</b> of the true top 20% (chance is 20%).
              Intervals in the table are 90% bands from that same forward error, not from a random split.
            </p>
            {data.validation.traits && (
              <p>
                The ranking also leans on predicted moisture and lodging. Same forward test:{' '}
                {Object.entries(data.validation.traits).map(([key, v], i) => (
                  <span key={key}>{i ? ' · ' : ''}{key} <b>r = {v.toFixed(2)}</b></span>
                ))}
              </p>
            )}
            <ul>
              {data.baselines.map((b) => (
                <li key={b.name}>{b.name}: <b>{b.metric} = {b.value.toFixed(2)}</b></li>
              ))}
            </ul>
            <p className="muted">
              Confidence tiers are terciles of each candidate's closest genomic match to any line the model was
              trained on: <b>high</b> has near relatives in the record, <b>low</b> is furthest from anything seen.
            </p>
            {data.meta.notes && <p className="muted">{data.meta.notes}</p>}
          </div>
        </div>
      </div>
    </main>
  )
}

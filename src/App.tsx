import { useEffect, useMemo, useState } from 'react'
import CandidateTable from './components/CandidateTable'
import Controls from './components/Controls'
import Frontier from './components/Frontier'
import Scenarios from './components/Scenarios'
import StatTiles from './components/StatTiles'
import ThemeToggle from './components/ThemeToggle'
import { loadJson } from './lib/data'
import { frontier, score, summarize, type Prices } from './lib/econ'
import type { Recommendations } from './lib/types'

export default function App() {
  const [data, setData] = useState<Recommendations | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prices, setPrices] = useState<Prices | null>(null)
  const [budget, setBudget] = useState(300)

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
      })
      .catch((e) => setError(String(e)))
  }, [])

  const scored = useMemo(() => (data && prices ? score(data.candidates, prices) : []), [data, prices])
  const curve = useMemo(() => (scored.length ? frontier(scored, Math.max(1, Math.floor(scored.length / 200))) : []), [scored])

  const summary = useMemo(
    () => (scored.length ? summarize(scored, Math.min(budget, scored.length)) : null),
    [scored, budget],
  )

  if (error) return <main><p>Could not load recommendations.json — {error}</p></main>
  if (!data || !prices || !summary) return <main><p className="muted">Loading…</p></main>

  return (
    <main>
      <header>
        <h1>Trial Planner</h1>
        <span className="sub">which lines get the ground this season</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {data.meta.synthetic && <span className="banner" style={{ marginLeft: 0 }}>synthetic placeholder data</span>}
          <ThemeToggle />
        </span>
      </header>
      <p className="lede">
        {data.meta.n_candidates.toLocaleString()} candidate lines, none of them field-tested yet. Predictions come from
        markers and parentage; the ranking is by <b>dollars per acre</b>, not bushels — yield after drying cost and
        lodging loss at the prices you set on the left.
      </p>

      <div className="layout">
        <Controls n={scored.length} budget={budget} prices={prices} onBudget={setBudget} onPrices={setPrices} />
        <div className="stack">
          <StatTiles budget={Math.min(budget, scored.length)} {...summary} />
          <Frontier points={curve} budget={budget} onBudget={setBudget} />
          <Scenarios candidates={data.candidates} prices={prices} budget={budget} />
          <CandidateTable rows={scored} budget={budget} prices={prices} />
          <div className="panel validation">
            <h2>How much to trust this</h2>
            <p>
              <b>{data.validation.scheme}.</b> On {data.validation.n_test.toLocaleString()} held-out lines the model's
              correlation with realised yield is <b>r = {data.validation.r.toFixed(2)}</b>, and it recovers{' '}
              <b>{Math.round(data.validation.top20_recovery * 100)}%</b> of the true top 20% (chance is 20%).
              Intervals in the table are 90% bands from that same forward error, not from a random split.
            </p>
            <ul>
              {data.baselines.map((b) => (
                <li key={b.name}>{b.name}: <b>{b.metric} = {b.value.toFixed(2)}</b></li>
              ))}
            </ul>
            {data.meta.notes && <p className="muted">{data.meta.notes}</p>}
          </div>
        </div>
      </div>
    </main>
  )
}

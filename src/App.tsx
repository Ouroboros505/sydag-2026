import { useEffect, useMemo, useState } from 'react'
import CandidateTable from './components/CandidateTable'
import Controls from './components/Controls'
import Frontier from './components/Frontier'
import StatTiles from './components/StatTiles'
import { loadJson } from './lib/data'
import { frontier, score, swaps, type Prices } from './lib/econ'
import type { Recommendations } from './lib/types'

export default function App() {
  const [data, setData] = useState<Recommendations | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prices, setPrices] = useState<Prices | null>(null)
  const [budget, setBudget] = useState(300)

  useEffect(() => {
    loadJson<Recommendations>('recommendations.json')
      .then((d) => {
        setData(d)
        setPrices(d.price_defaults)
        setBudget(Math.min(300, d.candidates.length))
      })
      .catch((e) => setError(String(e)))
  }, [])

  const scored = useMemo(() => (data && prices ? score(data.candidates, prices) : []), [data, prices])
  const curve = useMemo(() => (scored.length ? frontier(scored, Math.max(1, Math.floor(scored.length / 200))) : []), [scored])

  const summary = useMemo(() => {
    if (!scored.length) return null
    const k = Math.min(budget, scored.length)
    const byYield = [...scored].sort((a, b) => b.pred_yield - a.pred_yield)
    const total = scored.reduce((s, c) => s + Math.max(0, c.margin), 0) || 1
    const mSum = scored.slice(0, k).reduce((s, c) => s + c.margin, 0)
    const ySum = byYield.slice(0, k).reduce((s, c) => s + c.margin, 0)
    return {
      capturedByMargin: mSum / total,
      capturedByYield: ySum / total,
      dollarGap: mSum - ySum,
      swapCount: swaps(scored, k).length,
    }
  }, [scored, budget])

  if (error) return <main><p>Could not load recommendations.json — {error}</p></main>
  if (!data || !prices || !summary) return <main><p className="muted">Loading…</p></main>

  return (
    <main>
      <header>
        <h1>Trial Planner</h1>
        <span className="sub">which lines get the ground this season</span>
        {data.meta.synthetic && <span className="banner">synthetic placeholder data</span>}
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
          <CandidateTable rows={scored} budget={budget} />
          <div className="panel validation">
            <h2>How much to trust this</h2>
            <p>
              Validation scheme: <b>{data.validation.scheme}</b>. Correlation with realised yield
              <b> r = {data.validation.r.toFixed(2)}</b>; the model recovers <b>{Math.round(data.validation.top20_recovery * 100)}%</b> of
              the true top 20% (chance is 20%). That's a weak signal, and it's the honest one — random cross-validation
              on this kind of data reads around 0.55 and is leakage.
            </p>
            <ul>
              {data.baselines.map((b) => (
                <li key={b.name}>{b.name}: {b.metric} = {b.value.toFixed(2)}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}

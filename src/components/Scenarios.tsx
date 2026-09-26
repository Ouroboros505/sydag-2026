import { memo, useMemo } from 'react'
import type { Candidate } from '../lib/types'
import { byYieldOrder, fmtNum, fmtUSD, scenarios, score, summarize, type Prices } from '../lib/econ'
import Info from './Info'

interface Props {
  candidates: Candidate[]
  prices: Prices
  budget: number
  cap: number
  even?: boolean
}

function Scenarios({ candidates, prices, budget, cap, even = false }: Props) {
  const scoredRuns = useMemo(
    () => scenarios(prices).map((s) => { const sc = score(candidates, s.prices); return { s, sc, byYield: byYieldOrder(sc) } }),
    [candidates, prices],
  )
  const rows = useMemo(
    () => scoredRuns.map(({ s, sc, byYield }) => ({ ...s, ...summarize(sc, Math.min(budget, sc.length), cap, even, byYield) })),
    [scoredRuns, budget, cap, even],
  )
  return (
    <div className="panel tablewrap">
      <h2>
        <span>When the ranking changes<Info wide>
          The same budget and the same predictions, under different season economics. Each row recalculates the tiles
          above with one price changed: expensive drying (a propane spike), cheaper corn, or a year where fallen plants
          are mostly lost. It shows <b>when</b> ranking by dollars instead of bushels matters most: the gap grows when
          drying or lodging get expensive.
        </Info></span>
        <span className="muted">same {fmtNum(budget)} lines, different season economics</span>
      </h2>
      <table>
        <thead>
          <tr>
            <th className="l">Scenario</th>
            <th className="l hide-sm">Assumes</th>
            <th>Gain/acre by $</th>
            <th>Gain/acre by bu</th>
            <th>Left on the table</th>
            <th className="hide-sm">Lines that change hands</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="l"><b>{r.name}</b></td>
              <td className="l muted hide-sm">{r.note}</td>
              <td>{fmtUSD(r.gainByMargin)}</td>
              <td>{fmtUSD(r.gainByYield)}</td>
              <td><b>{fmtUSD(r.gap)}</b></td>
              <td className="hide-sm">{fmtNum(r.swapCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default memo(Scenarios)

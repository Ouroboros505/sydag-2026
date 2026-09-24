import { useMemo } from 'react'
import type { Candidate } from '../lib/types'
import { fmtNum, fmtUSD, scenarios, score, summarize, type Prices } from '../lib/econ'

interface Props {
  candidates: Candidate[]
  prices: Prices
  budget: number
  cap: number
}

export default function Scenarios({ candidates, prices, budget, cap }: Props) {
  const rows = useMemo(
    () =>
      scenarios(prices).map((s) => {
        const sc = score(candidates, s.prices)
        return { ...s, ...summarize(sc, Math.min(budget, sc.length), cap) }
      }),
    [candidates, prices, budget, cap],
  )
  return (
    <div className="panel tablewrap">
      <h2>
        When the ranking changes
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

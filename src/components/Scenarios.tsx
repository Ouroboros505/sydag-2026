import { useMemo } from 'react'
import type { Candidate } from '../lib/types'
import { fmtNum, fmtUSD, scenarios, score, summarize, type Prices } from '../lib/econ'

interface Props {
  candidates: Candidate[]
  prices: Prices
  budget: number
}

export default function Scenarios({ candidates, prices, budget }: Props) {
  const rows = useMemo(
    () =>
      scenarios(prices).map((s) => {
        const sc = score(candidates, s.prices)
        return { ...s, ...summarize(sc, Math.min(budget, sc.length)) }
      }),
    [candidates, prices, budget],
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
            <th className="l">Assumes</th>
            <th>Gain/acre by $</th>
            <th>Gain/acre by bu</th>
            <th>Left on the table</th>
            <th>Lines that change hands</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="l"><b>{r.name}</b></td>
              <td className="l muted">{r.note}</td>
              <td>{fmtUSD(r.gainByMargin)}</td>
              <td>{fmtUSD(r.gainByYield)}</td>
              <td><b>{fmtUSD(r.gap)}</b></td>
              <td>{fmtNum(r.swapCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import { useState } from 'react'
import type { StrategyRow } from '../lib/types'
import { fmtNum, fmtPct, fmtUSD } from '../lib/econ'
import Info from './Info'

interface Props { rows: StrategyRow[]; heldOut: number | null }

/** The resource-allocation question answered with the record: the same plots spent different
 *  ways, every forward year, scored on what the field then paid. */
export default function Strategies({ rows, heldOut }: Props) {
  const budgets = [...new Set(rows.map((r) => r.budget))].sort()
  const [budget, setBudget] = useState(budgets[0] ?? 0.3)
  const years = [...new Set(rows.filter((r) => r.year !== 'mean').map((r) => r.year as number))].sort()
  const mean = rows.filter((r) => r.year === 'mean' && r.budget === budget)
  const at = (name: string, year: number) => rows.find((r) => r.year === year && r.budget === budget && r.strategy === name)
  const best = Math.max(...mean.map((r) => r.gain))
  return (
    <div className="panel">
      <h2>Which way to spend the plots<Info wide>
        Each row is a rule for choosing which lines get plots, applied in every year from {years[0]} to{' '}
        {years[years.length - 1]} using only what was known before that year, then scored on what the chosen lines really
        did. <b>Realised gain</b> is their $/acre in the field over the cohort average (a random pick scores $0).{' '}
        <b>Top 10% kept</b> is the share of that year's real best lines that got a plot. <b>Families</b> is the effective
        number of families advanced (breadth). <b>Maturity</b> is how much later the advanced set was than the cohort.
      </Info></h2>
      <div className="toggle" style={{ marginBottom: 10 }}>
        {budgets.map((b) => (
          <button key={b} className={b === budget ? 'on' : ''} onClick={() => setBudget(b)}>plant {fmtPct(b)} of lines</button>
        ))}
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th className="l">Rule</th>
              <th>Realised gain, mean of {years.length} years</th>
              {heldOut != null && <th className="hide-sm">in {heldOut}</th>}
              <th>Top 10% kept</th>
              <th className="hide-sm">Families</th>
              <th className="hide-sm">Maturity</th>
            </tr>
          </thead>
          <tbody>
            {mean.map((r) => (
              <tr key={r.strategy} className={r.gain === best ? 'swap' : undefined}>
                <td className="l">{r.strategy}</td>
                <td><b>{fmtUSD(r.gain, 1)}</b></td>
                {heldOut != null && <td className="muted hide-sm">{fmtUSD(at(r.strategy, heldOut)?.gain ?? 0, 1)}</td>}
                <td>{fmtPct(r.top10_kept)}</td>
                <td className="muted hide-sm">{r.eff_families == null ? '' : fmtNum(r.eff_families, 0)}</td>
                <td className="muted hide-sm">{r.strategy === 'random' ? '' : `${r.maturity_shift >= 0 ? '+' : '−'}${Math.abs(r.maturity_shift).toFixed(1)} d`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small" style={{ margin: '8px 0 0' }}>
        Per acre of every line advanced, relative to planting at random; corn at $4.50 and drying at $0.045/bu/pt. Lodging
        counts where it was scored, trial-adjusted.
      </p>
    </div>
  )
}

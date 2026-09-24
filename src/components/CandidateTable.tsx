import type { Scored } from '../lib/econ'
import { fmtNum, fmtUSD } from '../lib/econ'

interface Props {
  rows: Scored[]
  budget: number
  limit?: number
}

export default function CandidateTable({ rows, budget, limit = 40 }: Props) {
  const shown = rows.slice(0, limit)
  return (
    <div className="panel tablewrap">
      <h2>
        Advancement list
        <span className="muted">top {limit} of {fmtNum(budget)} advanced · highlighted rows would be cut by a bushel ranking</span>
      </h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th className="l">Line</th>
            <th className="l">Family</th>
            <th>Yield bu/ac</th>
            <th>90% interval</th>
            <th>Moisture %</th>
            <th>Lodging %</th>
            <th>$/acre</th>
            <th>Rank by bu</th>
            <th className="l">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((c) => (
            <tr key={c.id} className={c.rankByYield > budget ? 'swap' : undefined}>
              <td>{c.rankByMargin}</td>
              <td className="l">{c.id}</td>
              <td className="l muted">{c.family}</td>
              <td>{c.pred_yield.toFixed(1)}</td>
              <td className="muted">{c.lo.toFixed(0)}–{c.hi.toFixed(0)}</td>
              <td>{c.pred_mst.toFixed(1)}</td>
              <td>{c.pred_lodging.toFixed(1)}</td>
              <td><b>{fmtUSD(c.margin)}</b></td>
              <td className={c.rankByYield > budget ? '' : 'muted'}>{c.rankByYield}</td>
              <td className="l"><span className="conf">{c.confidence}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

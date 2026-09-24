import type { Scored } from '../lib/econ'
import { breakdown, fmtNum, fmtUSD, type Prices } from '../lib/econ'

interface Props {
  rows: Scored[]
  budget: number
  prices: Prices
  limit?: number
}

export default function CandidateTable({ rows, budget, prices, limit = 40 }: Props) {
  const shown = rows.slice(0, limit)
  // Family is only informative when it differs from the line id (population-structured data).
  const showFamily = shown.some((c) => c.family !== c.id)
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
            {showFamily && <th className="l">Family</th>}
            <th>$/acre</th>
            <th>Yield bu/ac</th>
            <th>90% band</th>
            <th>Moist. %</th>
            <th>Lodg. %</th>
            <th>Rank by bu</th>
            <th className="l">Conf.</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((c) => {
            const swap = c.rankByYield > budget
            return (
              <tr key={c.id} className={swap ? 'swap' : undefined}>
                <td>{c.rankByMargin}</td>
                <td className="l id" title={c.id}>{c.id}</td>
                {showFamily && <td className="l muted id" title={c.family}>{c.family}</td>}
                <td title={(() => { const b = breakdown(c, prices); return `gross ${fmtUSD(b.gross)}  −  drying ${fmtUSD(b.drying)}  −  lodging ${fmtUSD(b.lodging)}` })()}>
                  <b>{fmtUSD(c.margin)}</b>
                </td>
                <td>{c.pred_yield.toFixed(1)}</td>
                <td className="muted">{c.lo.toFixed(0)}–{c.hi.toFixed(0)}</td>
                <td>{c.pred_mst.toFixed(1)}</td>
                <td>{c.pred_lodging.toFixed(1)}</td>
                <td className={swap ? '' : 'muted'}>{c.rankByYield}</td>
                <td className="l"><span className="conf">{c.confidence}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

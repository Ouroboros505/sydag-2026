import type { Scored } from '../lib/econ'
import { breakdown, fmtNum, fmtUSD, toCSV, type Prices } from '../lib/econ'

interface Props {
  advanced: Scored[]
  yieldSet: Set<string>
  prices: Prices
  limit?: number
}

export default function CandidateTable({ advanced, yieldSet, prices, limit = 40 }: Props) {
  const shown = advanced.slice(0, limit)
  const showFamily = shown.some((c) => c.family !== c.id)

  function download() {
    const blob = new Blob([toCSV(advanced, prices)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `advancement_list_${advanced.length}_lines.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="panel tablewrap">
      <h2>
        Advancement list
        <span className="muted">
          top {Math.min(limit, advanced.length)} of {fmtNum(advanced.length)} · highlighted rows would be cut by a bushel ranking ·{' '}
          <button className="link" onClick={download}>download all {fmtNum(advanced.length)} as CSV</button>
        </span>
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
          {shown.map((c, i) => {
            const swap = !yieldSet.has(c.id)
            const b = breakdown(c, prices)
            return (
              <tr key={c.id} className={swap ? 'swap' : undefined}>
                <td>{i + 1}</td>
                <td className="l id" title={c.id}>{c.id}</td>
                {showFamily && <td className="l muted id fam" title={c.family}>{c.family}</td>}
                <td title={`gross ${fmtUSD(b.gross)}  −  drying ${fmtUSD(b.drying)}  −  lodging ${fmtUSD(b.lodging)}`}>
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

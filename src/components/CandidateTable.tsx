import type { Scored } from '../lib/econ'
import { breakdown, fmtNum, fmtUSD, toCSV, type Prices } from '../lib/econ'
import Info from './Info'

interface Props {
  advanced: Scored[]
  yieldSet: Set<string>
  prices: Prices
  limit?: number
}

export default function CandidateTable({ advanced, yieldSet, prices, limit = 40 }: Props) {
  const shown = advanced.slice(0, limit)
  const showFamily = shown.some((c) => c.family !== c.id)
  const showActual = shown.some((c) => c.actual_yield != null)

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
        <span>Advancement list<Info wide>
          The lines to advance, best first, ranked by predicted $/acre. <b>Yield</b> is the predicted yield of the line's
          test hybrid; the <b>90% band</b> is where the real yield will probably land (it's wide: predictions from DNA are
          rough). <b>Field said</b>, when present, is what the line really yielded once it was grown, which the model
          never saw; it is dimmed when it fell outside the band. <b>Moisture</b> and <b>lodging</b> are predicted too,
          and feed the dollar value. <b>Rank by bu</b> is
          where the same line would sit in a bushel ranking. <b>Highlighted rows</b> are lines a bushel ranking would
          have cut. <b>Confidence</b> is how closely related the line is to lines with field records. Hover a $/acre
          value to see its breakdown.
        </Info></span>
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
            {showFamily && <th className="l hide-sm">Family</th>}
            <th>$/acre</th>
            <th>Yield bu/ac</th>
            {showActual && <th>Field said</th>}
            <th className="hide-sm">90% band</th>
            <th className="hide-sm">Moist. %</th>
            <th className="hide-sm">Lodg. %</th>
            <th>Rank by bu</th>
            <th className="l hide-sm">Conf.</th>
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
                {showFamily && <td className="l muted id fam hide-sm" title={c.family}>{c.family}</td>}
                <td title={`gross ${fmtUSD(b.gross)}  −  drying ${fmtUSD(b.drying)}  −  lodging ${fmtUSD(b.lodging)}`}>
                  <b>{fmtUSD(c.margin)}</b>
                </td>
                <td>{c.pred_yield.toFixed(1)}</td>
                {showActual && (
                  <td className={c.actual_yield != null && c.actual_yield >= c.lo && c.actual_yield <= c.hi ? '' : 'muted'}
                    title="what the line's test hybrid actually yielded that season, environment-adjusted">
                    {c.actual_yield != null ? c.actual_yield.toFixed(1) : ''}
                  </td>
                )}
                <td className="muted hide-sm">{c.lo.toFixed(0)}–{c.hi.toFixed(0)}</td>
                <td className="hide-sm">{c.pred_mst.toFixed(1)}</td>
                <td className="hide-sm">{c.pred_lodging.toFixed(1)}</td>
                <td className={swap ? '' : 'muted'}>{c.rankByYield}</td>
                <td className="l hide-sm"><span className="conf">{c.confidence}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

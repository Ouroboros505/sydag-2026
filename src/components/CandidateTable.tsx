import { memo } from 'react'
import type { Scored } from '../lib/econ'
import { breakdown, fmtNum, fmtUSD, toCSV, type Prices } from '../lib/econ'
import Info from './Info'

interface Props {
  advanced: Scored[]
  prices: Prices
  revealed: boolean             // the real results show only after the harvest
  limit?: number
}

/** The decision: the lines to plant, best first, with what each is predicted to earn and grow. */
function CandidateTable({ advanced, prices, revealed, limit = 40 }: Props) {
  const shown = advanced.slice(0, limit)
  const showFamily = shown.some((c) => c.family !== c.id)
  const showReal = revealed && shown.some((c) => c.actual_yield != null)

  function download() {
    const blob = new Blob([toCSV(advanced, prices, revealed)], { type: 'text/csv' })
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
          The lines to plant, best first, by predicted <b>income per acre</b> (hover a value for its make-up: yield times
          price, minus drying, minus lodging). <b>Yield</b> is the predicted yield of the line's test hybrid; the{' '}
          <b>likely range</b> is where its real yield should land 9 times in 10. <b>Moisture</b> and <b>lodging</b> are
          predicted too: they set the drying cost and the lodging loss.
          {showReal && <> <b>Real yield</b> is what the line yielded in the field, dimmed when it landed outside its range.</>}
        </Info></span>
        <span className="muted">
          top {Math.min(limit, advanced.length)} of {fmtNum(advanced.length)} ·{' '}
          <button className="link" onClick={download}>download all {fmtNum(advanced.length)} as CSV</button>
        </span>
      </h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th className="l">Line</th>
            {showFamily && <th className="l hide-sm">Family</th>}
            <th>Income $/acre</th>
            <th>Yield bu/ac</th>
            <th className="hide-sm">Likely range</th>
            {showReal && <th>Real yield</th>}
            <th className="hide-sm">Moisture %</th>
            <th className="hide-sm">Lodging %</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((c, i) => {
            const b = breakdown(c, prices)
            return (
              <tr key={c.id}>
                <td>{i + 1}</td>
                <td className="l id" title={c.id}>{c.id}</td>
                {showFamily && <td className="l muted id fam hide-sm" title={c.family}>{c.family}</td>}
                <td title={`gross ${fmtUSD(b.gross)}  −  drying ${fmtUSD(b.drying)}  −  lodging ${fmtUSD(b.lodging)}`}>
                  <b>{fmtUSD(c.margin)}</b>
                </td>
                <td>{c.pred_yield.toFixed(1)}</td>
                <td className="muted hide-sm">{c.lo.toFixed(0)} to {c.hi.toFixed(0)}</td>
                {showReal && (
                  <td className={c.actual_yield != null && c.actual_yield >= c.lo && c.actual_yield <= c.hi ? '' : 'muted'}
                    title="what the line's test hybrid really yielded that season, weather taken out">
                    {c.actual_yield != null ? c.actual_yield.toFixed(1) : ''}
                  </td>
                )}
                <td className="hide-sm">{c.pred_mst.toFixed(1)}</td>
                <td className="hide-sm">{c.pred_lodging.toFixed(1)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default memo(CandidateTable)

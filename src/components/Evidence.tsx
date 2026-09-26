import { memo } from 'react'
import type { EngineId, EngineValueRow, Validation } from '../lib/types'
import { planForecast } from '../lib/econ'

interface Props {
  v: Validation
  heldOut: number | null
  rows?: EngineValueRow[]
  engine: EngineId
  share: number
  revealed: boolean
  kept: { families: number; of: number }
}

const usd = (x: number) => `${x < 0 ? '−' : ''}$${Math.abs(x).toFixed(2)}`

/** The case in one line, before any scrolling: the forecast, how far past forecasts missed, and what
 *  the plan keeps. After harvest, the forecast is checked against the real season. */
function Evidence({ v, heldOut, rows, engine, share, revealed, kept }: Props) {
  const f = rows && heldOut ? planForecast(rows, engine, share, heldOut) : null
  const graded = f?.past.filter((s) => s.forecast != null) ?? []
  const miss = graded.length ? graded.reduce((a, s) => a + Math.abs(s.forecast! - s.real), 0) / graded.length : null
  const items: [string, string][] = []
  if (f && heldOut) {
    if (revealed) {
      const where = f.now.real > f.hi ? 'above' : f.now.real < f.lo ? 'below' : 'inside'
      items.push([usd(f.now.real), `real ${heldOut} value per acre above a random pick, ${where} the forecast (${usd(f.lo)} to ${usd(f.hi)})`])
    } else {
      items.push([usd(f.forecast), `forecast for ${heldOut}: value per acre above a random pick (likely ${usd(f.lo)} to ${usd(f.hi)})`])
    }
  }
  if (revealed && v.coverage90 != null && heldOut) items.push([`${Math.round(v.coverage90 * 100)}%`, `of real ${heldOut} line results landed inside their predicted ranges`])
  else if (miss != null) items.push([usd(miss), `how far past forecasts missed, on average (${graded[0].year} to ${graded[graded.length - 1].year})`])
  items.push([`${kept.families} of ${kept.of}`, 'families keep plots: every family gets its fair share'])
  if (!items.length) return null
  return (
    <div className="evidence" role="list" aria-label="The forecast and what the plan keeps">
      {items.map(([big, small]) => (
        <div key={small} className="ev" role="listitem"><b>{big}</b><span>{small}</span></div>
      ))}
    </div>
  )
}

export default memo(Evidence)

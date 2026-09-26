import { memo } from 'react'
import type { Validation } from '../lib/types'
import type { PlanForecast } from '../lib/econ'

interface Props {
  v: Validation
  heldOut: number | null
  f: PlanForecast | null
  revealed: boolean
}

const usd = (x: number) => `${x < 0 ? '−' : ''}$${Math.abs(x).toFixed(2)}`

/** What the chart can't show at a glance: how far past forecasts missed, and after harvest, how many
 *  line results landed inside their predicted ranges. */
function Evidence({ v, heldOut, f, revealed }: Props) {
  const graded = f?.past.filter((s) => s.forecast != null) ?? []
  const miss = graded.length ? graded.reduce((a, s) => a + Math.abs(s.forecast! - s.real), 0) / graded.length : null
  const items: [string, string][] = []
  if (revealed && v.coverage90 != null && heldOut) items.push([`${Math.round(v.coverage90 * 100)}%`, `of real ${heldOut} line results landed inside their predicted ranges`])
  else if (miss != null) items.push([usd(miss), `how far past forecasts missed, on average (${graded[0].year} to ${graded[graded.length - 1].year})`])
  if (!items.length) return null
  return (
    <div className="evidence" role="list" aria-label="How far to trust the forecast">
      {items.map(([big, small]) => (
        <div key={small} className="ev" role="listitem"><b>{big}</b><span>{small}</span></div>
      ))}
    </div>
  )
}

export default memo(Evidence)

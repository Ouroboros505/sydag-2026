import type { Validation } from '../lib/types'
import { fmtNum, fmtPct } from '../lib/econ'

/** The case in one line, before any scrolling: every number is from seasons the model never saw. */
export default function Evidence({ v, heldOut }: { v: Validation; heldOut: number | null }) {
  const years = v.by_year ?? []
  const wins = years.filter((y) => y.r > y.r_gblup).length
  const mean = (v.strategies ?? []).filter((r) => r.year === 'mean' && r.budget === 0.3)
  const ours = mean.find((r) => r.strategy === 'ProMaize, rank by $/acre')
  const std = mean.find((r) => r.strategy.startsWith('standard GBLUP'))
  const lift = ours && std && std.gain > 0 ? ours.gain / std.gain - 1 : null
  const match = (v.plots_to_match ?? []).find((m) => m.year === heldOut)
  const items: [string, string][] = []
  if (years.length > 1) items.push([`${wins} of ${years.length}`, 'seasons it beat standard GBLUP, predicting families it had never seen'])
  if (lift != null) items.push([`+${Math.round(lift * 100)}%`, 'value per acre the field actually paid vs standard GBLUP, same plots'])
  if (v.coverage90 != null && heldOut) items.push([fmtPct(v.coverage90), `of real ${heldOut} results inside our 90% bands`])
  if (match && match.lines_saved > 0) items.push([fmtNum(match.lines_saved), `more lines the standard ranking needed in ${heldOut} to keep the same winners`])
  if (!items.length) return null
  return (
    <div className="evidence" role="list" aria-label="Results from forward tests">
      {items.map(([big, small]) => (
        <div key={small} className="ev" role="listitem"><b>{big}</b><span>{small}</span></div>
      ))}
    </div>
  )
}

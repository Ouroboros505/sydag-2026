import { memo } from 'react'
import type { Validation } from '../lib/types'
import { fmtNum, fmtPct } from '../lib/econ'

/** The case in one line, before any scrolling: every number is from seasons the model never saw. */
function Evidence({ v, heldOut }: { v: Validation; heldOut: number | null }) {
  const years = v.by_year ?? []
  const wins = years.filter((y) => y.r > y.r_gblup).length
  const mean = (v.strategies ?? []).filter((r) => r.year === 'mean' && r.budget === 0.3)
  const ours = mean.find((r) => r.strategy === 'ProMaize, rank by $/acre')
  // the usual practice: the standard engine, ranked by bushels
  const std = mean.find((r) => r.strategy === 'standard GBLUP, rank by bushels')
  const lift = ours && std && std.gain > 0 ? ours.gain / std.gain - 1 : null
  const match = (v.plots_to_match ?? []).find((m) => m.year === heldOut)
  const items: [string, string][] = []
  if (years.length > 1) items.push([`${wins} of ${years.length}`, 'past seasons the family engine beat the standard method (GBLUP) on families it had never seen'])
  if (lift != null) items.push([`+${Math.round(lift * 100)}%`, 'more value per acre than the usual practice (GBLUP, ranked by bushels), as the field actually paid'])
  if (v.coverage90 != null && heldOut) items.push([fmtPct(v.coverage90), `of real ${heldOut} results landed inside the predicted ranges (the target is 90%)`])
  if (match && match.lines_saved > 0) items.push([fmtNum(match.lines_saved), `more plots the usual practice needed in ${heldOut} to keep the same winners`])
  if (!items.length) return null
  return (
    <div className="evidence" role="list" aria-label="Results from forward tests">
      {items.map(([big, small]) => (
        <div key={small} className="ev" role="listitem"><b>{big}</b><span>{small}</span></div>
      ))}
    </div>
  )
}

export default memo(Evidence)

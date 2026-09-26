import { memo } from 'react'
import type { Validation } from '../lib/types'
import { fmtNum, fmtPct } from '../lib/econ'

/** The case in one line, before any scrolling: every number is from seasons the model never saw. */
function Evidence({ v, heldOut }: { v: Validation; heldOut: number | null }) {
  const years = v.by_year ?? []
  // seasons where choosing with ProMaize added value over the usual way (standard model, ranked by bushels),
  // on real field results, plants for 30% of the lines
  const adv = (y: number) => {
    const at = (s: string) => v.strategies?.find((r) => r.year === y && r.budget === 0.3 && r.strategy === s)?.gain
    const a = at('ProMaize, rank by $/acre'), b = at('standard GBLUP, rank by bushels')
    return a != null && b != null ? a - b : null
  }
  const scored = years.map((y) => adv(y.year)).filter((x): x is number => x != null)
  const added = scored.filter((x) => x > 0).length
  const mean = (v.strategies ?? []).filter((r) => r.year === 'mean' && r.budget === 0.3)
  const ours = mean.find((r) => r.strategy === 'ProMaize, rank by $/acre')
  // the usual practice: the standard engine, ranked by bushels
  const std = mean.find((r) => r.strategy === 'standard GBLUP, rank by bushels')
  const lift = ours && std && std.gain > 0 ? ours.gain / std.gain - 1 : null
  const match = (v.plots_to_match ?? []).find((m) => m.year === heldOut)
  const items: [string, string][] = []
  if (scored.length > 1) items.push([`${added} of ${scored.length}`, 'seasons where choosing with ProMaize added value over the usual way, on real field results'])
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

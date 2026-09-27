import { memo } from 'react'
import type { Validation } from '../lib/types'

interface Props {
  v: Validation
  heldOut: number | null
  revealed: boolean
}

/** After harvest, the one check the chart can't show: how many line results landed inside their
 *  predicted ranges. The season-level record is in the chart itself. */
function Evidence({ v, heldOut, revealed }: Props) {
  if (!revealed || v.coverage90 == null || !heldOut) return null
  return (
    <div className="evidence" role="list" aria-label="How far to trust the predictions">
      <div className="ev" role="listitem">
        <b>{Math.round(v.coverage90 * 100)}%</b><span>of real {heldOut} line results landed inside their predicted ranges</span>
      </div>
    </div>
  )
}

export default memo(Evidence)

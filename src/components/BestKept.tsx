import { memo } from 'react'
import type { SeasonPoint } from '../lib/econ'
import Info from './Info'

interface Props { seasons: SeasonPoint[] | null; heldOut: number; revealed: boolean }

const fmt = (n: number) => n.toLocaleString('en-US')
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/** Whether the plan keeps tomorrow's winners: of the lines that turned out best in the field, how many
 *  got a plot, against a random pick of as many lines. The decision year's count waits for the harvest. */
function BestKept({ seasons, heldOut, revealed }: Props) {
  const graded = (seasons ?? []).filter((s) => s.best && s.lines && s.kept != null && s.picked != null)
  const past = graded.filter((s) => s.year < heldOut)
  const now = graded.find((s) => s.year === heldOut)
  if (!past.length) return null
  const [big, small] = revealed && now
    ? [`${fmt(now.kept!)} of ${fmt(now.best!)}`, `best ${heldOut} lines got a plot (random: ${fmt(Math.round((now.best! * now.picked!) / now.lines!))})`]
    : [`${Math.round(mean(past.map((s) => s.kept! / s.best!)) * 100)}%`,
      `of each season's best lines got a plot (random: ${Math.round(mean(past.map((s) => s.picked! / s.lines!)) * 100)}%)`]
  return (
    <div className="evidence" role="list" aria-label="Best lines kept">
      <div className="ev" role="listitem">
        <b>{big}</b>
        <span>{small}<Info>
          <b>Best lines</b>: the top 10% of a season's lines by real income per acre, measured in the field
          {revealed && now ? '.' : `, ${past[0].year} to ${past[past.length - 1].year}.`}
        </Info></span>
      </div>
    </div>
  )
}

export default memo(BestKept)

import { memo } from 'react'
import type { YearResult } from '../lib/types'
import Info from './Info'

/** The structure of the data that drives the recommendation: each season's families by how much of
 *  their pedigree was on record, next to how well the family call worked that season. */
function Pedigree({ years, heldOut }: { years: YearResult[]; heldOut: number | null }) {
  const rows = years.filter((y) => y.families_none != null && y.families_one != null && y.families_both != null)
  if (rows.length < 2) return null
  const W = 720, H = 268, M = { t: 18, r: 56, b: 56, l: 44 }
  const maxF = Math.max(...rows.map((y) => (y.families_none ?? 0) + (y.families_one ?? 0) + (y.families_both ?? 0)))
  const bw = (W - M.l - M.r) / rows.length
  const yF = (v: number) => H - M.b - (v / maxF) * (H - M.t - M.b)
  const rMax = 0.5
  const yR = (v: number) => H - M.b - (Math.max(0, v) / rMax) * (H - M.t - M.b)
  const cx = (i: number) => M.l + i * bw + bw / 2
  const line = rows.map((y, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)},${yR(y.r_between).toFixed(1)}`).join(' ')
  const seg: [keyof YearResult, string, string][] = [
    ['families_both', 'var(--series-1)', 'both parents on record'],
    ['families_one', 'var(--text-3)', 'one'],
    ['families_none', 'var(--warn)', 'neither'],
  ]
  return (
    <div className="panel">
      <h2>When a family's parents are unknown<Info wide>
        Bars: each season's new families, by how many of their two parents already had a family tested in earlier
        years. Dots: how well ProMaize ranked those families before they were planted (forward r of the family means).
        When more parents are new, the family call is weaker, so betting the plots on the top-predicted families pays
        less and spreading them evenly costs less. That is why ProMaize gives every family a fair share in a season
        like {heldOut ?? 'this one'}.
      </Info></h2>
      <div className="chartbox">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
          aria-label="Families per season by pedigree on record, with the accuracy of the family call">
          {[0, 0.25, 0.5].map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={yR(v)} y2={yR(v)} stroke="var(--grid)" />
              <text x={W - M.r + 6} y={yR(v) + 4} fontSize={11} fill="var(--text-3)">r {v.toFixed(2)}</text>
            </g>
          ))}
          {rows.map((y, i) => {
            let acc = 0
            return (
              <g key={y.year}>
                {seg.map(([k, color]) => {
                  const n = (y[k] as number) ?? 0
                  const top = yF(acc + n), bottom = yF(acc)
                  acc += n
                  return <rect key={k} x={M.l + i * bw + 10} y={top} width={bw - 20} height={Math.max(0, bottom - top)}
                    fill={color} opacity={k === 'families_one' ? 0.45 : 0.8} />
                })}
                <text x={cx(i)} y={H - M.b + 16} textAnchor="middle" fontSize={11}
                  fill={y.year === heldOut ? 'var(--text)' : 'var(--text-3)'} fontWeight={y.year === heldOut ? 700 : 400}>
                  {y.year}
                </text>
                <text x={cx(i)} y={H - M.b + 30} textAnchor="middle" fontSize={10} fill="var(--text-3)">{acc} families</text>
              </g>
            )
          })}
          <path d={line} fill="none" stroke="var(--text)" strokeWidth={2} />
          {rows.map((y, i) => (
            <g key={`r${y.year}`}>
              <circle cx={cx(i)} cy={yR(y.r_between)} r={5} fill="var(--surface)" stroke="var(--text)" strokeWidth={2} />
              <text x={cx(i) + 8} y={yR(y.r_between) - 6} fontSize={11} fill="var(--text)">{y.r_between.toFixed(2)}</text>
            </g>
          ))}
          <text x={M.l} y={H - 4} fontSize={11} fill="var(--text-3)">
            bars: families per season (left scale) · dots: accuracy of the family call before planting (right scale)
          </text>
        </svg>
      </div>
      <div className="legend">
        {seg.map(([k, color, label]) => (
          <span key={k}><i style={{ background: color, opacity: k === 'families_one' ? 0.45 : 0.8, height: 10, width: 10 }} />{label}</span>
        ))}
        <span><i style={{ background: 'var(--text)', borderRadius: 99, height: 10, width: 10 }} />family-call accuracy</span>
      </div>
    </div>
  )
}

export default memo(Pedigree)

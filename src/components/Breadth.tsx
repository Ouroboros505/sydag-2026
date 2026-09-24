import { useMemo, useState } from 'react'
import type { Scored } from '../lib/econ'
import { fmtNum, fmtUSD, niceTicks, summarize } from '../lib/econ'

interface Props {
  scored: Scored[]
  budget: number
  cap: number
  onCap: (c: number) => void
}

const CAPS = [Infinity, 60, 40, 30, 25, 20, 15, 10, 8, 5]
const W = 760
const H = 240
const M = { t: 16, r: 20, b: 40, l: 56 }

/** The price of genetic breadth: each point is one family cap, placed by how broad the
 *  advanced set becomes and how much margin that costs. */
export default function Breadth({ scored, budget, cap, onCap }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const pts = useMemo(
    () =>
      CAPS.map((c) => {
        const s = summarize(scored, budget, c)
        return { cap: c, n: s.advanced.length, breadth: s.diversity.effective, gain: s.gainByMargin, largest: s.diversity.largestShare }
      }).filter((p) => p.n >= budget),
    [scored, budget],
  )
  if (pts.length < 2) return null

  const xMax = Math.max(...pts.map((p) => p.breadth)) * 1.08
  const gMax = Math.max(...pts.map((p) => p.gain))
  const ticks = niceTicks(gMax * 1.1, 3)
  const top = ticks[ticks.length - 1]
  const x = (v: number) => M.l + (v / xMax) * (W - M.l - M.r)
  const y = (v: number) => M.t + (1 - Math.max(0, v) / top) * (H - M.t - M.b)
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.breadth).toFixed(1)},${y(p.gain).toFixed(1)}`).join(' ')
  const base = pts[0]
  const shown = hover !== null ? pts[hover] : null

  return (
    <div className="panel" style={{ position: 'relative' }}>
      <h2>The price of genetic breadth</h2>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label="Margin gain per acre versus effective number of families in the advanced set, one point per family cap">
        {ticks.map((v) => {
          return (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
              <text x={M.l - 8} y={y(v) + 4} fontSize={11} fill="var(--text-3)" textAnchor="end">{fmtUSD(v)}</text>
            </g>
          )
        })}
        {niceTicks(xMax, 5).filter((t) => t <= xMax).map((t) => (
          <text key={`x${t}`} x={x(t)} y={H - M.b + 16} fontSize={11} fill="var(--text-3)" textAnchor="middle">{fmtNum(t)}</text>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 6} fontSize={11} fill="var(--text-3)" textAnchor="middle">
          effective number of families advanced →  broader
        </text>
        <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2} />
        {pts.map((p, i) => {
          const on = p.cap === cap
          return (
            <g key={String(p.cap)} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => onCap(p.cap)}>
              <circle cx={x(p.breadth)} cy={y(p.gain)} r={12} fill="transparent" />
              <circle cx={x(p.breadth)} cy={y(p.gain)} r={on ? 6 : 4.5}
                fill={on ? 'var(--series-1)' : 'var(--surface)'} stroke="var(--series-1)" strokeWidth={2} />
              <text x={x(p.breadth) + (i === 0 ? -9 : 0)} y={y(p.gain) + (i === 0 ? 4 : -10)} fontSize={11}
                fill="var(--text-2)" textAnchor={i === 0 ? 'end' : 'middle'}>
                {Number.isFinite(p.cap) ? p.cap : 'no cap'}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="legend">
        <span className="muted">each point is a per-family limit · click one to apply it</span>
      </div>
      {shown && (
        <div className="tip" style={{ right: 20, top: 44 }}>
          limit <b>{Number.isFinite(shown.cap) ? shown.cap : 'none'}</b> · {fmtNum(shown.breadth, 1)} effective families ·
          largest {Math.round(shown.largest * 100)}% · costs <b>{fmtUSD(base.gain - shown.gain, 2)}</b>/ac
        </div>
      )}
    </div>
  )
}

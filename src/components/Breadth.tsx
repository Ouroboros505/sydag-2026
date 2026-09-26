import { memo, useMemo, useState } from 'react'
import type { Scored } from '../lib/econ'
import { advanceOrder, diversity, evenShare, fmtNum, fmtUSD, niceTicks, populationMean } from '../lib/econ'
import Info from './Info'

interface Props {
  scored: Scored[]
  budget: number
  cap: number
  even?: boolean
  onCap: (c: number) => void
  onEven?: () => void
}

const CAPS = [Infinity, 60, 40, 30, 25, 20, 15, 10, 8, 5]
const W = 760
const H = 240
const M = { t: 16, r: 20, b: 40, l: 56 }

/** The price of genetic breadth: each point is one family cap, placed by how broad the
 *  advanced set becomes and how much margin that costs. */
function Breadth({ scored, budget, cap, even = false, onCap, onEven }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  // each limit's ordering depends only on prices; a budget move then only walks the first k lines
  const orders = useMemo(() => CAPS.map((c) => advanceOrder(scored, c)), [scored])
  const mean = useMemo(() => populationMean(scored), [scored])
  const pts = useMemo(
    () =>
      CAPS.map((c, j) => {
        const adv = orders[j].slice(0, budget)
        let s = 0
        for (const x of adv) s += x.margin
        const d = diversity(adv)
        return { cap: c, n: adv.length, breadth: d.effective, gain: s / (adv.length || 1) - mean, largest: d.largestShare }
      }).filter((p) => p.n >= budget),
    [orders, mean, budget],
  )
  const evenPt = useMemo(() => {
    const adv = evenShare(scored, budget)
    let s = 0
    for (const x of adv) s += x.margin
    const d = diversity(adv)
    return { breadth: d.effective, gain: s / (adv.length || 1) - mean, largest: d.largestShare }
  }, [scored, budget, mean])
  if (pts.length < 2) return null

  const xMax = Math.max(evenPt.breadth, ...pts.map((p) => p.breadth)) * 1.08
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
      <h2>The price of genetic breadth<Info wide>
        Each point is one family limit ("at most N lines from any single family"). Left to right: the advanced set gets
        more varied (more effective families). Top to bottom: it gets worth less per acre, because the limit forces you
        to skip some of the highest-ranked siblings. It prices diversity in dollars: a limit around 40 roughly doubles
        the breadth for a couple of dollars an acre. The <b>diamond</b> gives every family the same share of plots and lets
        markers choose the siblings: in the backtest the cheapest way to buy breadth when the family call is weak.
        Click a point to apply it.
      </Info></h2>
      <div className="chartbox">
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
        <g style={{ cursor: 'pointer' }} onClick={() => onEven?.()}>
          <rect x={x(evenPt.breadth) - 6} y={y(evenPt.gain) - 6} width={12} height={12} transform={`rotate(45 ${x(evenPt.breadth)} ${y(evenPt.gain)})`}
            fill={even ? 'var(--good)' : 'var(--surface)'} stroke="var(--good)" strokeWidth={2} />
          <text x={x(evenPt.breadth)} y={y(evenPt.gain) + 22} fontSize={11} fill="var(--good)" textAnchor="middle">same share per family</text>
        </g>
        {pts.map((p, i) => {
          const on = !even && p.cap === cap
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
      </div>
      <div className="legend">
        <span className="muted">each point is a per-family limit · the diamond gives every family the same share · click to apply</span>
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

export default memo(Breadth)

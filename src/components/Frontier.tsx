import { useMemo, useRef, useState } from 'react'
import type { FrontierPoint } from '../lib/econ'
import { fmtNum, fmtUSD, niceTicks } from '../lib/econ'

interface Props {
  points: FrontierPoint[]
  budget: number
  onBudget?: (k: number) => void
}

const W = 760
const H = 300
const M = { t: 18, r: 92, b: 40, l: 56 }

export default function Frontier({ points, budget, onBudget }: Props) {
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<FrontierPoint | null>(null)
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null)

  const n = points[points.length - 1]?.k ?? 1
  const yMax = useMemo(() => Math.max(1, ...points.map((p) => Math.max(p.byMargin, p.byYield))), [points])
  const ticksY = useMemo(() => niceTicks(yMax, 4), [yMax])
  const top = ticksY[ticksY.length - 1]
  const ticksX = useMemo(() => niceTicks(n, 4).filter((t) => t <= n), [n])

  const x = (k: number) => M.l + (k / n) * (W - M.l - M.r)
  const y = (v: number) => M.t + (1 - Math.max(0, v) / top) * (H - M.t - M.b)

  const path = (key: 'byMargin' | 'byYield') =>
    points.map((p, i) => `${i ? 'L' : 'M'}${x(p.k).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')

  const nearest = (k: number) => {
    const i = points.findIndex((p) => p.k >= k)
    return points[i === -1 ? points.length - 1 : i]
  }
  const at = useMemo(() => nearest(budget), [points, budget]) // eslint-disable-line react-hooks/exhaustive-deps
  const last = points[points.length - 1]

  function move(e: React.MouseEvent<SVGSVGElement>) {
    const svg = ref.current
    if (!svg) return
    const r = svg.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const k = Math.round(((px - M.l) / (W - M.l - M.r)) * n)
    setHover(nearest(Math.max(1, Math.min(n, k))))
    setMouse({ x: e.clientX - r.left, y: e.clientY - r.top })
  }

  // keep the two end labels from colliding
  const yM = y(last.byMargin)
  const yY = y(last.byYield)
  const sep = Math.abs(yM - yY) < 14
  const labelM = sep ? Math.min(yM, yY) - 3 : yM + 4
  const labelY = sep ? Math.max(yM, yY) + 11 : yY + 4

  return (
    <div className="panel" style={{ position: 'relative' }}>
      <h2>Expected gain per advanced acre, as the budget grows</h2>
      <svg
        ref={ref}
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Dollars per acre gained over random selection as more lines are advanced, for ranking by margin versus ranking by yield"
        onMouseMove={move}
        onMouseLeave={() => { setHover(null); setMouse(null) }}
        onClick={() => hover && onBudget?.(Math.max(10, hover.k))}
        style={{ cursor: onBudget ? 'pointer' : 'default' }}
      >
        {ticksY.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={M.l - 8} y={y(t) + 4} fontSize={11} fill="var(--text-3)" textAnchor="end">{fmtUSD(t)}</text>
          </g>
        ))}
        {ticksX.map((k) => (
          <text key={k} x={x(k)} y={H - M.b + 18} fontSize={11} fill="var(--text-3)" textAnchor="middle">{fmtNum(k)}</text>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 6} fontSize={11} fill="var(--text-3)" textAnchor="middle">lines advanced</text>
        <text x={12} y={M.t + 4} fontSize={11} fill="var(--text-3)" transform={`rotate(-90 12 ${M.t + 4})`} textAnchor="end">$/acre over random</text>

        <path d={path('byYield')} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" />
        <path d={path('byMargin')} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />

        <text x={x(last.k) + 8} y={labelM} fontSize={12} fill="var(--text-2)">by $/acre</text>
        <text x={x(last.k) + 8} y={labelY} fontSize={12} fill="var(--text-2)">by bushels</text>

        <line x1={x(at.k)} x2={x(at.k)} y1={M.t} y2={H - M.b} stroke="var(--text-3)" strokeWidth={1} strokeDasharray="3 3" />
        <circle cx={x(at.k)} cy={y(at.byMargin)} r={5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
        <circle cx={x(at.k)} cy={y(at.byYield)} r={5} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />
        <text x={x(at.k) + (x(at.k) > W - M.r - 60 ? -6 : 6)} y={M.t + 10} fontSize={11} fill="var(--text-2)"
          textAnchor={x(at.k) > W - M.r - 60 ? "end" : "start"}>budget</text>

        {hover && (
          <line x1={x(hover.k)} x2={x(hover.k)} y1={M.t} y2={H - M.b} stroke="var(--text-2)" strokeWidth={1} opacity={0.5} />
        )}
      </svg>
      <div className="legend">
        <span><i style={{ background: 'var(--series-1)' }} />ranking by $/acre</span>
        <span><i style={{ background: 'var(--series-2)' }} />ranking by bushels</span>
        {onBudget && <span className="muted">click the chart to set the budget</span>}
      </div>
      {hover && mouse && (
        <div className="tip" style={{ left: mouse.x + 12, top: mouse.y - 8 }}>
          {fmtNum(hover.k)} lines · by $ <b>{fmtUSD(hover.byMargin)}</b>/ac · by bu <b>{fmtUSD(hover.byYield)}</b>/ac
        </div>
      )}
    </div>
  )
}

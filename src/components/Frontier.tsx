import { useMemo, useRef, useState } from 'react'
import type { FrontierPoint } from '../lib/econ'
import { fmtNum, fmtPct } from '../lib/econ'

interface Props {
  points: FrontierPoint[]
  budget: number
  onBudget?: (k: number) => void
}

const W = 760
const H = 300
const M = { t: 16, r: 84, b: 40, l: 48 }

export default function Frontier({ points, budget, onBudget }: Props) {
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<FrontierPoint | null>(null)
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null)

  const n = points[points.length - 1]?.k ?? 1
  const x = (k: number) => M.l + (k / n) * (W - M.l - M.r)
  const y = (v: number) => M.t + (1 - v) * (H - M.t - M.b)

  const path = (key: 'byMargin' | 'byYield') =>
    points.map((p, i) => `${i ? 'L' : 'M'}${x(p.k).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')

  const at = useMemo(() => {
    const i = points.findIndex((p) => p.k >= budget)
    return points[i === -1 ? points.length - 1 : i]
  }, [points, budget])

  const last = points[points.length - 1]

  function move(e: React.MouseEvent<SVGSVGElement>) {
    const svg = ref.current
    if (!svg) return
    const r = svg.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const k = Math.round(((px - M.l) / (W - M.l - M.r)) * n)
    const i = points.findIndex((p) => p.k >= k)
    const p = points[Math.max(0, i === -1 ? points.length - 1 : i)]
    setHover(p)
    setMouse({ x: e.clientX - r.left, y: e.clientY - r.top })
  }

  const ticksY = [0, 0.25, 0.5, 0.75, 1]
  const ticksX = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * n))

  return (
    <div className="panel" style={{ position: 'relative' }}>
      <h2>Margin captured vs lines advanced</h2>
      <svg
        ref={ref}
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Share of achievable margin captured as the number of advanced lines grows, for margin ranking versus yield ranking"
        onMouseMove={move}
        onMouseLeave={() => { setHover(null); setMouse(null) }}
        onClick={() => hover && onBudget?.(Math.max(10, hover.k))}
        style={{ cursor: onBudget ? 'pointer' : 'default' }}
      >
        {ticksY.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={M.l - 8} y={y(t) + 4} fontSize={11} fill="var(--text-3)" textAnchor="end">{fmtPct(t)}</text>
          </g>
        ))}
        {ticksX.map((k) => (
          <text key={k} x={x(k)} y={H - M.b + 18} fontSize={11} fill="var(--text-3)" textAnchor="middle">{fmtNum(k)}</text>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 6} fontSize={11} fill="var(--text-3)" textAnchor="middle">lines advanced</text>

        <path d={path('byYield')} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" />
        <path d={path('byMargin')} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />

        <text x={x(last.k) + 8} y={y(last.byMargin) + 4} fontSize={12} fill="var(--text-2)">by $/acre</text>
        <text x={x(last.k) + 8} y={y(last.byYield) + 16} fontSize={12} fill="var(--text-2)">by bushels</text>

        <line x1={x(at.k)} x2={x(at.k)} y1={M.t} y2={H - M.b} stroke="var(--text-3)" strokeWidth={1} strokeDasharray="3 3" />
        <circle cx={x(at.k)} cy={y(at.byMargin)} r={5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
        <circle cx={x(at.k)} cy={y(at.byYield)} r={5} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />
        <text x={x(at.k) + 6} y={M.t + 12} fontSize={11} fill="var(--text-2)">budget</text>

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
          {fmtNum(hover.k)} lines · by $ <b>{fmtPct(hover.byMargin, 1)}</b> · by bu <b>{fmtPct(hover.byYield, 1)}</b>
        </div>
      )}
    </div>
  )
}

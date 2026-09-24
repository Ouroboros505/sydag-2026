import { useMemo, useRef, useState } from 'react'
import type { Scored } from '../lib/econ'
import { fmtUSD } from '../lib/econ'

interface Props {
  all: Scored[]
  advanced: Set<string>
}

const W = 760
const H = 300
const M = { t: 12, r: 12, b: 28, l: 12 }

export default function GenomicMap({ all, advanced }: Props) {
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<Scored | null>(null)
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null)

  const pts = useMemo(() => all.filter((c) => c.pc1 !== undefined && c.pc2 !== undefined), [all])
  const [x, y] = useMemo(() => {
    const xs = pts.map((c) => c.pc1!), ys = pts.map((c) => c.pc2!)
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)]
    const [y0, y1] = [Math.min(...ys), Math.max(...ys)]
    return [
      (v: number) => M.l + ((v - x0) / (x1 - x0 || 1)) * (W - M.l - M.r),
      (v: number) => M.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - M.t - M.b),
    ]
  }, [pts])

  if (!pts.length) return null
  const out = pts.filter((c) => !advanced.has(c.id))
  const inn = pts.filter((c) => advanced.has(c.id))

  function move(e: React.MouseEvent<SVGSVGElement>) {
    const svg = ref.current
    if (!svg) return
    const r = svg.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const py = ((e.clientY - r.top) / r.height) * H
    let best: Scored | null = null
    let bd = 14 * 14
    for (const c of pts) {
      const d = (x(c.pc1!) - px) ** 2 + (y(c.pc2!) - py) ** 2
      if (d < bd) { bd = d; best = c }
    }
    setHover(best)
    setMouse({ x: e.clientX - r.left, y: e.clientY - r.top })
  }

  return (
    <div className="panel" style={{ position: 'relative' }}>
      <h2>Genomic map: what you're advancing, and what you're leaving</h2>
      <div className="chartbox">
      <svg
        ref={ref} className="chart" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label="Candidates plotted by their top two genomic principal components; advanced lines highlighted"
        onMouseMove={move} onMouseLeave={() => { setHover(null); setMouse(null) }}
      >
        {out.map((c) => (
          <circle key={c.id} cx={x(c.pc1!)} cy={y(c.pc2!)} r={4} fill="var(--text-3)" opacity={0.28} />
        ))}
        {inn.map((c) => (
          <circle key={c.id} cx={x(c.pc1!)} cy={y(c.pc2!)} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={1} />
        ))}
        {hover && (
          <circle cx={x(hover.pc1!)} cy={y(hover.pc2!)} r={7} fill="none" stroke="var(--text)" strokeWidth={1.5} />
        )}
        <text x={W - M.r} y={H - 8} fontSize={11} fill="var(--text-3)" textAnchor="end">
          genomic PC1 →   (nearby points are close relatives)
        </text>
      </svg>
      </div>
      <div className="legend">
        <span><i style={{ background: 'var(--series-1)', height: 8, width: 8, borderRadius: 4 }} />advanced</span>
        <span><i style={{ background: 'var(--text-3)', opacity: 0.4, height: 8, width: 8, borderRadius: 4 }} />not advanced</span>
        <span className="muted">a tight blue cluster means the budget is going to one family</span>
      </div>
      {hover && mouse && (
        <div className="tip" style={{ left: mouse.x + 12, top: mouse.y - 8 }}>
          <b>{hover.id}</b> · {hover.family} · <b>{fmtUSD(hover.margin)}</b>/ac · {advanced.has(hover.id) ? 'advanced' : 'not advanced'}
        </div>
      )}
    </div>
  )
}

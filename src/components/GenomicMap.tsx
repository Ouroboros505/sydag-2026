import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Scored } from '../lib/econ'
import { fmtUSD } from '../lib/econ'
import Info from './Info'

interface Props {
  all: Scored[]
  advanced: Set<string>
}

const W = 760
const H = 300
const M = { t: 12, r: 12, b: 28, l: 12 }

// 16k points: drawn on a canvas, not as 16k SVG elements, so moving a slider stays instant
function GenomicMap({ all, advanced }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [hover, setHover] = useState<Scored | null>(null)
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null)

  const pts = useMemo(() => all.filter((c) => c.pc1 !== undefined && c.pc2 !== undefined), [all])
  const [x, y] = useMemo(() => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const c of pts) {
      x0 = Math.min(x0, c.pc1!); x1 = Math.max(x1, c.pc1!); y0 = Math.min(y0, c.pc2!); y1 = Math.max(y1, c.pc2!)
    }
    return [
      (v: number) => M.l + ((v - x0) / (x1 - x0 || 1)) * (W - M.l - M.r),
      (v: number) => M.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - M.t - M.b),
    ]
  }, [pts])

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const dpr = window.devicePixelRatio || 1
    el.width = W * dpr
    el.height = H * dpr
    const g = el.getContext('2d')
    if (!g) return
    g.scale(dpr, dpr)
    const css = getComputedStyle(document.documentElement)
    const grey = css.getPropertyValue('--text-3').trim() || '#888'
    const blue = css.getPropertyValue('--series-1').trim() || '#3b82f6'
    g.clearRect(0, 0, W, H)
    g.globalAlpha = 0.28
    g.fillStyle = grey
    for (const c of pts) {
      if (advanced.has(c.id)) continue
      g.beginPath(); g.arc(x(c.pc1!), y(c.pc2!), 3.5, 0, 2 * Math.PI); g.fill()
    }
    g.globalAlpha = 1
    g.fillStyle = blue
    for (const c of pts) {
      if (!advanced.has(c.id)) continue
      g.beginPath(); g.arc(x(c.pc1!), y(c.pc2!), 3.5, 0, 2 * Math.PI); g.fill()
    }
  }, [pts, advanced, x, y])

  if (!pts.length) return null

  function move(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
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
      <h2>Genomic map: what you're advancing, and what you're leaving<Info wide>
        Every candidate is a dot, placed by its DNA: lines that sit close together are genetically similar, usually
        relatives. (Technically the top two principal components of the marker matrix; the axes have no units.)
        <b>Blue</b> dots are the lines you're advancing. If the blue dots bunch into one tight cluster, the budget is
        going to one family; spread out means a varied set.
      </Info></h2>
      <div className="chartbox">
        <div className="chart" style={{ position: 'relative', width: '100%', aspectRatio: `${W} / ${H}` }}
          onMouseMove={move} onMouseLeave={() => { setHover(null); setMouse(null) }}
          role="img" aria-label="Candidates plotted by their top two genomic principal components; advanced lines highlighted">
          <canvas ref={canvas} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            {hover && <circle cx={x(hover.pc1!)} cy={y(hover.pc2!)} r={7} fill="none" stroke="var(--text)" strokeWidth={1.5} />}
            <text x={W - M.r} y={H - 8} fontSize={11} fill="var(--text-3)" textAnchor="end">
              genomic PC1 →   (nearby points are close relatives)
            </text>
          </svg>
        </div>
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

export default memo(GenomicMap)

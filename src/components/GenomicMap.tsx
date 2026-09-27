import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Scored } from '../lib/econ'
import { actualMargin, type Prices } from '../lib/econ'
import Info from './Info'

interface Props {
  all: Scored[]
  prices: Prices
  revealed: boolean             // January: what each family was predicted to earn; after harvest: what it earned
}

const W = 760
const H = 300
const M = { t: 22, r: 12, b: 12, l: 12 }
const UP = '#2e9e4a', DOWN = '#d04a3a', EVEN = '#9a988f'
// red through grey ($0) to green, like the site map
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a: string, b: string, t: number) => {
  const A = rgb(a), B = rgb(b)
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`
}
const colour = (v: number, lim: number) => {
  const t = Math.max(-1, Math.min(1, v / lim))
  return t >= 0 ? mix(EVEN, UP, t) : mix(EVEN, DOWN, -t)
}
const usd0 = (v: number) => `${v < 0 ? '−' : '+'}$${Math.abs(Math.round(v))}`

/** The new lines placed by their DNA, so relatives sit together and the two genetic pools separate; each dot
 *  takes its family's average income against the average new line, predicted in January and real after
 *  harvest. 16k points: drawn on a canvas, so moving a slider stays instant. */
function GenomicMap({ all, prices, revealed }: Props) {
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

  // each family's average income against the average new line, predicted and real; one scale for both views
  const fam = useMemo(() => {
    const avg = (xs: (number | null)[]) => {
      const v = xs.filter((z): z is number => z != null)
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
    }
    const byFam = new Map<string, Scored[]>()
    for (const c of pts) byFam.set(c.family, [...(byFam.get(c.family) ?? []), c])
    const real = (c: Scored) => actualMargin(c, prices)
    const allPred = avg(pts.map((c) => c.margin)) ?? 0, allReal = avg(pts.map(real))
    const pred = new Map<string, number>(), act = new Map<string, number>()
    for (const [f, cs] of byFam) {
      pred.set(f, (avg(cs.map((c) => c.margin)) ?? allPred) - allPred)
      const r = avg(cs.map(real))
      if (r != null && allReal != null) act.set(f, r - allReal)
    }
    const p90 = (m: Map<string, number>) => {
      const a = [...m.values()].map(Math.abs).sort((u, v) => u - v)
      return a.length ? a[Math.floor(0.9 * (a.length - 1))] : 0
    }
    const lim = Math.max(5, Math.round(Math.max(p90(pred), p90(act)) / 5) * 5)
    return { pred, act, lim }
  }, [pts, prices])
  const value = (c: Scored) => (revealed ? fam.act.get(c.family) : fam.pred.get(c.family))

  // a label above each genetic pool
  const pools = useMemo(() => {
    const g = new Map<string, { xs: number[]; top: number }>()
    for (const c of pts) {
      const k = c.group || '?'
      const e = g.get(k) ?? { xs: [], top: Infinity }
      e.xs.push(x(c.pc1!)); e.top = Math.min(e.top, y(c.pc2!))
      g.set(k, e)
    }
    return [...g].map(([k, e]) => ({ k, x: e.xs.sort((a, b) => a - b)[Math.floor(e.xs.length / 2)], y: e.top - 8 }))
  }, [pts, x, y])

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const dpr = window.devicePixelRatio || 1
    el.width = W * dpr
    el.height = H * dpr
    const g = el.getContext('2d')
    if (!g) return
    g.scale(dpr, dpr)
    g.clearRect(0, 0, W, H)
    g.globalAlpha = 0.8
    for (const c of pts) {
      const v = value(c)
      g.fillStyle = v == null ? EVEN : colour(v, fam.lim)
      g.beginPath(); g.arc(x(c.pc1!), y(c.pc2!), 3.2, 0, 2 * Math.PI); g.fill()
    }
  }, [pts, x, y, fam, revealed])   // eslint-disable-line react-hooks/exhaustive-deps

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

  const hv = hover ? value(hover) : undefined
  return (
    <div className="panel" style={{ position: 'relative' }}>
      <h2>Income by DNA group<Info wide>
        Each dot is a new line, placed by its DNA markers: close dots are close relatives, so a family's siblings sit
        together and the two genetic pools, the C1 and C2 lines, sit apart. (For breeders: the top two principal
        components of the marker matrix.) <b>Colour</b> is the line's family average income per acre against the
        average new line: {revealed ? 'what it really earned in the field' : 'what it was predicted to earn in January'}.
        Switch the chart at the top between January and After harvest to compare.
        {revealed && <><br /><br />Which family wins was hard to foresee this season: predicted and real family averages
          barely line up. Which sibling wins was not (the staircase above). That is why every family gets a fair share.</>}
      </Info></h2>
      <div className="chartbox">
        <div className="chart" style={{ position: 'relative', width: '100%', aspectRatio: `${W} / ${H}` }}
          onMouseMove={move} onMouseLeave={() => { setHover(null); setMouse(null) }}
          role="img" aria-label={`The new lines placed by their DNA, coloured by their family's ${revealed ? 'real' : 'predicted'} income per acre`}>
          <canvas ref={canvas} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            {pools.map((p) => (
              <text key={p.k} x={p.x} y={Math.max(12, p.y)} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text-2)">{p.k} pool</text>
            ))}
            {hover && <circle cx={x(hover.pc1!)} cy={y(hover.pc2!)} r={7} fill="none" stroke="var(--text)" strokeWidth={1.5} />}
          </svg>
        </div>
      </div>
      <div className="legend" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ whiteSpace: 'normal' }}>Family's {revealed ? 'real' : 'predicted'} income per acre, against the average new line</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          −${fam.lim}
          <i style={{ width: 120, height: 8, margin: 0, borderRadius: 4, background: `linear-gradient(to right, ${DOWN}, ${EVEN}, ${UP})` }} />
          +${fam.lim}
        </span>
      </div>
      {hover && mouse && (
        <div className="tip" style={{ left: mouse.x + 12, top: mouse.y - 8 }}>
          <b>{hover.id}</b> · family {hover.family}{hv != null && <>: <b>{usd0(hv)}</b>/acre against the average line</>}
        </div>
      )}
    </div>
  )
}

export default memo(GenomicMap)

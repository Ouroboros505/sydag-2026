import { memo, useRef, useState } from 'react'
import type { EngineId } from '../lib/types'
import type { PlanForecast } from '../lib/econ'
import Info from './Info'

interface Props {
  f: PlanForecast | null
  heldOut: number
  engine: EngineId
  corn: number                  // the corn price the values are computed at
  revealed: boolean
  onReveal: (r: boolean) => void
}

const NAME: Record<EngineId, string> = { family: '2-Step', gblup: 'Standard', environment: 'Environment' }
// every value sits above (or below) the 'random pick' line, so it carries its sign
const usd = (v: number) => `${v < 0 ? '−' : '+'}$${Math.abs(v).toFixed(2)}`
// n - 1 times in n + 1, in lowest terms: 4 in 6 reads as 2 in 3
const odds = (n: number) => {
  let a = n - 1, b = n + 1
  for (let d = a; d > 1; d--) if (a % d === 0 && b % d === 0) { a /= d; b /= d; break }
  return `${a} time${a === 1 ? '' : 's'} in ${b}`
}

interface Range { year: number; lo: number; hi: number; real: number | null; slot: number }

/** The opening chart: the money the chosen engine's picks are worth. Past seasons show what the
 *  picks really earned, what the engine forecast that January and the range it gave; the decision year
 *  is a forecast and a range until the harvest is revealed. Hovering a range explains it. */
function SeasonForecast({ f, heldOut, engine, corn, revealed, onReveal }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ r: Range; box: DOMRect } | null>(null)
  if (!f) return null
  const { now, forecast, past } = f
  const first = past[0]?.year ?? heldOut

  // geometry
  const W = 720, H = 270, L = 84, R = 16, T = 34, B = 34
  const slots = [...past.map((s) => s.year), heldOut]
  const sw = (W - L - R) / slots.length
  const cx = (i: number) => L + i * sw + sw / 2
  const ranges: Range[] = [
    ...past.flatMap((s, i) => (s.lo == null || s.hi == null ? [] : [{ year: s.year, lo: s.lo, hi: s.hi, real: s.real, slot: i }])),
    { year: heldOut, lo: f.lo, hi: f.hi, real: revealed ? now.real : null, slot: slots.length - 1 },
  ]
  const vals = [0, forecast, now.real, ...past.map((s) => s.real), ...past.flatMap((s) => (s.forecast == null ? [] : [s.forecast])),
    ...ranges.flatMap((r) => [r.lo, r.hi])]
  const vmax = Math.max(...vals), vmin = Math.min(...vals)
  const span = (vmax - vmin) || 1
  const top = vmax + span * 0.16, bot = Math.min(0, vmin - span * 0.06)
  const y = (v: number) => T + ((top - v) / (top - bot)) * (H - T - B)
  const step = span > 12 ? 4 : span > 6 ? 2 : 1
  const ticks: number[] = []
  for (let t = Math.ceil(bot / step) * step; t <= top; t += step) ticks.push(t)
  const bw = Math.min(56, sw * 0.5)
  const hx = cx(slots.length - 1)
  const divX = L + (slots.length - 1) * sw

  // the explanation sits above the hovered range, inside the panel so the chart's scroll box can't clip it
  const tipStyle = (() => {
    if (!tip || !panel.current) return undefined
    const p = panel.current.getBoundingClientRect(), b = tip.box
    const last = tip.r.slot === slots.length - 1
    return {
      left: (last ? b.right : b.left + b.width / 2) - p.left, top: b.top - p.top - 8,
      transform: last ? 'translate(-100%, -100%)' : 'translate(-50%, -100%)', whiteSpace: 'normal' as const, width: 250,
    }
  })()
  const show = (r: Range) => (e: React.SyntheticEvent<SVGRectElement>) => setTip({ r, box: e.currentTarget.getBoundingClientRect() })

  return (
    <div className="panel forecast" ref={panel}>
      <h2>Income per acre of tested hybrids<Info wide>
        <b>Bars</b>: the income per acre of the test hybrids of the lines {NAME[engine]} chose, measured in the real
        field, above what a random pick of lines earns (the "random pick" line). Income is yield times price (${corn.toFixed(2)} corn),
        minus drying cost and lodging loss, at an average test site: each trial's weather is taken out.<br /><br />
        <b>Ticks</b>: what {NAME[engine]} forecast that January: its own prediction for the lines it picked, corrected by
        how far the earlier seasons' forecasts had missed.<br /><br />
        <b>Boxes</b>: the range known that January. Hover one to see how it is made.
      </Info></h2>

      <div className="forecast-controls">
        <div className="toggle">
          <button className={!revealed ? 'on' : ''} onClick={() => onReveal(false)}>January {heldOut}</button>
          <button className={revealed ? 'on' : ''} onClick={() => onReveal(true)}>After harvest</button>
        </div>
      </div>

      <div className="chartbox">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
          aria-label={`${NAME[engine]}: real value per season ${past.map((s) => `${s.year} ${usd(s.real)}`).join(', ')}; forecast for ${heldOut} ${usd(forecast)}${revealed ? `; real ${heldOut} ${usd(now.real)}` : ''}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--text-3)' : 'var(--grid)'} strokeWidth={t === 0 ? 1.2 : 1} />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={t === 0 ? 'var(--text-2)' : 'var(--text-3)'}
                fontWeight={t === 0 ? 600 : 400}>{t === 0 ? 'random pick' : `${t < 0 ? '−' : '+'}$${Math.abs(t)}`}</text>
            </g>
          ))}

          {/* the past | the decision year */}
          <line x1={divX} x2={divX} y1={T - 12} y2={H - B + 6} stroke="var(--border)" strokeDasharray="4 4" />

          {/* the ranges, each as known that January: the only thing here that answers the cursor */}
          {ranges.map((r) => {
            const on = tip?.r.year === r.year
            return (
              <rect key={r.year} x={cx(r.slot) - bw * 0.8} y={y(r.hi)} width={bw * 1.6} height={Math.max(2, y(r.lo) - y(r.hi))} rx={6}
                fill="var(--accent)" opacity={on ? 0.3 : 0.16} stroke="var(--accent)" strokeDasharray="3 3" style={{ cursor: 'help' }}
                onMouseEnter={show(r)} onMouseLeave={() => setTip(null)} onClick={show(r)} />
            )
          })}

          <g style={{ pointerEvents: 'none' }}>
            {/* the past: what the picks really earned, and what was forecast that January */}
            {past.map((s, i) => {
              const y0 = y(0), y1 = y(s.real)
              return (
                <g key={s.year}>
                  <rect x={cx(i) - bw / 2} y={Math.min(y0, y1)} width={bw} height={Math.max(1, Math.abs(y1 - y0))} rx={4}
                    fill={s.real >= 0 ? 'var(--good)' : 'var(--text-3)'} opacity={0.8} />
                  <text x={cx(i)} y={(s.forecast != null && y(s.forecast) < y1 && y1 - y(s.forecast) < 16 ? y(s.forecast) : y1) - 7} textAnchor="middle" fontSize={12}
                    fontWeight={600} fill="var(--text-2)">{usd(s.real)}</text>
                  {s.forecast != null && (
                    <line x1={cx(i) - (s.lo == null ? bw / 2 : bw * 0.8) - 5} x2={cx(i) + (s.lo == null ? bw / 2 : bw * 0.8) + 5}
                      y1={y(s.forecast)} y2={y(s.forecast)} stroke="var(--accent)" strokeWidth={2.5} />
                  )}
                </g>
              )
            })}

            {/* the forecast for the decision year */}
            <line x1={hx - bw * 0.8 - 5} x2={hx + bw * 0.8 + 5} y1={y(forecast)} y2={y(forecast)} stroke="var(--accent)" strokeWidth={2.5} />
            {!revealed && (
              <g>
                <text x={hx} y={y(f.hi) - 22} textAnchor="middle" fontSize={11} fill="var(--accent)" fontWeight={600}>forecast</text>
                <text x={hx} y={y(f.hi) - 8} textAnchor="middle" fontSize={11} fill="var(--accent)">{usd(forecast)}</text>
              </g>
            )}

            {/* after harvest: the decision year's real value, rising into place */}
            <g className="reveal" style={{ opacity: revealed ? 1 : 0 }}>
              <rect x={hx - bw / 2} y={Math.min(y(0), y(now.real))} width={bw} height={Math.max(1, Math.abs(y(now.real) - y(0)))} rx={4}
                fill={now.real >= 0 ? 'var(--good)' : 'var(--text-3)'}
                style={{ transform: revealed ? 'scaleY(1)' : 'scaleY(0)', transformBox: 'fill-box', transformOrigin: now.real >= 0 ? 'bottom' : 'top' }} />
              <text x={hx} y={Math.min(y(now.real), y(f.hi)) - 7} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text)">{usd(now.real)}</text>
            </g>

            {slots.map((yr, i) => (
              <text key={yr} x={cx(i)} y={H - B + 20} textAnchor="middle" fontSize={12} fontWeight={yr === heldOut ? 700 : 400}
                fill={yr === heldOut ? 'var(--text)' : 'var(--text-2)'}>{yr}</text>
            ))}
          </g>
        </svg>
      </div>
      {tip && tipStyle && (
        <div className="tip" style={tipStyle} role="tooltip">
          <b>{tip.r.year} range: {usd(tip.r.lo)} to {usd(tip.r.hi)}</b><br />
          What January {tip.r.year} expected if the season went like the worst or the best of the seasons before it
          ({first} to {tip.r.year - 1}).
          {tip.r.year === heldOut && <> With {past.length} earlier seasons, a new season lands inside about {odds(past.length)}.</>}
          {tip.r.real != null && (
            <><br />Real: <b>{usd(tip.r.real)}</b>, {tip.r.real > tip.r.hi ? 'above' : tip.r.real < tip.r.lo ? 'below' : 'inside'} the range.</>
          )}
        </div>
      )}
      <div className="legend" style={{ marginTop: 2 }}>
        <span><i style={{ background: 'var(--good)', opacity: 0.8, height: 10, width: 14, borderRadius: 3 }} />real, after harvest</span>
        <span><i style={{ background: 'var(--accent)', height: 3, width: 16 }} />forecast, that January</span>
        <span><i style={{ background: 'var(--accent)', opacity: 0.3, height: 10, width: 16, borderRadius: 3 }} />range, that January</span>
      </div>
    </div>
  )
}

export default memo(SeasonForecast)

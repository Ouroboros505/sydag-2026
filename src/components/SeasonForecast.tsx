import { memo } from 'react'
import type { EngineId, EngineValueRow } from '../lib/types'
import { planForecast } from '../lib/econ'
import Info from './Info'

interface Props {
  rows: EngineValueRow[]
  heldOut: number
  engine: EngineId
  share: number                 // the left panel's plots, as a share of the new lines
  revealed: boolean
  onReveal: (r: boolean) => void
}

const NAME: Record<EngineId, string> = { family: '2-Step', gblup: 'Standard', environment: 'Environment' }
// the axis already says 'extra', so a plus sign would only add noise; a minus stays
// every value sits above (or below) the 'random pick' line, so it carries its sign
const usd = (v: number) => `${v < 0 ? '−' : '+'}$${Math.abs(v).toFixed(2)}`

/** The opening chart: the money the chosen engine's picks are worth. Past seasons show what the
 *  picks really earned and what the engine forecast that January; the decision year is a forecast
 *  until the harvest is revealed. */
function SeasonForecast({ rows, heldOut, engine, share, revealed, onReveal }: Props) {
  const f = planForecast(rows, engine, share, heldOut)
  if (!f) return null
  const { now, forecast, lo, hi } = f
  const past = f.past, tracked = f.past
  const show = revealed

  // geometry
  const W = 720, H = 270, L = 84, R = 16, T = 34, B = 34
  const slots = [...past.map((s) => s.year), heldOut]
  const sw = (W - L - R) / slots.length
  const cx = (i: number) => L + i * sw + sw / 2
  const vals = [0, lo, hi, forecast, now.real, ...past.map((s) => s.real), ...tracked.flatMap((s) => (s.forecast == null ? [] : [s.forecast]))]
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

  return (
    <div className="panel forecast">
      <h2>Income per acre of tested hybrids<Info wide>
        <b>Bars</b>: the income per acre of the test hybrids of the lines {NAME[engine]} chose, measured in the real
        field, above what a random pick of lines earns (the "random pick" line). Income is yield times price ($4.50 corn),
        minus drying cost and lodging loss, at an average test site: each trial's weather is taken out.<br /><br />
        <b>Ticks</b>: what {NAME[engine]} forecast in January of that season. The raw forecast is the engine's own
        prediction for the lines it picks, which runs high because the best predictions are partly luck, so each
        season's forecast is corrected by how far the earlier seasons' forecasts overshot.<br /><br />
        <b>The shaded band</b> is the forecast for {heldOut}, made the same way, from what was known in January.
      </Info></h2>

      <div className="forecast-controls">
        <div className="toggle">
          <button className={!revealed ? 'on' : ''} onClick={() => onReveal(false)}>January {heldOut}</button>
          <button className={revealed ? 'on' : ''} onClick={() => onReveal(true)}>After harvest</button>
        </div>
      </div>

      <div className="chartbox">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
          aria-label={`${NAME[engine]}: real value per season ${past.map((s) => `${s.year} ${usd(s.real)}`).join(', ')}; forecast for ${heldOut} ${usd(forecast)}${show ? `; real ${heldOut} ${usd(now.real)}` : ''}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--text-3)' : 'var(--grid)'} strokeWidth={t === 0 ? 1.2 : 1} />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={t === 0 ? 'var(--text-2)' : 'var(--text-3)'}
                fontWeight={t === 0 ? 600 : 400}>{t === 0 ? 'random pick' : `${t < 0 ? '−' : '+'}$${Math.abs(t)}`}</text>
            </g>
          ))}

          {/* the past: what the picks really earned, and what was forecast that January */}
          {tracked.map((s, i) => {
            const y0 = y(0), y1 = y(s.real)
            return (
              <g key={s.year}>
                <rect x={cx(i) - bw / 2} y={Math.min(y0, y1)} width={bw} height={Math.max(1, Math.abs(y1 - y0))} rx={4}
                  fill={s.real >= 0 ? 'var(--good)' : 'var(--text-3)'} opacity={0.8} />
                <text x={cx(i)} y={(s.forecast != null && y(s.forecast) < y1 && y1 - y(s.forecast) < 16 ? y(s.forecast) : y1) - 7} textAnchor="middle" fontSize={12}
                  fontWeight={600} fill="var(--text-2)">{usd(s.real)}</text>
                {s.forecast != null && (
                  <line x1={cx(i) - bw / 2 - 5} x2={cx(i) + bw / 2 + 5} y1={y(s.forecast)} y2={y(s.forecast)}
                    stroke="var(--accent)" strokeWidth={2.5} />
                )}
              </g>
            )
          })}

          {/* January | the decision year */}
          <line x1={divX} x2={divX} y1={T - 12} y2={H - B + 6} stroke="var(--border)" strokeDasharray="4 4" />
          <text x={divX - 8} y={T - 2} textAnchor="end" fontSize={11} fill="var(--text-3)">known in January {heldOut}</text>

          {/* the forecast for the decision year */}
          <rect x={hx - bw * 0.8} y={y(hi)} width={bw * 1.6} height={Math.max(2, y(lo) - y(hi))} rx={6}
            fill="var(--accent)" opacity={0.16} stroke="var(--accent)" strokeDasharray="3 3" />
          <line x1={hx - bw * 0.8 - 5} x2={hx + bw * 0.8 + 5} y1={y(forecast)} y2={y(forecast)} stroke="var(--accent)" strokeWidth={2.5} />
          {!show && (
            <g>
              <text x={hx} y={y(hi) - 22} textAnchor="middle" fontSize={11} fill="var(--accent)" fontWeight={600}>forecast</text>
              <text x={hx} y={y(hi) - 8} textAnchor="middle" fontSize={11} fill="var(--accent)">{usd(forecast)}</text>
            </g>
          )}

          {/* after harvest: the decision year's real value, rising into place */}
          <g className="reveal" style={{ opacity: show ? 1 : 0 }}>
            <rect x={hx - bw / 2} y={Math.min(y(0), y(now.real))} width={bw} height={Math.max(1, Math.abs(y(now.real) - y(0)))} rx={4}
              fill={now.real >= 0 ? 'var(--good)' : 'var(--text-3)'}
              style={{ transform: show ? 'scaleY(1)' : 'scaleY(0)', transformBox: 'fill-box', transformOrigin: now.real >= 0 ? 'bottom' : 'top' }} />
            <text x={hx} y={Math.min(y(now.real), y(hi)) - 7} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text)">{usd(now.real)}</text>
          </g>

          {slots.map((yr, i) => (
            <text key={yr} x={cx(i)} y={H - B + 20} textAnchor="middle" fontSize={12} fontWeight={yr === heldOut ? 700 : 400}
              fill={yr === heldOut ? 'var(--text)' : 'var(--text-2)'}>{yr}</text>
          ))}
        </svg>
      </div>
      <div className="legend" style={{ marginTop: 2 }}>
        <span><i style={{ background: 'var(--good)', opacity: 0.8, height: 10, width: 14, borderRadius: 3 }} />real, after harvest</span>
        <span><i style={{ background: 'var(--accent)', height: 3, width: 16 }} />forecast, that January</span>
      </div>
    </div>
  )
}

export default memo(SeasonForecast)

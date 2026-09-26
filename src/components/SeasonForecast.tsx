import { memo, useState } from 'react'
import type { StrategyRow, YearResult } from '../lib/types'
import Info from './Info'

// the usual practice: the standard engine (GBLUP), lines ranked by bushels
const BASE = 'standard GBLUP, rank by bushels'
const AGGRESSIVE = 'ProMaize, rank by $/acre'
const CONSERVATIVE = 'ProMaize, same share of every family'
// a season whose new families often have neither parent on record: the family call is weak there
const THIN = 0.15

interface Props {
  rows: StrategyRow[]
  years: YearResult[]
  heldOut: number
  even: boolean                 // the left panel's conservative switch
  revealed: boolean
  onReveal: (r: boolean) => void
}

const usd = (v: number) => `${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(2)}`

/** The opening chart: what the same plots earned, season by season, over the usual practice; the
 *  decision year is a forecast until it is revealed. */
function SeasonForecast({ rows, years, heldOut, even, revealed, onReveal }: Props) {
  const [budget, setBudget] = useState(0.3)
  const plan = even ? CONSERVATIVE : AGGRESSIVE
  const gain = (y: number, s: string) => rows.find((r) => r.year === y && r.budget === budget && r.strategy === s)?.gain
  const thin = new Set(years.filter((y) => (y.families_none ?? 0) / (y.n_families || 1) >= THIN).map((y) => y.year))
  const seasons = years.map((y) => y.year)
    .filter((y) => gain(y, plan) != null && gain(y, BASE) != null)
    .map((y) => ({ year: y, adv: gain(y, plan)! - gain(y, BASE)!, thin: thin.has(y) }))
  const past = seasons.filter((s) => s.year < heldOut)
  if (past.length < 2) return null
  // the conservative plan's value depends on how thin the pedigree is, so its forecast comes from
  // the seasons that looked like the decision year in January
  const like = past.filter((s) => s.thin)
  const basis = even && thin.has(heldOut) && like.length >= 2 ? like : past
  const lo = Math.min(...basis.map((s) => s.adv)), hi = Math.max(...basis.map((s) => s.adv))
  const mean = basis.reduce((a, s) => a + s.adv, 0) / basis.length
  const wins = past.filter((s) => s.adv > 0).length
  const actual = seasons.find((s) => s.year === heldOut)?.adv
  const show = revealed && actual != null
  const where = actual == null ? '' : actual > hi ? 'above' : actual < lo ? 'below' : 'inside'

  // geometry
  const W = 720, H = 270, L = 48, R = 16, T = 34, B = 46
  const slots = [...past.map((s) => s.year), heldOut]
  const sw = (W - L - R) / slots.length
  const cx = (i: number) => L + i * sw + sw / 2
  const vals = [0, lo, hi, ...past.map((s) => s.adv), ...(actual != null ? [actual] : [])]
  const vmax = Math.max(...vals), vmin = Math.min(...vals)
  const span = (vmax - vmin) || 1
  const top = vmax + span * 0.14, bot = vmin - span * 0.08
  const y = (v: number) => T + ((top - v) / (top - bot)) * (H - T - B)
  const step = span > 6 ? 2 : 1
  const ticks: number[] = []
  for (let t = Math.ceil(bot / step) * step; t <= top; t += step) ticks.push(t)
  const bw = Math.min(56, sw * 0.5)
  const hx = cx(slots.length - 1)
  const divX = L + (slots.length - 1) * sw
  const inBasis = (yr: number) => basis.some((s) => s.year === yr)

  return (
    <div className="panel forecast">
      <h2>Same plots, more value: season by season<Info wide>
        Each bar is one past season. ProMaize and the usual practice (the standard method, GBLUP, ranking by bushels)
        each chose which lines got plots ({Math.round(budget * 100)}% of the new lines), using only the seasons before it.
        Every chosen line was then valued on what it really yielded, at $4.50 corn: yield times price, minus drying cost
        and lodging loss. The bar is how much more per acre ProMaize's lines were worth. It scores the lines chosen,
        not a farm's profit.<br /><br />
        The shaded band is the forecast for {heldOut}: the range of the past seasons{even && basis === like ? <> that
        looked like {heldOut} in January (many families with neither parent on record: {like.map((s) => s.year).join(' and ')})</> : null}.
        We forecast the advantage, not the dollars: weather moves every method's dollars together.
      </Info></h2>

      <p className="forecast-head">
        {show
          ? <><b>{heldOut} delivered {usd(actual!)} an acre</b> over the usual practice, {where} the forecast
            ({usd(lo)} to {usd(hi)}).</>
          : even
            ? <>With {heldOut}'s thin pedigree, giving every family the same share beat the usual practice in the seasons
              like it ({like.map((s) => `${s.year}: ${usd(s.adv)}`).join(', ')}). <b>Forecast for {heldOut}: {usd(lo)} to {usd(hi)} an acre.</b></>
            : <>ProMaize beat the usual practice in <b>{wins} of {past.length}</b> past seasons, by <b>{usd(mean)} an acre</b> on
              average. <b>Forecast for {heldOut}: {usd(lo)} to {usd(hi)}.</b></>}
      </p>

      <div className="forecast-controls">
        <div className="toggle">
          <button className={!revealed ? 'on' : ''} onClick={() => onReveal(false)}>January {heldOut}</button>
          <button className={revealed ? 'on' : ''} onClick={() => onReveal(true)}>After harvest</button>
        </div>
        <div className="toggle">
          {[0.3, 0.5].map((b) => (
            <button key={b} className={b === budget ? 'on' : ''} onClick={() => setBudget(b)}>plant {b * 100}%</button>
          ))}
        </div>
        {!revealed && actual != null && (
          <button className="link" onClick={() => onReveal(true)}>See what {heldOut} did →</button>
        )}
      </div>

      <div className="chartbox">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
          aria-label={`Advantage over the usual practice per season: ${past.map((s) => `${s.year} ${usd(s.adv)}`).join(', ')}; forecast for ${heldOut} ${usd(lo)} to ${usd(hi)}${show ? `; ${heldOut} delivered ${usd(actual!)}` : ''}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--text-3)' : 'var(--grid)'} strokeWidth={t === 0 ? 1.2 : 1} />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-3)">{t > 0 ? '+' : t < 0 ? '−' : ''}${Math.abs(t)}</text>
            </g>
          ))}
          <text x={L} y={14} fontSize={11} fill="var(--text-3)">more $/acre than the usual practice</text>

          {/* the history: known in January */}
          {past.map((s, i) => {
            const y0 = y(0), y1 = y(s.adv)
            return (
              <g key={s.year} opacity={inBasis(s.year) ? 1 : 0.35}>
                <rect x={cx(i) - bw / 2} y={Math.min(y0, y1)} width={bw} height={Math.max(1, Math.abs(y1 - y0))} rx={4}
                  fill={s.adv >= 0 ? 'var(--good)' : 'var(--text-3)'} opacity={0.8} />
                <text x={cx(i)} y={s.adv >= 0 ? y1 - 6 : y1 + 14} textAnchor="middle" fontSize={12} fontWeight={600}
                  fill="var(--text-2)">{usd(s.adv)}</text>
              </g>
            )
          })}

          {/* January | the decision year */}
          <line x1={divX} x2={divX} y1={T - 12} y2={H - B + 6} stroke="var(--border)" strokeDasharray="4 4" />
          <text x={divX - 8} y={T - 2} textAnchor="end" fontSize={11} fill="var(--text-3)">known in January {heldOut}</text>

          {/* the forecast: band and expected line */}
          <rect x={hx - bw * 0.8} y={y(hi)} width={bw * 1.6} height={Math.max(2, y(lo) - y(hi))} rx={6}
            fill="var(--accent)" opacity={0.16} stroke="var(--accent)" strokeDasharray="3 3" />
          <line x1={L} x2={hx + bw * 0.8} y1={y(mean)} y2={y(mean)} stroke="var(--accent)" strokeDasharray="6 5" opacity={0.7} />
          {!show && (
            <g>
              <text x={hx} y={y(hi) - 22} textAnchor="middle" fontSize={11} fill="var(--accent)" fontWeight={600}>forecast</text>
              <text x={hx} y={y(hi) - 8} textAnchor="middle" fontSize={11} fill="var(--accent)">expected {usd(mean)}</text>
            </g>
          )}

          {/* after harvest: the decision year's own bar, rising into place */}
          {actual != null && (
            <g className="reveal" style={{ opacity: show ? 1 : 0 }}>
              <rect x={hx - bw / 2} y={Math.min(y(0), y(actual))} width={bw} height={Math.max(1, Math.abs(y(actual) - y(0)))} rx={4}
                fill={actual >= 0 ? 'var(--good)' : 'var(--text-3)'}
                style={{ transform: show ? 'scaleY(1)' : 'scaleY(0)', transformBox: 'fill-box', transformOrigin: actual >= 0 ? 'bottom' : 'top' }} />
              <text x={hx} y={actual >= 0 ? y(actual) - 6 : y(actual) + 14} textAnchor="middle" fontSize={13} fontWeight={700}
                fill="var(--text)">{usd(actual)}</text>
            </g>
          )}

          {/* seasons, and which ones had a thin pedigree */}
          {slots.map((yr, i) => (
            <g key={yr}>
              <text x={cx(i)} y={H - B + 20} textAnchor="middle" fontSize={12} fontWeight={yr === heldOut ? 700 : 400}
                fill={yr === heldOut ? 'var(--text)' : 'var(--text-2)'}>{yr}</text>
              {thin.has(yr) && <text x={cx(i)} y={H - B + 36} textAnchor="middle" fontSize={10} fill="var(--text-3)">thin pedigree</text>}
            </g>
          ))}
        </svg>
      </div>
      <p className="small muted" style={{ margin: '4px 0 0' }}>
        {even
          ? <>Conservative plan: every family gets the same share of plots and DNA picks the siblings.</>
          : <>Aggressive plan: every line ranked by its predicted $/acre.</>}{' '}
        Switch the plan in the left panel. "Thin pedigree": many new families had neither parent on record.
      </p>
    </div>
  )
}

export default memo(SeasonForecast)

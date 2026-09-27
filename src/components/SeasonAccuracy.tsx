import { memo } from 'react'
import type { YearResult } from '../lib/types'
import Info from './Info'

interface Props {
  years: YearResult[]
  heldOut: number | null
  revealed: boolean             // the decision year shows only after its harvest
  ceiling?: number | null       // the most any predictor could reach, set by the field's own noise
  bare?: boolean                // just the chart, inside another panel
}

/** For breeders: each engine's accuracy (r against real yield) in every forward season, one dot each,
 *  2-Step in colour and Standard in grey, joined so the gap reads at a glance. */
function SeasonAccuracy({ years, heldOut, revealed, ceiling, bare }: Props) {
  const shown = years.filter((y) => revealed || y.year !== heldOut)
  if (shown.length < 2) return null

  const W = 720, H = 210, L = 48, R = 16, T = 18, B = 30
  const top = Math.max(ceiling ?? 0, ...shown.flatMap((y) => [y.r, y.r_gblup])) * 1.08
  const y = (v: number) => T + ((top - v) / top) * (H - T - B)
  const sw = (W - L - R) / shown.length
  const cx = (i: number) => L + i * sw + sw / 2
  const ticks = [0, 0.2, 0.4, 0.6].filter((t) => t <= top)

  const chart = (
    <>
      <div className="chartbox">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
          aria-label={`Accuracy by season: ${shown.map((s) => `${s.year} 2-Step ${s.r.toFixed(2)}, Standard ${s.r_gblup.toFixed(2)}`).join('; ')}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--text-3)' : 'var(--grid)'} />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-3)">{t === 0 ? '0' : t.toFixed(1)}</text>
            </g>
          ))}
          {ceiling != null && (
            <g>
              <line x1={L} x2={W - R} y1={y(ceiling)} y2={y(ceiling)} stroke="var(--text-3)" strokeDasharray="5 5" />
              <text x={W - R} y={y(ceiling) - 6} textAnchor="end" fontSize={11} fill="var(--text-3)">ceiling</text>
            </g>
          )}
          {shown.map((s, i) => (
            <g key={s.year}>
              <title>{`${s.year}: 2-Step ${s.r.toFixed(2)}, Standard ${s.r_gblup.toFixed(2)}. ${s.families_both != null ? `${s.families_both} of ${s.n_families} families had both parents tested before` : `${s.n_families} families`}`}</title>
              <rect x={cx(i) - sw / 2} y={T} width={sw} height={H - T - B} fill="transparent" />
              <line x1={cx(i)} x2={cx(i)} y1={y(s.r_gblup)} y2={y(s.r)} stroke="var(--border)" strokeWidth={3} strokeLinecap="round" />
              <circle cx={cx(i)} cy={y(s.r_gblup)} r={6} fill="var(--text-3)" />
              <circle cx={cx(i)} cy={y(s.r)} r={7.5} fill="var(--accent)" />
              <text x={cx(i)} y={H - 8} textAnchor="middle" fontSize={12} fontWeight={s.year === heldOut ? 700 : 400}
                fill={s.year === heldOut ? 'var(--text)' : 'var(--text-2)'}>{s.year}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="legend" style={{ marginTop: 2 }}>
        <span><i style={{ background: 'var(--accent)', width: 10, height: 10, borderRadius: '50%' }} />2-Step</span>
        <span><i style={{ background: 'var(--text-3)', width: 10, height: 10, borderRadius: '50%' }} />Standard</span>
      </div>
    </>
  )
  if (bare) return chart
  return (
    <div className="panel">
      <h2>Accuracy, season by season<Info wide>
        How closely each engine's predicted ranking of the lines matched their real yield ranking (the correlation, r), in
        seasons the engine never saw: each season was predicted from the seasons before it. The dashed line is the most
        any method could reach here, set by the field's own noise. Hover a season for its numbers.
      </Info></h2>
      {chart}
    </div>
  )
}

export default memo(SeasonAccuracy)

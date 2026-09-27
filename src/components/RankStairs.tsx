import { memo } from 'react'
import type { SeasonPoint } from '../lib/econ'
import Info from './Info'

interface Props { seasons: SeasonPoint[] | null; heldOut: number; revealed: boolean; share: number }

// whole dollars with their sign; anything that rounds to nothing is just $0
const usd0 = (v: number) => {
  const r = Math.round(v)
  return r === 0 ? '$0' : `${r < 0 ? '−' : '+'}$${Math.abs(r)}`
}

/** The decision year's ranking, in the opening chart's grammar: each family's lines split into fifths by
 *  predicted income, best first. Ticks are what January predicted each fifth to earn against its own
 *  family's average; after harvest, bars show what it really earned. The dashed line is the plot budget:
 *  every family plants its lines left of it, so the green is the selected lines. */
function RankStairs({ seasons, heldOut, revealed, share }: Props) {
  const now = seasons?.find((s) => s.year === heldOut && s.stairs && s.stairsPred)
  if (!now) return null
  const pred = now.stairsPred!, real = now.stairs!

  const W = 720, H = 230, L = 104, R = 16, T = 30, B = 30
  const lim = Math.max(1, ...pred.map(Math.abs), ...(revealed ? real.map(Math.abs) : [])) * 1.3
  const y = (v: number) => T + ((lim - v) / (2 * lim)) * (H - T - B)
  const x = (frac: number) => L + frac * (W - L - R)        // rank inside the family, 0 = best, 1 = worst
  const cut = x(Math.min(1, Math.max(0, share)))
  const gap = 10
  // numbers stay readable where the budget line crosses them
  const halo = { stroke: 'var(--surface)', strokeWidth: 5, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const }

  return (
    <div className="panel">
      <h2>Final {heldOut} prediction<Info wide>
        Each family's new lines, split into five equal groups by predicted income per acre, from ranked best to ranked
        worst. <b>Ticks</b>: what each group was predicted in January to earn against its own family's average.{' '}
        <b>Bars</b>, after harvest: what it really earned. <b>The dashed line</b> is your plot budget: every family plants
        its lines to the left of it.
      </Info></h2>
      <div className="chartbox">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
          aria-label={`${heldOut} lines by predicted rank, best to worst fifth: predicted ${pred.map(usd0).join(', ')}${revealed ? `; real ${real.map(usd0).join(', ')}` : ''}`}>
          {/* the lines that get a plot */}
          <rect x={L} y={T - 18} width={Math.max(0, cut - L)} height={H - T - B + 18} fill="var(--good)" opacity={0.07} />
          <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--text-3)" strokeWidth={1.2} />
          <text x={L - 10} y={y(0) + 4} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--text-2)">family average</text>
          <line x1={cut} x2={cut} y1={T - 18} y2={H - B} stroke="var(--text-2)" strokeDasharray="4 4" />

          {pred.map((p, f) => {
            const x0 = x(f / 5) + gap, x1 = x((f + 1) / 5) - gap, mid = (x0 + x1) / 2
            const v = real[f], top = Math.min(y(0), y(v)), h = Math.max(1.5, Math.abs(y(v) - y(0)))
            const split = Math.min(x1, Math.max(x0, cut))
            return (
              <g key={f}>
                {revealed && (
                  <g className="reveal">
                    {split > x0 && <rect x={x0} y={top} width={split - x0} height={h} fill="var(--good)" opacity={0.85} />}
                    {split < x1 && <rect x={split} y={top} width={x1 - split} height={h} fill="var(--text-3)" opacity={0.7} />}
                    <text x={mid} y={v >= 0 ? Math.min(y(v), y(p)) - 8 : Math.max(y(v), y(p)) + 17} textAnchor="middle" fontSize={13}
                      fontWeight={700} fill="var(--text)" {...halo}>{usd0(v)}</text>
                  </g>
                )}
                <line x1={x0 - 4} x2={x1 + 4} y1={y(p)} y2={y(p)} stroke="var(--accent)" strokeWidth={2.5} />
                {!revealed && (
                  <text x={mid} y={p >= 0 ? y(p) - 8 : y(p) + 17} textAnchor="middle" fontSize={13} fontWeight={600}
                    fill="var(--accent)" {...halo}>{usd0(p)}</text>
                )}
              </g>
            )
          })}

          <text x={cut - 6} y={T - 6} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--good)">planted</text>
          <text x={cut + 6} y={T - 6} fontSize={11} fill="var(--text-3)">dropped</text>

          <text x={x(0.1)} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--text-2)">ranked best</text>
          <text x={x(0.9)} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--text-2)">ranked worst</text>
        </svg>
      </div>
      <div className="legend" style={{ marginTop: 2 }}>
        <span><i style={{ background: 'var(--good)', opacity: 0.85, height: 10, width: 14, borderRadius: 3 }} />real, after harvest</span>
        <span><i style={{ background: 'var(--accent)', height: 3, width: 16 }} />forecast, that January</span>
      </div>
    </div>
  )
}

export default memo(RankStairs)

import { memo } from 'react'
import type { SeasonPoint } from '../lib/econ'
import type { EngineId, YearResult } from '../lib/types'
import Info from './Info'

interface Props {
  seasons: SeasonPoint[] | null
  heldOut: number
  revealed: boolean
  share: number
  years?: YearResult[]          // each season's accuracy, for the breeders' line in the (i)
  engine: EngineId
  ceiling?: number | null
}

// whole dollars with their sign; anything that rounds to nothing is just $0
const usd0 = (v: number) => {
  const r = Math.round(v)
  return r === 0 ? '$0' : `${r < 0 ? '−' : '+'}$${Math.abs(r)}`
}

/** The decision year's ranking: each family's lines split into tenths by predicted income, best first.
 *  In January the bars are what each tenth was predicted to earn against its own family's average; after
 *  harvest they settle at what it really earned, on the same scale, so the move is the forecast's miss.
 *  The dashed line is the plot budget: every family plants its lines left of it. */
function RankStairs({ seasons, heldOut, revealed, share, years, engine, ceiling }: Props) {
  const now = seasons?.find((s) => s.year === heldOut && s.stairs && s.stairsPred)
  if (!now) return null
  const pred = now.stairsPred!, real = now.stairs!
  // what a line earns on its own, so a bar below the line reads as 'less than its siblings', not a loss
  const pastIncome = (seasons ?? []).filter((s) => s.year < heldOut && s.income != null).map((s) => s.income!)
  const typical = pastIncome.length ? Math.round(pastIncome.reduce((a, b) => a + b, 0) / pastIncome.length / 10) * 10 : null
  // the breeders' number: accuracy r, the decision year only after its harvest
  const acc = (() => {
    const past = (years ?? []).filter((y) => y.year < heldOut), last = (years ?? []).find((y) => y.year === heldOut)
    if (!past.length) return null
    const mean = (f: (y: YearResult) => number) => past.reduce((a, y) => a + f(y), 0) / past.length
    const mine = (y: YearResult) => (engine === 'gblup' ? y.r_gblup : y.r), other = (y: YearResult) => (engine === 'gblup' ? y.r : y.r_gblup)
    const span = `${past[0].year} to ${past[past.length - 1].year}`
    const shown = revealed && last
      ? `${mine(last).toFixed(2)} in ${heldOut} and ${mean(mine).toFixed(2)} on average in ${span} (${engine === 'gblup' ? '2-Step' : 'Standard'}: ${other(last).toFixed(2)} and ${mean(other).toFixed(2)})`
      : `${mean(mine).toFixed(2)} on average in ${span} (${engine === 'gblup' ? '2-Step' : 'Standard'}: ${mean(other).toFixed(2)})`
    return `${shown}.${ceiling != null ? ` Field noise caps any method near ${ceiling.toFixed(2)} here.` : ''}`
  })()

  const W = 720, H = 230, L = 104, R = 16, T = 30, B = 30
  // one scale for both views, so switching shows only how far the harvest moved each bar
  const lim = Math.max(1, ...pred.map(Math.abs), ...real.map(Math.abs)) * 1.3
  const y = (v: number) => T + ((lim - v) / (2 * lim)) * (H - T - B)
  const x = (frac: number) => L + frac * (W - L - R)        // rank inside the family, 0 = best, 1 = worst
  const cut = x(Math.min(1, Math.max(0, share)))
  const n = pred.length
  const gap = n > 5 ? 5 : 10
  // numbers stay readable where the budget line crosses them
  const halo = { stroke: 'var(--surface)', strokeWidth: 5, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const }

  return (
    <div className="panel">
      <h2>Final {heldOut} prediction<Info wide>
        Each family's new lines, split into ten equal groups by predicted income per acre, from ranked best to ranked
        worst. <b>In January</b> each bar is what that group was predicted to earn against its own family's average;{' '}
        <b>after harvest</b>, what it really earned. <b>The dashed line</b> is your plot budget: every family plants its
        lines to the left of it.<br /><br />
        Below the line means less than the family's average, not a loss{typical ? <>: a test hybrid here earns about
        ${typical.toLocaleString('en-US')} an acre</> : null}.
        {acc && <><br /><br />In breeders' terms, accuracy r = {acc}</>}
      </Info></h2>
      <div className="chartbox">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
          aria-label={`${heldOut} lines by predicted rank, best to worst tenth: predicted ${pred.map(usd0).join(', ')}${revealed ? `; real ${real.map(usd0).join(', ')}` : ''}`}>
          {/* the lines that get a plot */}
          <rect x={L} y={T - 18} width={Math.max(0, cut - L)} height={H - T - B + 18} fill={revealed ? 'var(--good)' : 'var(--accent)'} opacity={0.07} />
          <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--text-3)" strokeWidth={1.2} />
          <text x={L - 10} y={y(0) + 4} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--text-2)">family average</text>
          <line x1={cut} x2={cut} y1={T - 18} y2={H - B} stroke="var(--text-2)" strokeDasharray="4 4" />

          {(revealed ? real : pred).map((v, f) => {
            const x0 = x(f / n) + gap, x1 = x((f + 1) / n) - gap, mid = (x0 + x1) / 2
            const top = Math.min(y(0), y(v)), h = Math.max(1.5, Math.abs(y(v) - y(0)))
            const split = Math.min(x1, Math.max(x0, cut))
            // the forecast in the opening chart's blue; the harvest in its green; dropped lines grey in both
            const move = { transition: 'y .5s ease, height .5s ease, fill .5s ease' }
            return (
              <g key={f}>
                <rect x={x0} y={top} width={Math.max(0, split - x0)} height={h} opacity={0.85} style={move}
                  fill={revealed ? 'var(--good)' : 'var(--accent)'} />
                <rect x={split} y={top} width={Math.max(0, x1 - split)} height={h} fill="var(--text-3)" opacity={0.7} style={move} />
                <text x={mid} y={v >= 0 ? y(v) - 8 : y(v) + 17} textAnchor="middle" fontSize={13} fontWeight={700}
                  fill={revealed ? 'var(--text)' : 'var(--accent)'} style={{ transition: 'y .5s ease' }} {...halo}>{usd0(v)}</text>
              </g>
            )
          })}

          <text x={cut - 6} y={T - 6} textAnchor="end" fontSize={11} fontWeight={600} fill={revealed ? 'var(--good)' : 'var(--accent)'}>planted</text>
          <text x={cut + 6} y={T - 6} fontSize={11} fill="var(--text-3)">dropped</text>

          <text x={x(0)} y={H - 8} fontSize={12} fill="var(--text-2)">each family's best</text>
          <text x={x(1)} y={H - 8} textAnchor="end" fontSize={12} fill="var(--text-2)">each family's worst</text>
        </svg>
      </div>
      <div className="legend" style={{ marginTop: 2 }}>
        {revealed
          ? <span><i style={{ background: 'var(--good)', opacity: 0.85, height: 10, width: 14, borderRadius: 3 }} />real, after harvest</span>
          : <span><i style={{ background: 'var(--accent)', opacity: 0.85, height: 10, width: 14, borderRadius: 3 }} />forecast, January</span>}
        <span><i style={{ background: 'var(--text-3)', opacity: 0.7, height: 10, width: 14, borderRadius: 3 }} />dropped</span>
      </div>
    </div>
  )
}

export default memo(RankStairs)

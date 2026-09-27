import { memo } from 'react'
import type { SeasonPoint } from '../lib/econ'
import Info from './Info'

interface Props { seasons: SeasonPoint[] | null; heldOut: number; revealed: boolean }

// whole dollars with their sign; anything that rounds to nothing is just $0
const usd0 = (v: number) => {
  const r = Math.round(v)
  return r === 0 ? '$0' : `${r < 0 ? '−' : '+'}$${Math.abs(r)}`
}

/** Whether the ranking holds in the field, in dollars: each family's lines split into fifths by
 *  predicted income, and what each fifth really earned against its own family's average. A falling
 *  staircase is a ranking that works. January shows the past seasons; after harvest, the decision year. */
function RankStairs({ seasons, heldOut, revealed }: Props) {
  const graded = (seasons ?? []).filter((s) => s.stairs)
  const past = graded.filter((s) => s.year < heldOut)
  const now = graded.find((s) => s.year === heldOut)
  if (!past.length) return null
  const final = revealed && now
  const stairs = final ? now.stairs! : [0, 1, 2, 3, 4].map((f) => past.reduce((a, s) => a + s.stairs![f], 0) / past.length)
  const span = `${past[0].year} to ${past[past.length - 1].year}`

  const W = 720, H = 220, L = 104, R = 16, T = 24, B = 30
  const lim = Math.max(1, ...stairs.map(Math.abs)) * 1.25
  const y = (v: number) => T + ((lim - v) / (2 * lim)) * (H - T - B)
  const sw = (W - L - R) / 5
  const bw = Math.min(88, sw * 0.64)
  const cx = (f: number) => L + f * sw + sw / 2

  return (
    <div className="panel">
      <h2>{final ? `Final ${heldOut} prediction` : `Past predictions, ${span}`}<Info wide>
        Each family's lines are split into five equal groups by predicted income per acre, from ranked best to ranked
        worst. Each bar is what that group really earned in the field, against the average of its own family.
        Bars falling from left to right mean the ranking held: the lines ranked higher really earned more.<br /><br />
        {final ? <>The {heldOut} harvest.</> : <>Seasons {span}, each predicted from the seasons before it.</>}
      </Info></h2>
      <div className="chartbox">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
          aria-label={`Real income per acre by predicted rank, best to worst fifth: ${stairs.map(usd0).join(', ')}`}>
          <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--text-3)" strokeWidth={1.2} />
          <text x={L - 10} y={y(0) + 4} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--text-2)">family average</text>
          {stairs.map((v, f) => (
            <g key={f}>
              <rect x={cx(f) - bw / 2} y={Math.min(y(0), y(v))} width={bw} height={Math.max(1.5, Math.abs(y(v) - y(0)))} rx={5}
                fill={v >= 0 ? 'var(--good)' : 'var(--text-3)'} opacity={0.85} style={{ transition: 'y .45s ease, height .45s ease' }} />
              <text x={cx(f)} y={v >= 0 ? y(v) - 7 : y(v) + 16} textAnchor="middle" fontSize={13} fontWeight={700}
                fill="var(--text)" style={{ transition: 'y .45s ease' }}>{usd0(v)}</text>
            </g>
          ))}
          <text x={cx(0)} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--text-2)">ranked best</text>
          <text x={cx(4)} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--text-2)">ranked worst</text>
        </svg>
      </div>
    </div>
  )
}

export default memo(RankStairs)

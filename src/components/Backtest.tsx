import { memo } from 'react'
import type { Backtest as BT, CapturePoint } from '../lib/econ'
import { fmtNum, fmtPct, fmtUSD, plantedFor } from '../lib/econ'
import Info from './Info'

export interface Maturity {
  cohort: number | null       // cohort mean relative maturity, days
  byMargin: number | null     // advanced set by $, days over the cohort
  byYield: number | null      // advanced set by bushels, days over the cohort
  source: 'actual' | 'predicted'
}

interface Props { bt: BT; year: number; k: number; curve: CapturePoint[]; maturity: Maturity | null }

const days = (v: number | null) => (v == null ? 'n/a' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} d`)

/** The cohort was ranked before it was planted; then it was grown. This is the receipt. */
function Backtest({ bt, year, k, curve, maturity }: Props) {
  const W = 640, H = 190, padL = 44, padR = 12, padT = 16, padB = 52
  const lo = Math.min(0, ...bt.deciles), hi = Math.max(0, ...bt.deciles)
  const span = hi - lo || 1
  const y = (v: number) => padT + ((hi - v) / span) * (H - padT - padB)
  const bw = (W - padL - padR) / 10
  const zero = y(0)
  const half = plantedFor(curve, 0.5)
  const most = plantedFor(curve, 0.8)
  return (
    <div className="panel">
      <h2>What {year} actually said<Info wide>
        The candidates are the real {year} cohort. The model ranked them using only earlier years, exactly as a
        breeder would have in January {year}, and never saw a {year} plot. Then those lines were grown, about seven
        locations each. Here the advanced set is valued with the same $/acre arithmetic, but on the yields, moisture
        and lodging the field actually recorded (adjusted for trial and tester). A random pick scores $0 by definition;
        "best possible" is the true top {fmtNum(k)} chosen with hindsight.
      </Info></h2>
      <div className="tiles">
        <div className="tile">
          <div className="k">Realised gain, ranking by $</div>
          <div className={'v' + (bt.byMargin > 0 ? ' good' : '')}>{fmtUSD(bt.byMargin)}</div>
          <div className="d">per acre over a random pick, in the real {year} field</div>
        </div>
        <div className="tile">
          <div className="k">Realised gain, ranking by bushels</div>
          <div className="v">{fmtUSD(bt.byYield)}</div>
          <div className="d">same budget, the usual way</div>
        </div>
        <div className="tile">
          <div className="k">Best possible</div>
          <div className="v">{fmtUSD(bt.oracle)}</div>
          <div className="d">the true top {fmtNum(k)}, with hindsight</div>
        </div>
        <div className="tile">
          <div className="k">True winners caught</div>
          <div className="v">{fmtPct(bt.topRecovered)}</div>
          <div className="d">of the real top {fmtNum(k)} advanced · chance {fmtPct(bt.chance)}</div>
        </div>
      </div>

      <div className="twocol">
        <div className="chartbox">
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
            aria-label={`Realised dollars per acre by decile of predicted dollars per acre, ${year}`}>
            <line x1={padL} x2={W - padR} y1={zero} y2={zero} stroke="var(--border)" />
            {bt.deciles.map((v, i) => {
              const x = padL + i * bw + 3
              const top = Math.min(y(v), zero), h = Math.abs(y(v) - zero)
              return (
                <g key={i}>
                  <rect x={x} y={top} width={bw - 6} height={Math.max(h, 1)} rx={3}
                    fill={v >= 0 ? 'var(--good)' : 'var(--text-3)'} opacity={0.85} />
                  <text x={x + (bw - 6) / 2} y={v >= 0 ? top - 4 : top + h + 12} textAnchor="middle"
                    fontSize={11} fill="var(--text-2)">{fmtUSD(v)}</text>
                  <text x={x + (bw - 6) / 2} y={H - 20} textAnchor="middle" fontSize={11} fill="var(--text-3)">
                    {i === 0 ? 'top 10%' : i === 9 ? 'bottom' : `${(i + 1) * 10}%`}
                  </text>
                </g>
              )
            })}
            <text x={padL} y={H - 4} fontSize={11} fill="var(--text-3)">
              candidates grouped by predicted $/acre · bar = what each group really earned per acre, over the {year} average
            </text>
          </svg>
        </div>
        {curve.length > 0 && <Capture curve={curve} />}
      </div>

      <p style={{ marginBottom: 6 }}>
        <b>Plots, not just accuracy.</b> To keep half of {year}'s real top 10%, plant the top <b>{fmtPct(half)}</b> of
        lines by predicted $/acre; random planting needs 50%. To keep 80% of them, <b>{fmtPct(most)}</b> instead of 80%.
      </p>
      {maturity && maturity.byYield != null && maturity.byMargin != null && (
        <p style={{ marginBottom: 6 }}>
          <b>Maturity check.</b> Relative maturity of the advanced set vs the whole cohort ({maturity.source}): ranking by
          bushels <b>{days(maturity.byYield)}</b>, ranking by $ <b>{days(maturity.byMargin)}</b>.{' '}
          {maturity.byYield - maturity.byMargin >= 0.3
            ? <>Later corn yields more and is wetter at harvest, so the bushel ranking pulls the pipeline later; pricing the
              drying cost holds it back.</>
            : <>At these prices neither ranking drifts the pipeline's maturity. Raise the drying cost and watch the gap open:
              later corn yields more but is wetter at harvest.</>}
        </p>
      )}
      <p className="muted" style={{ marginBottom: 0 }}>
        {fmtNum(bt.n)} lines with {year} results. Predicted vs realised: yield r = {bt.rYield.toFixed(2)}, $/acre
        r = {bt.r.toFixed(2)} (a line's lodging in one season is mostly that season's storms, which no genotype
        predicts). The average candidate earned {fmtUSD(bt.mean)}/acre; every $ number above is relative to that.
      </p>
    </div>
  )
}

function Capture({ curve }: { curve: CapturePoint[] }) {
  const W = 300, H = 170, pad = 30
  const x = (v: number) => pad + v * (W - pad - 8)
  const y = (v: number) => H - pad - v * (H - pad - 10)
  const path = curve.map((c, i) => `${i ? 'L' : 'M'}${x(c.planted).toFixed(1)},${y(c.kept).toFixed(1)}`).join(' ')
  return (
    <div className="chartbox">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Share of real top 10% kept against share of lines planted">
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--text-3)" strokeDasharray="4 4" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(0)} stroke="var(--border)" />
        <line x1={x(0)} y1={y(0)} x2={x(0)} y2={y(1)} stroke="var(--border)" />
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <text x={x(v)} y={H - pad + 14} textAnchor="middle" fontSize={10} fill="var(--text-3)">{v * 100}%</text>
            <text x={pad - 4} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--text-3)">{v * 100}%</text>
          </g>
        ))}
        <text x={x(0.5)} y={H - 2} textAnchor="middle" fontSize={10} fill="var(--text-3)">share of lines planted</text>
        <text x={x(0.62)} y={y(0.38)} fontSize={10} fill="var(--text-3)">random</text>
        <text x={x(0.04)} y={y(0.96)} fontSize={10} fill="var(--text-2)">real top 10% kept</text>
      </svg>
    </div>
  )
}

export default memo(Backtest)

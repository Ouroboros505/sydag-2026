import { memo, useState } from 'react'
import type { PlotsToMatch, StrategyRow } from '../lib/types'
import { fmtNum, fmtPct, fmtUSD } from '../lib/econ'
import Info from './Info'

interface Props { rows: StrategyRow[]; heldOut: number | null; match?: PlotsToMatch[] }

// the organizers' framing: the tradeoff between aggressive and conservative selection under limited plots
const LABEL: Record<string, string> = {
  'ProMaize, rank by $/acre': 'Aggressive: 2-Step, every line ranked by $/acre',
  'ProMaize, same share of every family': 'Conservative: 2-Step, same share of every family',
  'ProMaize, $/acre, max 50 per family': '2-Step, $/acre, at most 50 lines per family',
  'ProMaize, rank by bushels': '2-Step, ranked by bushels',
  'standard GBLUP, rank by $/acre': 'Standard engine (GBLUP), ranked by $/acre',
  'standard GBLUP, rank by bushels': 'Usual practice: standard engine (GBLUP), ranked by bushels',
  random: 'Random pick (the zero line)',
}

/** The resource-allocation question answered with the record: the same plots spent different
 *  ways, every forward year, scored on what the field then paid. */
function Strategies({ rows, heldOut, match }: Props) {
  const budgets = [...new Set(rows.map((r) => r.budget))].sort()
  const [budget, setBudget] = useState(budgets[0] ?? 0.3)
  const years = [...new Set(rows.filter((r) => r.year !== 'mean').map((r) => r.year as number))].sort()
  const mean = rows.filter((r) => r.year === 'mean' && r.budget === budget)
  const at = (name: string, year: number) => rows.find((r) => r.year === year && r.budget === budget && r.strategy === name)
  const best = Math.max(...mean.map((r) => r.gain))
  return (
    <div className="panel">
      <h2>Which way to spend the plots<Info wide>
        Each row is a rule for choosing which lines get plots, applied in every year from {years[0]} to{' '}
        {years[years.length - 1]} using only what was known before that year, then scored on what the chosen lines really
        did. <b>Realised gain</b> is their $/acre in the field over the cohort average (a random pick scores $0).{' '}
        <b>Top 10% kept</b> is the share of that year's real best lines that got a plot. <b>Families</b> is the effective
        number of families advanced (breadth). <b>Maturity</b> is how much later the advanced set was than the cohort.
      </Info></h2>
      <div className="toggle" style={{ marginBottom: 10 }}>
        {budgets.map((b) => (
          <button key={b} className={b === budget ? 'on' : ''} onClick={() => setBudget(b)}>plant {fmtPct(b)} of lines</button>
        ))}
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th className="l wrap">Rule</th>
              <th className="wrap">Realised gain, {years.length}-year mean</th>
              {heldOut != null && <th className="hide-sm">in {heldOut}</th>}
              <th className="wrap">Top 10% kept</th>
              <th className="hide-sm">Families</th>
              <th className="hide-sm">Maturity</th>
            </tr>
          </thead>
          <tbody>
            {mean.map((r) => (
              <tr key={r.strategy} className={r.gain === best ? 'swap' : undefined}>
                <td className="l wrap">{LABEL[r.strategy] ?? r.strategy}</td>
                <td><b>{fmtUSD(r.gain, 1)}</b></td>
                {heldOut != null && <td className="muted hide-sm">{fmtUSD(at(r.strategy, heldOut)?.gain ?? 0, 1)}</td>}
                <td>{fmtPct(r.top10_kept)}</td>
                <td className="muted hide-sm">{r.eff_families == null ? '' : fmtNum(r.eff_families, 0)}</td>
                <td className="muted hide-sm">{r.strategy === 'random' ? '' : `${r.maturity_shift >= 0 ? '+' : '−'}${Math.abs(r.maturity_shift).toFixed(1)} d`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {match && match.length > 0 && (() => {
        const needs = match.reduce((a, m) => a + m.standard_needs, 0) / match.length
        const saved = match.reduce((a, m) => a + m.lines_saved, 0) / match.length
        const last = match.find((m) => m.year === heldOut)
        return (
          <p style={{ margin: '10px 0 0' }}>
            <b>In plots:</b> to keep as many of the real top 10% as ProMaize keeps with 30% of the lines, the usual
            practice (GBLUP, ranked by bushels) had to plant <b>{fmtPct(needs)}</b> of them on average over the {match.length} seasons
            {last && <> ({fmtPct(last.standard_needs)} in {heldOut})</>}: about <b>{fmtNum(saved)}</b> more lines a
            season, each tested at about seven locations.
          </p>
        )
      })()}
      {heldOut != null && (() => {
        const cost = (y: number) => {
          const r = at('ProMaize, rank by $/acre', y), e = at('ProMaize, same share of every family', y)
          return r && e ? { usd: r.gain - e.gain, fr: r.eff_families ?? 0, fe: e.eff_families ?? 0 } : null
        }
        const now = cost(heldOut), before = cost(heldOut - 1)
        if (!now || !before) return null
        return (
          <p style={{ margin: '10px 0 0' }}>
            <b>Our {heldOut} recommendation is the conservative plan.</b> Ranking all lines wins on average, but the family call
            is only as good as the pedigree on record, and {heldOut}'s is thin. In {heldOut - 1}, the last season like it,
            the even split gave up {fmtUSD(before.usd, 2)}/acre for {fmtNum(before.fe)} effective families instead
            of {fmtNum(before.fr)}; in {heldOut} it gave up {fmtUSD(now.usd, 2)} for {fmtNum(now.fe)} instead
            of {fmtNum(now.fr)}. Switch it on in the left panel; the chart below shows why the pedigree decides it.
          </p>
        )
      })()}
      <p className="muted small" style={{ margin: '8px 0 0' }}>
        Per acre of every line advanced, relative to planting at random; corn at $4.50 and drying at $0.045/bu/pt. Lodging
        counts where it was scored, trial-adjusted.
      </p>
    </div>
  )
}

export default memo(Strategies)

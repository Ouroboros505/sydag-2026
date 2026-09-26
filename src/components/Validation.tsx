import type { Baseline, Validation as V } from '../lib/types'
import Info from './Info'

interface Props { v: V; baselines: Baseline[]; notes?: string; heldOut: number | null }

const f2 = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? 'n/a' : x.toFixed(2))

/** How far to trust the ranking: the forward test, its repeats on earlier cohorts, the
 *  baselines it has to beat, and how honest its error bands turned out to be. */
export default function Validation({ v, baselines, notes, heldOut }: Props) {
  const years = v.by_year ?? []
  const maxR = Math.max(0.05, ...years.flatMap((y) => [y.r, y.r_gblup, y.r_pedigree]).filter(Number.isFinite))
  return (
    <div className="panel validation">
      <h2>How much to trust this<Info wide>
        Measured the only honest way for this program: the model learns from earlier years only, then predicts families
        it has never seen, and is checked against what they really did. <b>r</b> is the correlation between predicted and
        real (1 = perfect ranking, 0 = no better than random). Real values here are adjusted for the trial and for the
        tester the line was crossed to, so a line is not credited for its tester (GCA, what advancement is about).
        The <b>leaky</b> number is what you get by letting siblings into training: it looks better and is not real.
      </Info></h2>
      <p>
        <b>{v.scheme}.</b> On {v.n_test.toLocaleString()} held-out lines, correlation with their real yield is{' '}
        <b>r = {v.r.toFixed(2)}</b>
        {v.ceiling != null && <> (plot noise caps any predictor near <b>{v.ceiling.toFixed(2)}</b>)</>}, and the top 20% by
        prediction holds <b>{Math.round(v.top20_recovery * 100)}%</b> of the real top 20% (chance is 20%).
        {v.r_between != null && v.r_within != null && (
          <> Split: families ranked at <b>r = {f2(v.r_between)}</b> from their parents' DNA, siblings inside a family at{' '}
            <b>r = {f2(v.r_within)}</b>.</>
        )}
        {v.r_as_planted != null && (
          <> Against the raw testcross result, tester included (the tester's effect as known in January added back):{' '}
            <b>r = {f2(v.r_as_planted)}</b>.</>
        )}
      </p>
      {years.length > 1 && (
        <div className="tablewrap" style={{ marginBottom: 12 }}>
          <table className="yeartable">
            <thead>
              <tr>
                <th className="l">Predicted year</th>
                <th>Families</th>
                <th>ProMaize</th>
                <th className="l hide-sm" style={{ width: '38%' }}>vs standard GBLUP and pedigree</th>
                <th>Std. GBLUP</th>
                <th className="hide-sm">Pedigree</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.year} className={y.year === heldOut ? 'swap' : undefined}>
                  <td className="l">{y.year}{y.year === heldOut ? ' (the decision year)' : ''}</td>
                  <td>{y.n_families}</td>
                  <td><b>{f2(y.r)}</b></td>
                  <td className="l hide-sm">
                    <span className="rbar" style={{ width: `${Math.max(0, (y.r / maxR) * 100)}%` }} />
                    <span className="rbar alt" style={{ width: `${Math.max(0, (y.r_gblup / maxR) * 100)}%` }} />
                  </td>
                  <td className="muted">{f2(y.r_gblup)}</td>
                  <td className="muted hide-sm">{f2(y.r_pedigree)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small" style={{ margin: '6px 0 0' }}>
            Each row is a separate forward test: that year's families predicted from the years before it.
            {v.tuned_on && <> Model settings were chosen on {v.tuned_on.join(', ')} only; {heldOut} was held out.</>}
          </p>
        </div>
      )}
      {v.traits && (
        <p>
          The $/acre ranking also uses predicted moisture and lodging. Same forward test:{' '}
          {Object.entries(v.traits).map(([key, x], i) => (
            <span key={key}>{i ? ' · ' : ''}{key} <b>r = {f2(x)}</b></span>
          ))}. Lodging is barely predictable from DNA in this data, so it moves the ranking little; we say so rather
          than pretend.
        </p>
      )}
      <ul>
        {baselines.map((b) => (
          <li key={b.name}>{b.name}: <b>{b.metric} = {b.value.toFixed(2)}</b></li>
        ))}
      </ul>
      <p className="muted">
        {v.coverage90 != null && (
          <>The 90% bands in the table come from forward errors on earlier years; in {heldOut} they held{' '}
            <b>{Math.round(v.coverage90 * 100)}%</b> of real results. </>
        )}
        Confidence is how much of a family's pedigree is on record: <b>high</b> both parents have earlier families,{' '}
        <b>medium</b> one, <b>low</b> neither, so its family mean is a pure genomic estimate.
        {v.by_confidence && (
          <> Forward r by tier: {Object.entries(v.by_confidence).map(([k, x], i) => (
            <span key={k}>{i ? ' · ' : ''}{k} {f2(x)}</span>))}.</>
        )}
      </p>
      {notes && <p className="muted">{notes}</p>}
    </div>
  )
}

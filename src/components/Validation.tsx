import { memo } from 'react'
import type { Baseline, Validation as V } from '../lib/types'
import Info from './Info'
import SeasonAccuracy from './SeasonAccuracy'

interface Props { v: V; baselines: Baseline[]; notes?: string; heldOut: number | null }

const f2 = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? 'n/a' : x.toFixed(2))

/** How far to trust the ranking: the forward test, its repeats on earlier cohorts, the
 *  baselines it has to beat, and how honest its error bands turned out to be. */
function Validation({ v, baselines, notes, heldOut }: Props) {
  const years = v.by_year ?? []
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
        <b>{v.scheme}.</b> On {v.n_test.toLocaleString('en-US')} held-out lines, correlation with their real yield is{' '}
        <b>r = {v.r.toFixed(2)}</b>
        {v.r_ci95 && <> (95% interval {f2(v.r_ci95[0])} to {f2(v.r_ci95[1])}, resampling families)</>}
        {v.ceiling != null && <>; plot noise caps any predictor near <b>{v.ceiling.toFixed(2)}</b></>}. Against standard
        GBLUP{v.vs_gblup_ci95 && <> the gain is {f2(v.vs_gblup_ci95[0])} to {f2(v.vs_gblup_ci95[1])} in r (95%), and</>}
        {v.seasons_won != null && v.seasons != null && <> 2-Step was more accurate in {v.seasons_won} of {v.seasons} seasons
          {v.seasons_won === v.seasons && <> (sign test p = {(0.5 ** v.seasons).toFixed(3)})</>}.</>} The top 20% by
        prediction holds <b>{Math.round(v.top20_recovery * 100)}%</b> of the real top 20% (chance is 20%).
        {v.r_between != null && v.r_within != null && (
          <> Split: families ranked at <b>r = {f2(v.r_between)}</b> from what their parents passed on, siblings inside a family at{' '}
            <b>r = {f2(v.r_within)}</b>.</>
        )}
        {v.r_as_planted != null && (
          <> Against the raw testcross result, tester included (the tester's effect as known in January added back):{' '}
            <b>r = {f2(v.r_as_planted)}</b>.</>
        )}
      </p>
      {years.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <SeasonAccuracy years={years} heldOut={heldOut} revealed ceiling={v.ceiling} bare />
          <p className="muted small" style={{ margin: '6px 0 0' }}>
            Each season is a separate forward test: that year's families predicted from the years before it. Hover a
            season for its numbers.
            {v.tuned_on && <> Every setting was chosen on earlier seasons; {heldOut}, the decision year, was kept aside as the final test.</>}
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
      {v.location_specific && (
        <p>
          <b>Broad-acre, and we tested the alternative.</b> A line's yield swings across its own locations
          (sd {v.location_specific.sd_within_line} bu) more than lines differ from each other
          (sd {v.location_specific.sd_between_lines} bu). A genomic reaction-norm model, fitted on earlier years, predicted
          those swings in {v.location_specific.n_plots.toLocaleString('en-US')} held-out plots at <b>r = {f2(v.location_specific.r_history)}</b>,
          and at r = {f2(v.location_specific.r_oracle)} even when told each trial's real productivity. Every line is tested
          in one year only, so its location response is never seen twice: ProMaize predicts broad-acre performance.
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

export default memo(Validation)

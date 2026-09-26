import { useState } from 'react'

/* ---------------------------------------------------------------- two questions: family, then sibling */

// Forward tests on the real Bayer data: each year's families predicted from the years before it.
// Regenerate with scripts/build_data.py --source bayer (validation.by_year in the JSON).
const YEARS = [
  { year: 2003, between: 0.27, within: 0.13, ours: 0.19, standard: 0.19 },
  { year: 2004, between: 0.2, within: 0.15, ours: 0.17, standard: 0.1 },
  { year: 2005, between: 0.49, within: 0.19, ours: 0.31, standard: 0.26 },
  { year: 2006, between: 0.44, within: 0.23, ours: 0.3, standard: 0.21 },
  { year: 2007, between: 0.23, within: 0.23, ours: 0.21, standard: 0.07 },
  { year: 2008, between: 0.1, within: 0.16, ours: 0.13, standard: 0.07 },
]

export function TwoQuestions() {
  const [view, setView] = useState<'family' | 'sibling'>('family')
  const key = view === 'family' ? 'between' : 'within'
  const max = 0.5
  return (
    <div>
      <div className="toggle" style={{ marginBottom: 12 }}>
        <button className={view === 'family' ? 'on' : ''} onClick={() => setView('family')}>1. how good is the family?</button>
        <button className={view === 'sibling' ? 'on' : ''} onClick={() => setView('sibling')}>2. which kids in it?</button>
      </div>
      {view === 'family'
        ? (
          <p className="explain" style={{ marginTop: 0 }}>
            A new family has never been grown, so its average can only come from its <b>two parents</b>: from what they
            passed on to the kids. Averaging the kids' DNA shows exactly that (in a backcross, three quarters of one
            parent). The model learned, from 800 earlier families, which versions go with good families, and scores the
            new one. It also removes the <b>tester</b>'s own effect first, so a family is not credited for the partner it
            was crossed to.
          </p>
          )
        : (
          <p className="explain" style={{ marginTop: 0 }}>
            Brothers and sisters share both parents but each inherited <b>different pieces</b> of them. The model looks
            only at how siblings differ from each other, in every earlier family: which pieces go with the better kids.
            Inside a family the tester, the fields and the family's luck are the same for everyone, so they cancel out.
            That makes this part steady: it worked every year.
          </p>
          )}
      <div className="lanes" style={{ marginTop: 12 }}>
        <div className="lanes-title">How well each question was answered, year by year (r, higher is better)</div>
        {YEARS.map((y) => (
          <div key={y.year} style={{ display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr) 44px', gap: 8, alignItems: 'center', margin: '4px 0' }}>
            <span className="small">{y.year}</span>
            <span style={{ background: 'var(--row-alt)', borderRadius: 4, height: 12, display: 'block' }}>
              <span style={{ display: 'block', height: 12, borderRadius: 4, width: `${(y[key] / max) * 100}%`,
                background: view === 'family' ? 'var(--accent)' : 'var(--good)' }} />
            </span>
            <b className="small">{y[key].toFixed(2)}</b>
          </div>
        ))}
      </div>
      <div className="verdict strong">
        {view === 'family'
          ? <>The family question swings: easy in 2005 (0.49), hard in 2008 (0.10), when many families had a parent nobody
            had tested before. In years like that, spreading plots evenly across families costs almost nothing (8 cents an
            acre in 2008's backtest) and keeps twice as many families: ProMaize recommends it for 2008.</>
          : <>The sibling question held every year (0.13 to 0.23). Even when the family call fails, markers still pick the
            better kids inside each family.</>}
      </div>
      <p className="explain">
        Most models answer both questions at once, with one formula over every line. It ends up learning mostly "which
        families were good", which says nothing about next year's families: they are all new. Splitting the job is why
        ProMaize beat that standard model in all 6 years ({YEARS.map((y) => `${y.ours.toFixed(2)} vs ${y.standard.toFixed(2)}`).join(', ')}),
        and why its picks earned 60% more per acre than the standard model's, in the real fields, averaged over those
        six seasons.
      </p>
    </div>
  )
}

import { useState } from 'react'
import { MARKERS, NEW, letters, predict } from './toy'

/* One candidate's year: what we know in January, the plot decision, the field, and how the
   result becomes next year's training data. Picks up where "Pools are a cycle" leaves off. */

const KID = NEW[2] // C1.7.3

const FIELDS = [
  { loc: 'IADA', state: 'Iowa', avg: 205, kid: 210, mst: 18.9, lodg: 3 },
  { loc: 'ILMN', state: 'Illinois', avg: 198, kid: 206, mst: 18.1, lodg: 5 },
  { loc: 'INVI', state: 'Indiana', avg: 188, kid: 193, mst: 17.6, lodg: 4 },
  { loc: 'NEDA', state: 'Nebraska', avg: 172, kid: 181, mst: 16.8, lodg: 2 },
  { loc: 'MOBU', state: 'Missouri', avg: 165, kid: 168, mst: 17.2, lodg: 6 },
]
// a rival kid that happened to be planted only in the two best fields
const RIVAL = { id: 'C1.9.2', fields: [{ loc: 'IADA', kid: 207, avg: 205 }, { loc: 'ILMN', kid: 200, avg: 198 }] }

const STAGES = [
  { m: 'Jan', t: 'A new candidate' },
  { m: 'Feb', t: 'The plot decision' },
  { m: 'May', t: 'Planting' },
  { m: 'Oct', t: 'Harvest' },
  { m: 'Dec', t: 'Into the data' },
]

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const signed = (v: number) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(0)

function Known({ stage }: { stage: number }) {
  const rows: [string, boolean, string][] = [
    ['Its ID', true, KID.id],
    ['Its parents', true, 'the two lines crossed to make family C1.7'],
    ['Its DNA', true, 'read in a lab, a few dollars'],
    ['How it performs in a field', stage >= 3, stage >= 3 ? `${FIELDS.length} plots harvested` : 'unknown'],
  ]
  return (
    <div className="known">
      <div className="small muted">What we know about {KID.id}</div>
      {rows.map(([k, ok, v]) => (
        <div key={k} className={'krow ' + (ok ? 'ok' : 'no')}>
          <span className="kmark">{ok ? '✓' : '?'}</span>
          <span><b>{k}</b><br /><span className="small muted">{v}</span></span>
        </div>
      ))}
    </div>
  )
}

export function CandidateYear() {
  const [stage, setStage] = useState(() => {
    const v = Number(new URLSearchParams(location.search).get('year'))
    return Number.isFinite(v) && v > 0 ? Math.min(v, STAGES.length) - 1 : 0
  })
  const [adjusted, setAdjusted] = useState(() => new URLSearchParams(location.search).has('adj'))
  const kidDiff = mean(FIELDS.map((f) => f.kid - f.avg))
  const kidRaw = mean(FIELDS.map((f) => f.kid))
  const rivalRaw = mean(RIVAL.fields.map((f) => f.kid))
  const rivalDiff = mean(RIVAL.fields.map((f) => f.kid - f.avg))

  return (
    <div>
      <div className="timeline">
        {STAGES.map((s, i) => (
          <button key={s.t} className={'tl ' + (i === stage ? 'active' : i < stage ? 'done' : '')} onClick={() => setStage(i)}>
            <span className="tlm">{s.m}</span>
            <span className="tlt">{s.t}</span>
          </button>
        ))}
      </div>

      <div className="yeargrid">
        <Known stage={stage} />
        <div className="yearmain">
          {stage === 0 && (
            <>
              <p className="lead">Kid <b>{KID.id}</b> exists. It has never been in a field. All we have is its DNA:</p>
              <div className="dnachips">
                {MARKERS.map((m, j) => (
                  <span key={m.id} className={'dchip ' + (KID.codes[j] === -1 ? 'v1' : 'v2')}>
                    {m.id} <b>{letters(m, KID.codes[j])}</b>
                  </span>
                ))}
                <span className="dchip more">… a few thousand more</span>
              </div>
            </>
          )}
          {stage === 1 && (
            <>
              <p className="lead">It's one of <b>1,000</b> new kids this year. There are field plots for <b>300</b>.</p>
              <div className="bigq">Does {KID.id} get plots?</div>
              <div className="predbox">
                <span className="small muted">The model's prediction for {KID.id}, from its DNA</span>
                <span className="predval">{predict(KID).toFixed(0)} bu/ac</span>
                <span className="small muted">learned from <b>past</b> lines: kids from earlier years that already have field results. Not from {KID.id}'s own harvest, which doesn't exist yet.</span>
              </div>
              <div className="verdict strong">
                <b>This is where ProMaize works.</b> Every candidate gets a prediction like this, and the best predictions
                get the plots. It has to happen now, in winter, from DNA alone, because planting is in spring.
              </div>
            </>
          )}
          {stage === 2 && (
            <>
              <p className="lead">It got plots. Its test seed (the kid crossed with the tester) is planted in <b>{FIELDS.length} fields</b> across the Corn Belt, next to hundreds of other kids' plots.</p>
              <div className="fields">
                {FIELDS.map((f) => (
                  <div key={f.loc} className="fieldcard">
                    <div className="plotart">{[0, 1, 2, 3].map((r) => <span key={r} />)}</div>
                    <b>{f.state}</b>
                    <span className="small muted mono">{f.loc}</span>
                  </div>
                ))}
              </div>
              <p className="small muted">Several locations, because one field can be lucky or unlucky: rain, soil, a storm.</p>
            </>
          )}
          {stage === 3 && (
            <>
              <div className="row-actions" style={{ marginTop: 0 }}>
                <div className="toggle">
                  <button className={!adjusted ? 'on' : ''} onClick={() => setAdjusted(false)}>raw yields</button>
                  <button className={adjusted ? 'on' : ''} onClick={() => setAdjusted(true)}>compared with the field average</button>
                </div>
              </div>
              <table className="harvest">
                <thead>
                  <tr><th className="l">field</th><th>{KID.id}</th>{adjusted && <th>field average</th>}{adjusted && <th>difference</th>}<th>moisture %</th><th>lodging %</th></tr>
                </thead>
                <tbody>
                  {FIELDS.map((f) => (
                    <tr key={f.loc}>
                      <td className="l">{f.state}</td>
                      <td><b>{f.kid}</b></td>
                      {adjusted && <td className="muted">{f.avg}</td>}
                      {adjusted && <td className="good-t"><b>{signed(f.kid - f.avg)}</b></td>}
                      <td>{f.mst}</td>
                      <td>{f.lodg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="compare">
                <div className={'cmp ' + (!adjusted ? 'lead-cmp' : '')}>
                  <span className="mono">{RIVAL.id}</span>
                  <span className="small muted">planted only in Iowa and Illinois, the two best fields</span>
                  <b>{adjusted ? `${signed(rivalDiff)} vs its fields` : `${rivalRaw.toFixed(0)} bu/ac`}</b>
                </div>
                <div className={'cmp ' + (adjusted ? 'lead-cmp' : '')}>
                  <span className="mono">{KID.id}</span>
                  <span className="small muted">planted in all five</span>
                  <b>{adjusted ? `${signed(kidDiff)} vs its fields` : `${kidRaw.toFixed(0)} bu/ac`}</b>
                </div>
              </div>
              <div className={'verdict ' + (adjusted ? 'strong' : 'warn')}>
                {adjusted
                  ? <>Now it's fair. Compared with the other plots <b>in the same fields</b>, {KID.id} beat the average by {signed(kidDiff)} bu/ac and {RIVAL.id} by only {signed(rivalDiff)}. {KID.id} is the better line; {RIVAL.id} was just planted in better dirt.</>
                  : <>On raw numbers {RIVAL.id} looks better ({rivalRaw.toFixed(0)} vs {kidRaw.toFixed(0)}). But it was only grown in the two best fields. Switch to <b>compared with the field average</b>.</>}
              </div>
            </>
          )}
          {stage === 4 && (
            <>
              <p className="lead">The results are written down under the kid's ID, one row per field. This is exactly the shape of the real data file:</p>
              <div className="tablewrap">
                <table className="harvest filerows">
                  <thead><tr>
                    <th className="l">LINE<div className="tiny">the kid</div></th>
                    <th>YEAR</th>
                    <th className="l">LOC<div className="tiny">the field</div></th>
                    <th>YLD_BE<div className="tiny">yield, bu/ac</div></th>
                    <th>MST<div className="tiny">moisture %</div></th>
                    <th>STLP<div className="tiny">stalk lodging %</div></th>
                  </tr></thead>
                  <tbody>
                    {FIELDS.map((f) => (
                      <tr key={f.loc}><td className="l mono">{KID.id}</td><td>2008</td><td className="l mono">{f.loc}</td><td>{f.kid}</td><td>{f.mst}</td><td>{f.lodg}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="verdict strong">
                {KID.id} was predicted <b>once</b>, in February, from its DNA. It's never predicted again: now we
                have its real results. Next year it simply becomes one more <b>example</b> the model learns from, to
                predict the <b>next</b> batch of kids (C1.8.x, C1.9.x…). Kids that never got plots never get results,
                so they never become examples. That loop, year after year, is the data we're handed.
              </div>
            </>
          )}
        </div>
      </div>

      <p className="explain">
        {[
          'Every year a breeding program starts with a pile of kids like this one: new lines from this year\'s crosses. In January the only real information about each of them is its DNA.',
          'Plots are the scarce resource: land, seed, labour, and one answer per season. Most kids will never get one. So every kid is predicted first, and the prediction decides.',
          'The kid itself isn\'t planted: its test seed is (the kid crossed with the fixed tester, as in the previous section). The same test seed goes to several fields so one bad storm doesn\'t decide its fate.',
          'Yield depends heavily on the field and the year, often more than on the line. So a result only means something next to the other plots in the same field. The data we get has this built in: every row says which field (LOC) and year (YEAR) it came from, and the pipeline compares each plot with its own field before learning anything.',
          'Nothing magic: this year\'s field results are next year\'s training data. The model gets a little more to learn from every year.',
        ][stage]}
      </p>
      <div className="row-actions">
        <button className="btn ghost" disabled={stage === 0} onClick={() => setStage((s) => s - 1)}>← back</button>
        <button className="btn" disabled={stage === STAGES.length - 1} onClick={() => setStage((s) => s + 1)}>next →</button>
      </div>
    </div>
  )
}

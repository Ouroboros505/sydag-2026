import type { ReactNode } from 'react'
import ThemeToggle from '../components/ThemeToggle'
import DataCheck from '../components/DataCheck'

// Counts from the Bayer files as delivered (see README, "Data quality, counted").
const RECORDED: [string, number][] = [
  ['Yield', 95.9], ['Harvest moisture', 97.3], ['Test weight', 87.8], ['Lodging (root or stalk)', 72.0],
  ['Relative maturity', 59.5],
]
const GENOTYPED: [number, number][] = [
  [2000, 65], [2001, 86], [2002, 71], [2003, 93], [2004, 99], [2005, 99], [2006, 100], [2007, 100], [2008, 100],
]

function Bar({ label, pct, note }: { label: string; pct: number; note?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 180px) minmax(0, 1fr) 56px', gap: 10, alignItems: 'center', margin: '6px 0' }}>
      <span className="small">{label}</span>
      <span style={{ background: 'var(--row-alt)', borderRadius: 4, height: 12, display: 'block' }}>
        <span style={{ display: 'block', height: 12, borderRadius: 4, width: `${pct}%`, background: pct >= 90 ? 'var(--good)' : 'var(--accent)' }} />
      </span>
      <b className="small">{pct}%{note ?? ''}</b>
    </div>
  )
}

function Funnel() {
  const steps: [string, string][] = [
    ['1,072,276', 'field plots, 2000 to 2008'],
    ['154,330', 'lines with a field result'],
    ['143,726', 'of those with DNA (93%)'],
    ['999', 'families (each tested in one year)'],
    ['157', 'new families in 2008: 15,962 lines to rank'],
  ]
  return (
    <div className="three" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
      {steps.map(([n, what]) => (
        <div key={what} className="lanes" style={{ marginTop: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{n}</div>
          <div className="small muted">{what}</div>
        </div>
      ))}
    </div>
  )
}

interface Step { id: string; title: string; why: string; body: ReactNode }

const STEPS: Step[] = [
  {
    id: 'files', title: 'Use the complete files',
    why: 'A cut-off file silently drops families.',
    body: (
      <p className="explain" style={{ marginTop: 0 }}>
        The first upload of the C2 DNA zip was cut off: <b>290 of 500</b> families, and none of C2's 2007 and 2008 families.
        We confirmed it three ways (no proper ending, stops in the middle of a file, same as the server's copy), told the
        organizers, and used the re-upload, which has <b>all 500</b>.
      </p>
    ),
  },
  {
    id: 'ids', title: 'Fix the names so the files match',
    why: 'Field results and DNA live in different files. If the names do not match, a line has no DNA.',
    body: (
      <>
        <p className="explain" style={{ marginTop: 0 }}>
          The C2 field file wrote line names with a stray <b>.0</b> at the end (<span className="mono">C2.1.1.0</span>),
          which never matches the DNA files (<span className="mono">C2.1.1</span>). We removed it. A few DNA rows had broken
          names (<span className="mono">000000161.1</span>); nothing matches them, so we dropped them. After that, 93% of
          lines with field results have DNA:
        </p>
        <div className="small muted" style={{ margin: '10px 0 4px' }}>lines with DNA, by year they were tested</div>
        {GENOTYPED.map(([y, p]) => <Bar key={y} label={String(y)} pct={p} />)}
        <p className="explain">The early years (2000 to 2003) were only partly genotyped; from 2004 on, nearly every line was.</p>
      </>
    ),
  },
  {
    id: 'impossible', title: 'Remove impossible numbers',
    why: 'One typo can move an average more than a real difference between lines.',
    body: (
      <p className="explain" style={{ marginTop: 0 }}>
        <b>1,069 maturity values</b> were outside any possible range, like <b>−24</b> or <b>383</b> days; so were{' '}
        <b>56 lodging readings</b> above 100% of plants (one says 3,056%) and <b>14 harvest moistures</b> above 45%. All were
        set to missing instead of being averaged in. Yield and test weight had none: we checked every column against a
        plausible range (yield 20 to 350 bu/ac, moisture 5 to 45%, maturity 80 to 140 days, lodging 0 to 100%).
      </p>
    ),
  },
  {
    id: 'missing', title: 'Missing means missing, not zero',
    why: 'An unscored plot is unknown. Filling it with zero would invent perfect lines.',
    body: (
      <>
        <div className="small muted" style={{ marginBottom: 4 }}>share of the 1.07 million plots where each trait was recorded</div>
        {RECORDED.map(([l, p]) => <Bar key={l} label={l} pct={p} />)}
        <p className="explain">
          Lodging (plants falling over) was scored on only 72% of plots. Treating the rest as zero lodging would make
          those lines look strong for no reason, so a line's lodging is the average of the plots that were scored. Lodging is
          also compared to its own field: most of it is which storm hit which field, not the line.
        </p>
      </>
    ),
  },
  {
    id: 'field', title: 'Compare every plot to its own field',
    why: 'A good field lifts every line in it. We want the line, not the field.',
    body: (
      <>
        <table className="harvest two" style={{ maxWidth: 560 }}>
          <thead><tr><th className="l">Line C1.7.3 planted in</th><th>field average</th><th>this plot</th><th>compared to its field</th></tr></thead>
          <tbody>
            <tr><td className="l">a great field</td><td>215</td><td>212</td><td>−3</td></tr>
            <tr><td className="l">a dry field</td><td>180</td><td>190</td><td><b>+10</b></td></tr>
            <tr><td className="l"><b>the line's value</b></td><td /><td className="muted">raw average 201</td><td><b>+3.5</b></td></tr>
          </tbody>
        </table>
        <p className="explain">
          An example with round numbers. Each plot is measured against the average of every plot in the same field that
          year, and within the same group (C1 or C2), because the two groups are separate trials even when they share a
          farm. Then we average over the line's ~7 locations. Moisture, maturity and lodging get the same treatment.
        </p>
        <p className="explain">
          This comes after the clean-up steps on purpose: a field's average is worked out only from values that passed
          them, so one impossible number can't drag a whole field up or down.
        </p>
      </>
    ),
  },
  {
    id: 'dna', title: 'Fill the few DNA gaps',
    why: 'The model needs a value at every one of the 2,911 DNA spots.',
    body: (
      <p className="explain" style={{ marginTop: 0 }}>
        The kids were only read at about 100 DNA spots each; the organizers filled in the rest from the parents (their
        DNA is read at all 2,911 spots). After that, <b>0.065%</b> of spots were still empty. We filled each from the
        family's average, then from the parents, and in the very last cases with the neutral value, 0.
      </p>
    ),
  },
  {
    id: 'tester', title: 'Take out the tester\'s effect',
    why: 'Each line is crossed to a partner (the tester) to be tested. We want to judge the line, not its partner.',
    body: (
      <>
        <p className="explain" style={{ marginTop: 0 }}>
          There are about <b>95 different testers</b>, one per family, and some make every line crossed to them look better.
          We estimated each tester's effect from how its families did, and subtracted it. But carefully:
        </p>
        <table className="harvest two" style={{ maxWidth: 640, marginTop: 10 }}>
          <thead><tr><th className="l">A tester seen with</th><th>its families were</th><th>effect we remove</th><th className="l">why</th></tr></thead>
          <tbody>
            <tr><td className="l">1 family</td><td>+10 bu</td><td><b>+2 bu</b></td><td className="l">one family is mostly the family itself</td></tr>
            <tr><td className="l">40 families</td><td>+3 bu on average</td><td><b>+2.7 bu</b></td><td className="l">many families: now it is the tester</td></tr>
          </tbody>
        </table>
        <p className="explain">
          The rule: effect = sum of its families' results ÷ (number of families + λ). The caution factor λ is measured from
          the data itself (about 4 in C1, 14 in C2). Breeders call this a BLUP. When we test the model on a past year, the
          tester effects come only from the years before it.
        </p>
      </>
    ),
  },
]

export default function DataPage() {
  return (
    <div className="learn">
      <header className="lhead">
        <div>
          <h1>How we cleaned the data <span className="version" title={`ProMaize v${__VERSION__}, built ${__BUILD__} UTC`}>v{__VERSION__}</span></h1>
          <p className="sub">What we did to the Bayer files before any model saw them, step by step, with the real numbers.</p>
        </div>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a className="pill" href="/">Back to the demo</a>
          <ThemeToggle />
        </span>
      </header>

      <section className="panel lsec" style={{ marginBottom: 16 }}>
        <h2 style={{ paddingLeft: 0 }}>What we started with, and what we ended with</h2>
        <Funnel />
      </section>

      <section className="panel lsec" style={{ marginBottom: 16 }}>
        <h2 style={{ paddingLeft: 0 }}>Try it on a file</h2>
        <DataCheck />
      </section>

      <div className="lgrid">
        <nav className="toc">
          <div className="small muted">Steps</div>
          <ol>
            {STEPS.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}
          </ol>
          <a className="btn" href="/learn/">New to breeding? →</a>
        </nav>
        <div className="lbody">
          {STEPS.map((s, i) => (
            <section key={s.id} id={s.id} className="panel lsec">
              <div className="num">{i + 1}</div>
              <h2>{s.title}</h2>
              <p className="oneline">{s.why}</p>
              {s.body}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

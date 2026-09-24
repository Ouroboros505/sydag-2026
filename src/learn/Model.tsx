import { useState } from 'react'
import { BASE, MARKERS, NEW, PARENT_A, PARENT_B, PAST, WEIGHTS, letters, predict, split, type Code, type Line } from './toy'

const fmt = (v: number, d = 1) => v.toFixed(d)
const sign = (v: number, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d)

function Cell({ c, j, mode }: { c: Code; j: number; mode: 'numbers' | 'letters' }) {
  const cls = c === -1 ? 'v1' : c === 1 ? 'v2' : 'mid'
  return <td className={'cell ' + cls}>{mode === 'letters' ? letters(MARKERS[j], c) : c > 0 ? '+1' : c}</td>
}

/* ---------------------------------------------------------------- 5. the table */

export function MatrixView() {
  const [mode, setMode] = useState<'numbers' | 'letters'>('numbers')
  const rows: { l: Line; tag: string }[] = [
    ...PAST.map((l) => ({ l, tag: `past · ${l.year}` })),
    { l: PARENT_A, tag: 'parent' },
    { l: PARENT_B, tag: 'parent' },
    ...NEW.map((l) => ({ l, tag: 'new · 2008' })),
  ]
  return (
    <div>
      <div className="row-actions">
        <div className="toggle">
          <button className={mode === 'numbers' ? 'on' : ''} onClick={() => setMode('numbers')}>as the file stores it</button>
          <button className={mode === 'letters' ? 'on' : ''} onClick={() => setMode('letters')}>as letters</button>
        </div>
        <span className="legend-inline"><i className="sw v1" />version 1 (−1) <i className="sw v2" />version 2 (+1)</span>
      </div>
      <div className="tablewrap">
        <table className="matrix">
          <thead>
            <tr>
              <th className="l">line</th>
              <th className="l">what it is</th>
              {MARKERS.map((m) => <th key={m.id} title={m.where}>{m.id}<div className="tiny">{m.v1}/{m.v2}</div></th>)}
              <th>yield bu/ac</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ l, tag }, i) => (
              <tr key={l.id} className={i === PAST.length ? 'sep' : i === PAST.length + 2 ? 'sep' : undefined}>
                <td className="l mono">{l.id}</td>
                <td className="l muted small">{tag}</td>
                {l.codes.map((c, j) => <Cell key={j} c={c} j={j} mode={mode} />)}
                <td className={l.yield ? '' : 'muted'}>{l.yield ?? (l.id.startsWith('Parent') ? '' : '?')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="explain">
        One row per line, one column per <b>marker</b> (that's the M: M1 is one spot in the DNA, and its cell sums up both copies at that spot). <b>Past lines</b> have DNA <i>and</i> a yield: they're the training data.
        The <b>new kids</b> have DNA only: their yield is the <b>?</b> we have to predict. Look at the new kids next to their
        parents: in every column each kid carries <b>either Parent A's version or Parent B's</b>. C1.7.1 took A for the first
        three markers and B for the last three. DNA is inherited in chunks, and that's what the table shows.
        No 0s here because every line is <b>settled</b> (pure), so each spot is −1 or +1. Real files have a few 0s
        (spots not fully settled) and some NA (missing).
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------- 6. learning */

export function MarkerExplorer() {
  const [j, setJ] = useState(1)
  const s = split(j)
  const lo = PAST.filter((l) => l.codes[j] === -1)
  const hi = PAST.filter((l) => l.codes[j] === 1)
  const max = 195
  const min = 150
  const w = (v: number) => `${((v - min) / (max - min)) * 100}%`
  const ranked = MARKERS.map((m, k) => ({ m, g: split(k).gap })).sort((a, b) => Math.abs(b.g) - Math.abs(a.g))
  return (
    <div>
      <div className="steps">
        {MARKERS.map((m, k) => (
          <button key={m.id} className={'step' + (k === j ? ' active' : '')} onClick={() => setJ(k)}><b>{m.id}</b></button>
        ))}
      </div>
      <p className="muted small">Pick a marker. The past lines get sorted into two groups by which version they carry there.</p>
      <div className="groups">
        {[{ name: `version 1 (${MARKERS[j].v1}${MARKERS[j].v1}) · −1`, cls: 'v1', ls: lo, avg: s.lo },
          { name: `version 2 (${MARKERS[j].v2}${MARKERS[j].v2}) · +1`, cls: 'v2', ls: hi, avg: s.hi }].map((g) => (
          <div key={g.cls} className="group">
            <div className="gname"><i className={'sw ' + g.cls} />{g.name}</div>
            {g.ls.map((l) => (
              <div key={l.id} className="barrow">
                <span className="mono small">{l.id}</span>
                <div className="bar"><div className={'fill ' + g.cls} style={{ width: w(l.yield!) }} /></div>
                <span className="small">{l.yield}</span>
              </div>
            ))}
            <div className="avg">average <b>{fmt(g.avg)}</b> bu/ac</div>
          </div>
        ))}
      </div>
      <div className={'verdict' + (Math.abs(s.gap) > 5 ? ' strong' : '')}>
        Gap for {MARKERS[j].id}: <b>{sign(s.gap)} bu/ac</b>.{' '}
        {Math.abs(s.gap) > 15 ? 'Big: this marker sits near something that really moves yield.'
          : Math.abs(s.gap) > 5 ? 'Real but smaller: a modest effect.'
          : 'Tiny: which version a line has here makes no difference. Noise.'}
      </div>
      <div className="weights">
        <div className="small muted">
          What the model learns: <b>one weight per marker</b> (half the gap). The sign says which version wins:
          positive = version 2 is better, negative = version 1 is better. "Per step" = one move along −1 → 0 → +1.
        </div>
        {ranked.map(({ m, g }) => {
          const v2wins = g >= 0
          return (
            <div key={m.id} className="wrow">
              <span className="mono">{m.id}</span>
              <div className="wbar"><div className={'wfill ' + (v2wins ? 'v2' : 'v1')} style={{ width: `${(Math.abs(g) / 20) * 100}%` }} /></div>
              <span className="small">{sign(g / 2, 2)} per step · <b className={v2wins ? 't-v2' : 't-v1'}>{v2wins ? m.v2 + m.v2 : m.v1 + m.v1}</b> better</span>
            </div>
          )
        })}
      </div>
      <div className="nextyear">
        <b>This toy is easy on purpose. The real thing is harder:</b>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          <li><b>No single marker matters much.</b> Here M2 alone is worth 20 bushels. In real maize, thousands of spots each move yield a fraction of a bushel.</li>
          <li><b>More markers than lines, and they're tangled.</b> Nearby spots are inherited together, so it's hard to tell which one is doing the work. Without keeping every weight small (ridge), the model memorises noise.</li>
          <li><b>The field is noisy.</b> Weather and soil move yield more than genetics does, even after comparing with the field average.</li>
          <li><b>The families are new.</b> The model has to predict kids of crosses it has never seen.</li>
        </ul>
        That's why honest accuracy on the real data is around r = 0.15 (section 11): a weak but real signal.
      </div>
      <p className="explain">
        That's the whole idea of the model. Nobody knows what M2 <i>is</i>. It's not a gene we understand, just a spot
        that happens to sit next to something that matters on the chromosome, so the two get inherited together. The
        model notices that lines with one version out-yield lines with the other. On real data it does this for
        a few thousand markers at once and untangles them from each other (ridge regression). Same principle.
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------- 7. predicting */

export function Predictor() {
  const [k, setK] = useState(2)
  const [reveal, setReveal] = useState(false)
  const l = NEW[k]
  const parts = MARKERS.map((m, j) => ({ m, c: l.codes[j], w: WEIGHTS[j], v: l.codes[j] * WEIGHTS[j] }))
  const p = predict(l)
  return (
    <div>
      <div className="steps">
        {NEW.map((n, i) => (
          <button key={n.id} className={'step' + (i === k ? ' active' : '')} onClick={() => { setK(i); setReveal(false) }}>
            <span className="mono">{n.id}</span>
          </button>
        ))}
      </div>
      <div className="sum">
        <div className="sumrow head"><span>starting point: average of the past lines</span><b>{fmt(BASE)}</b></div>
        {parts.map(({ m, c, w, v }) => (
          <div key={m.id} className={'sumrow' + (Math.abs(v) > 3 ? ' heavy' : '')}>
            <span><span className="mono">{m.id}</span> has <b className={c === -1 ? 't-v1' : 't-v2'}>{letters(m, c)}</b> ({c > 0 ? '+1' : c}) × weight {sign(w, 2)}</span>
            <b>{sign(v)}</b>
          </div>
        ))}
        <div className="sumrow total"><span>predicted yield</span><b>{fmt(p)} bu/ac</b></div>
        {reveal && <div className="sumrow truth"><span>what the field later showed</span><b>{l.truth} bu/ac</b></div>}
      </div>
      <div className="row-actions">
        <button className="btn" onClick={() => setReveal((r) => !r)}>{reveal ? 'Hide' : 'Reveal the real yield'}</button>
        <span className="muted small">In the toy data it's close. On real data it's much rougher. See the next section.</span>
      </div>
      <p className="explain">
        A prediction is just the average plus a small push from each marker. Most pushes are near zero; M2 and M5 do
        the work. This line has never been in a field, and we still get a number, from DNA alone, before planting.
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------- 8. the honesty trap */

export function LeakageTrap() {
  const [mode, setMode] = useState<'random' | 'year'>('random')
  const fam = ['C1.3', 'C1.4', 'C1.5', 'C1.6', 'C1.7']
  const kids = [1, 2, 3]
  // a scattered hold-out, one kid per family, so every tested kid still has siblings in training
  const RANDOM = new Set(['C1.3.2', 'C1.4.3', 'C1.5.1', 'C1.6.2', 'C1.7.3'])
  const isTest = (f: string, k: number) => (mode === 'random' ? RANDOM.has(`${f}.${k}`) : f === 'C1.7')
  return (
    <div>
      <div className="toggle">
        <button className={mode === 'random' ? 'on' : ''} onClick={() => setMode('random')}>test on a random mix</button>
        <button className={mode === 'year' ? 'on' : ''} onClick={() => setMode('year')}>test on a new family only</button>
      </div>
      <div className="families">
        {fam.map((f) => (
          <div key={f} className="fam">
            <div className="small mono">{f}</div>
            <div className="kids">
              {kids.map((k) => (
                <span key={k} className={'kid ' + (isTest(f, k) ? 'test' : 'train')} title={`${f}.${k}`}>{k}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="legend-inline"><i className="sw train" />train on it <i className="sw test" />test on it</div>
      <div className={'verdict ' + (mode === 'random' ? 'warn' : 'strong')}>
        {mode === 'random'
          ? <>Score looks great: <b>r ≈ 0.55</b>. But it's fake. Every tested kid has a brother or sister in training, with nearly the same DNA. The model is recognising family members, not predicting.</>
          : <>Honest score: <b>r ≈ 0.15</b> on the real Bayer data. Low, and true: it's what happens when you predict a family nobody has ever grown. This is the real job in January.</>}
      </div>
      <p className="explain">
        <b>r</b> is a correlation: 1 = perfect ranking, 0 = no better than a coin flip. The same model scores 0.55 or
        0.15 depending only on how you test it. Judges from Bayer will ask which one you're showing. ProMaize always
        shows the honest one first, and the leaky one next to it so nobody confuses them.
      </p>
    </div>
  )
}

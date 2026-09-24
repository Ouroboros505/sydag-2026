import { useMemo, useState } from 'react'

/** Start an interactive at a given step via the URL, e.g. /learn/?cycle=5#pools. */
const param = (k: string, max: number) => {
  const v = Number(new URLSearchParams(location.search).get(k))
  return Number.isFinite(v) && v > 0 ? Math.min(v, max) : 0
}

/* ---------------------------------------------------------------- what is a line */

const N_MARK = 10
const LINEAGES = 3

/** Small seeded generator so the demo shows the same story every time. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

type Genome = [number, number][]   // per marker, the two copies: 0 = from line X, 1 = from line Y

/** Simulate selfing: each generation, every marker's two copies are drawn from the parent's two. */
function simulate(seed: number, gens: number): Genome[][] {
  const r = rng(seed)
  const f1: Genome = Array.from({ length: N_MARK }, () => [0, 1] as [number, number])
  const history: Genome[][] = [Array.from({ length: LINEAGES }, () => f1)]
  for (let g = 1; g <= gens; g++) {
    history.push(
      history[g - 1].map((gen) =>
        gen.map(([a, b]) => [r() < 0.5 ? a : b, r() < 0.5 ? a : b] as [number, number]),
      ),
    )
  }
  return history
}

const purity = (g: Genome) => g.filter(([a, b]) => a === b).length / g.length

function Chromosome({ g }: { g: Genome }) {
  return (
    <div className="chromo">
      {[0, 1].map((copy) => (
        <div key={copy} className="copy">
          {g.map((pair, i) => (
            <span key={i} className={'seg ' + (pair[copy] === 0 ? 'x' : 'y')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function WhatIsALine() {
  const MAX = 6
  const history = useMemo(() => simulate(11, MAX), [])
  const [gen, setGen] = useState(() => param('gen', MAX))
  const [dh, setDh] = useState(false)
  // doubled haploid: one copy duplicated, pure in one step
  const shown: Genome[] = dh
    ? history[1].map((g) => g.map(([a]) => [a, a] as [number, number]))
    : history[gen]
  const label = dh ? 'Lab shortcut: one copy, photocopied. Settled in one step' : gen === 0 ? 'Season 0: we just crossed X and Y' : `Season ${gen}: the kids have pollinated themselves ${gen} time${gen > 1 ? 's' : ''}`
  return (
    <div>
      <div className="row-actions" style={{ marginTop: 0 }}>
        <span className="legend-inline" style={{ marginTop: 0 }}>
          <i className="sw lx" />DNA from parent X <i className="sw ly" />DNA from parent Y
        </span>
      </div>
      <div className="lineages">
        {shown.map((g, i) => {
          const p = purity(g)
          return (
            <div key={i} className={'lineage' + (p === 1 ? ' pure' : '')}>
              <div className="lname">Kid {i + 1}</div>
              <Chromosome g={g} />
              <div className="small muted">{dh ? 'bottom row = a photocopy of the top row' : 'top row and bottom row = its two copies of DNA'}</div>
              <div className="purebar"><div style={{ width: `${p * 100}%` }} /></div>
              <div className="small"><b>{Math.round(p * 100)}%</b> settled {p === 1 && <span className="tag-ok">new line ✓</span>}</div>
            </div>
          )
        })}
      </div>
      <div className="verdict strong">{label}</div>
      <div className="row-actions">
        <button className="btn ghost" onClick={() => { setGen(0); setDh(false) }}>Start over</button>
        <button className="btn" disabled={gen >= MAX || dh} onClick={() => setGen((g) => g + 1)}>Next season →</button>
        <button className="btn ghost" onClick={() => setDh(true)}>Lab shortcut: photocopy the DNA</button>
      </div>
      <p className="explain">
        {dh
          ? <>The fast way, done in a lab. Step 1: grow a plant that has only <b>one</b> copy of the kid's DNA (special pollen triggers the seed but its own DNA gets thrown out). Step 2: a chemical makes the plant <b>photocopy</b> that one copy. Now both copies are identical, so every spot matches: fully settled in one step instead of six seasons. Look at the panels: each bottom row is now an exact copy of the top row. Big seed companies make most of their lines this way. The jargon for it is <b>doubled haploid</b>: one copy, doubled.</>
          : gen === 0
          ? <>We crossed two corn lines, X (green) and Y (pink), and got three kids. Every plant has <b>two copies</b> of its DNA, one from each parent, so right now all three kids are <b>identical</b>: half X, half Y at every spot. It's a mix, and if you planted its seeds you'd get a lottery, every plant a bit different. Press <b>Next season</b>.</>
          : gen === 1
          ? <>Corn can pollinate itself, so each kid now makes seed with itself. Look: the three kids are <b>already different from each other</b>, because each one got its own random shuffle of X and Y. Some spots have <b>settled</b>: both copies are the same colour.</>
          : <>Keep going. Once a spot settles it stays that way. After about six seasons a kid is fully settled, and then something useful happens: <b>every plant grown from its seed is the same</b>. That's what a line is. Each kid ends up as its own line, with its own mix of X and Y. These are the C1.7.1, C1.7.2 and so on in the rest of this page. In practice breeders don't wait for 100%: they often start testing around season 3 or 4, drop the bad families early, and keep settling the good ones. They also grow two or three seasons a year (winter nurseries in Hawaii or Chile), so this takes a couple of years, not six.</>}
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------- pools are a cycle */

const POOL = [
  { id: 'L3', x: 95, y: 90 }, { id: 'L9', x: 150, y: 60 }, { id: 'L14', x: 205, y: 95 },
  { id: 'L22', x: 70, y: 150 }, { id: 'L5', x: 130, y: 130 }, { id: 'L17', x: 190, y: 150 },
  { id: 'L8', x: 95, y: 205 }, { id: 'L11', x: 155, y: 195 }, { id: 'L26', x: 215, y: 210 },
  { id: 'L2', x: 125, y: 250 }, { id: 'L30', x: 185, y: 255 },
]
const FAMS = [
  { id: 'C1.1', a: 'L3', b: 'L9', y: 70, cls: 'f3' },
  { id: 'C1.2', a: 'L3', b: 'L14', y: 150, cls: 'f4' },
  { id: 'C1.3', a: 'L22', b: 'L9', y: 230, cls: 'f5' },
]
const KID_X = [520, 548, 576, 604]
// empty spots inside the pool where new lines land
const NEW_SPOTS: [number, number][] = [[52, 228], [80, 268], [42, 186], [150, 286]]
const WINNERS: Record<string, number[]> = { 'C1.1': [1], 'C1.2': [0, 3], 'C1.3': [2] }
const MONO: Record<string, number[]> = { 'C1.1': [0, 1, 2, 3], 'C1.2': [], 'C1.3': [] }

const CYCLE = [
  { t: 'A pool is many lines', d: 'Pool C1 is a collection of hundreds of existing inbred lines (11 shown). Pool C2 is a second, separate collection with exactly the same structure.' },
  { t: 'Pick pairs', d: 'Each family is ONE pair of lines from the pool. The same line can parent several families: L3 is crossed with L9 and with L14; L9 with L3 and with L22.' },
  { t: 'Each pair makes a family', d: 'Each cross gives a family of kids, the candidates: C1.1, C1.2, C1.3. Hundreds of families per pool per year in the real data.' },
  { t: 'Test the kids', d: 'Every kid is crossed with the tester, a fixed line from pool C2. That cross makes a test hybrid: its seed is planted in field plots, measured at harvest, and then discarded. The results are filed under the kid, because they show how good a parent it is. Pool C2 does the same thing in reverse, using a tester from C1.' },
  { t: 'Winners join the pool', d: 'A winner is a kid whose test results (mostly yield, averaged over several locations) stay near the top through a few rounds of bigger and bigger trials. Winners are added to the pool because the pool is where next year\'s parents come from: to make better kids, you cross your best lines. Old, outclassed lines slowly get retired. Each round the parents get a bit better, which is how corn improves year after year. The very best winners are also crossed with a line from the other pool to become a hybrid farmers can buy. Our data sits at the very first round of testing: who even gets into the race.' },
]

export function PoolCycle() {
  const [step, setStep] = useState(() => Math.max(0, param('cycle', CYCLE.length) - 1))
  const [narrow, setNarrow] = useState(() => new URLSearchParams(location.search).has('narrow'))
  const wins = narrow ? MONO : WINNERS
  const pos = (id: string) => POOL.find((p) => p.id === id)!
  const parents = new Set(FAMS.flatMap((f) => [f.a, f.b]))
  const newLines = FAMS.flatMap((f) => wins[f.id].map((k) => ({ fam: f, k })))
  const at = (n: number) => (step >= n ? 1 : 0.12)
  return (
    <div>
      <div className="steps">
        {CYCLE.map((s, i) => (
          <button key={s.t} className={'step' + (i === step ? ' active' : '')} onClick={() => setStep(i)}>
            <b>{i + 1}</b> {s.t}
          </button>
        ))}
      </div>
      <div className="chartbox">
      <svg className="chart" viewBox="0 0 760 360" role="img" aria-label="The breeding cycle within one pool">
        <defs>
          <marker id="arr2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--text-3)" />
          </marker>
        </defs>
        {/* pool */}
        <ellipse cx={145} cy={160} rx={130} ry={135} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeDasharray="6 4" />
        <text x={30} y={22} fontSize={13} fontWeight={600} fill="var(--series-1)">Pool C1: many lines</text>
        {POOL.map((p) => {
          const isParent = parents.has(p.id) && step >= 1
          return (
            <g key={p.id}>
              <circle cx={p.x} cy={p.y} r={isParent ? 11 : 8} fill="var(--series-1)" opacity={isParent || step === 0 ? 1 : 0.35}
                stroke={isParent ? 'var(--text)' : 'none'} strokeWidth={2} />
              <text x={p.x} y={p.y - 14} fontSize={10} fill="var(--text-2)" textAnchor="middle" opacity={isParent || step === 0 ? 1 : 0.5}>{p.id}</text>
            </g>
          )
        })}
        {/* pairs -> families */}
        {FAMS.map((f) => (
          <g key={f.id} opacity={at(1)}>
            {[f.a, f.b].map((pid) => {
              const p = pos(pid)
              return <path key={pid} d={`M${p.x},${p.y} C300,${p.y} 320,${f.y} 385,${f.y}`} fill="none"
                stroke={`var(--fam-${f.cls.slice(1)})`} strokeWidth={1.8} />
            })}
            <rect x={385} y={f.y - 16} width={90} height={32} rx={8} fill={`var(--fam-${f.cls.slice(1)})`} opacity={at(2) === 1 ? 1 : 0.5} />
            <text x={430} y={f.y - 1} fontSize={12} fill="#fff" textAnchor="middle" fontWeight={700}>{f.id}</text>
            <text x={430} y={f.y + 11} fontSize={9.5} fill="#fff" textAnchor="middle">{f.a} × {f.b}</text>
          </g>
        ))}
        {/* kids */}
        {FAMS.map((f) => (
          <g key={f.id + 'k'} opacity={at(2)}>
            {KID_X.map((x, k) => {
              const won = step >= 4 && wins[f.id].includes(k)
              const tested = step >= 3
              return (
                <circle key={k} cx={x} cy={f.y} r={9}
                  fill={`var(--fam-${f.cls.slice(1)})`} opacity={step >= 4 && !won ? 0.25 : 1}
                  stroke={won ? 'var(--good)' : tested ? 'var(--warn)' : 'var(--surface)'} strokeWidth={won ? 3 : 2} />
              )
            })}
          </g>
        ))}
        <text x={562} y={32} fontSize={12} fill="var(--text-2)" textAnchor="middle" opacity={at(2)}>kids = candidates</text>
        {/* tester from C2 */}
        <g opacity={at(3)}>
          <rect x={640} y={250} width={110} height={60} rx={10} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeDasharray="6 4" />
          <text x={650} y={268} fontSize={11} fontWeight={600} fill="var(--series-2)">Pool C2</text>
          <circle cx={695} cy={288} r={9} fill="var(--series-2)" />
          <text x={710} y={292} fontSize={10} fill="var(--text-2)">tester</text>
          <text x={672} y={330} fontSize={11} fill="var(--text)" textAnchor="middle" fontWeight={600}>kid × tester = test hybrid</text>
          <text x={672} y={344} fontSize={10} fill="var(--text-2)" textAnchor="middle">planted, measured, discarded</text>
          <path d="M715,250 C700,200 650,165 615,158" fill="none" stroke="var(--series-2)" strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#arr2)" />
        </g>
        {/* winners back into the pool */}
        <g opacity={step >= 4 ? 1 : 0}>
          <path d="M562,258 C520,330 260,330 196,284" fill="none" stroke="var(--good)" strokeWidth={2} markerEnd="url(#arr2)" />
          <text x={400} y={350} fontSize={12} fill="var(--good)" textAnchor="middle" fontWeight={600}>winners become next year's parents</text>
          {newLines.map(({ fam }, i) => {
            const [x, y] = NEW_SPOTS[i % NEW_SPOTS.length]
            return <circle key={i} cx={x} cy={y} r={8} fill={`var(--fam-${fam.cls.slice(1)})`} stroke="var(--good)" strokeWidth={2.5} />
          })}
        </g>
      </svg>
      </div>
      <p className="explain"><b>Step {step + 1}. {CYCLE[step].t}.</b> {CYCLE[step].d}</p>
      <div className="row-actions">
        <button className="btn ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>← back</button>
        <button className="btn" disabled={step === CYCLE.length - 1} onClick={() => setStep((s) => s + 1)}>next →</button>
        {step === 4 && (
          <div className="toggle">
            <button className={!narrow ? 'on' : ''} onClick={() => setNarrow(false)}>Future A: winners from 3 different families</button>
            <button className={narrow ? 'on' : ''} onClick={() => setNarrow(true)}>Future B: all winners are siblings</button>
          </div>
        )}
      </div>
      {step === 4 && (
        <div className="lanes">
          <div className="lanes-title">Two things happen every year, in parallel</div>
          <div className="lane-grid">
            <div />
            {[2008, 2009, 2010].map((y) => <div key={'h' + y} className="lane-year">{y}</div>)}
            <div className="lane-label">Nursery<span>makes kids</span></div>
            {[2008, 2009, 2010].map((y) => (
              <div key={'n' + y} className="lane-cell nursery">cross pool lines → <b>{y + 1} pile</b> of new kids</div>
            ))}
            <div className="lane-label">Field<span>makes data</span></div>
            {[2008, 2009, 2010].map((y) => (
              <div key={'f' + y} className="lane-cell fieldlane">test the <b>{y} pile</b> → harvest → data</div>
            ))}
            <div className="lane-label">Pool<span>the parents</span></div>
            <div className="lane-cell pool" style={{ gridColumn: 'span 3' }}>
              the field's data decides who gets <b>promoted</b>: after 2 or 3 more rounds of testing, a few lines join the pool, and from then on the nursery can cross them
            </div>
          </div>
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            So a tested kid never goes back into a January pile: candidates are always brand-new. The test makes only
            numbers; kids are made in the nursery, from pool lines.
          </p>
        </div>
      )}
      {step === 4 && (
        <div className={'verdict ' + (narrow ? 'warn' : 'strong')}>
          {narrow
            ? <><b>Future B.</b> All four new parents are brothers and sisters from C1.1, with nearly the same DNA. Next year, crossing them together makes kids that are all alike: little new variety to find something better, and they share the same weak spots (one disease could hit all of them). This is what naturally happens when you just rank: siblings share their parents' good DNA, so they crowd the top of the list together. ProMaize's <b>family limit</b> prevents it.</>
            : <><b>Future A.</b> The four new parents come from three different families, so they carry different DNA. Next year, crossing them together makes genuinely new combinations: more variety, more chances to find a better line, and no single weak spot shared by everything.</>}
        </div>
      )}
    </div>
  )
}

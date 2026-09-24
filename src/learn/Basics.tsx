import { useState } from 'react'
import { MARKERS } from './toy'

/* ---------------------------------------------------------------- 1. the problem */

export function ProblemPicture() {
  const [picked, setPicked] = useState(false)
  const n = 100
  const plots = 30
  // a fixed, scattered "best 30" so the picture doesn't look like the first rows
  const chosen = new Set([2, 5, 9, 11, 14, 18, 21, 26, 29, 33, 37, 40, 44, 47, 52, 55, 58, 61, 63, 67, 70, 74, 77, 81, 84, 86, 90, 93, 96, 99])
  return (
    <div>
      <div className="dots" role="img" aria-label={`${n} candidate lines, ${plots} highlighted as the ones that get a plot`}>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className={'dot' + (picked && chosen.has(i) ? ' on' : '') + (picked && !chosen.has(i) ? ' off' : '')} />
        ))}
      </div>
      <div className="row-actions">
        <button className="btn" onClick={() => setPicked((p) => !p)}>
          {picked ? 'Reset' : `Give ${plots} of them a plot`}
        </button>
        <span className="muted">
          {picked ? `${plots} tested this season. The other ${n - plots} are dropped, and we never learn if one was a star.` : `${n} brand-new lines, room to test ${plots}.`}
        </span>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- 2. the pipeline */

const STEPS = [
  { t: 'Two pools', d: 'The company keeps separate gene pools that are never mixed when making new lines. US corn has three big ones (Stiff Stalk, Non-Stiff Stalk and Iodent); this dataset uses two, C1 and C2. Every hybrid still has just two parents, one from each side, and crossing across pools is what gives hybrid corn its vigour.' },
  { t: 'Cross two parents', d: 'Two parent lines from the SAME pool (here both C1) are crossed. Crossing is cheap: done by hand in a small nursery, bagging flowers and moving pollen.' },
  { t: 'Their kids = the candidates', d: 'All the kids of that one cross form a family, here family C1.7. Each kid is made pure (inbred) and becomes a new line. These are the candidates.' },
  { t: 'Read their DNA', d: 'Every candidate is genotyped. Cheap: a few dollars each, no field needed. This is the only thing we know about a candidate before choosing.' },
  { t: 'Testcross', d: 'To judge a candidate, it is crossed with one fixed, proven line from the OTHER pool: the tester. Same tester for every candidate, so the comparison is fair.' },
  { t: 'Plant a plot, measure', d: 'The testcross seed is planted in a plot at several locations. At harvest you get yield, moisture, lodging. This is the expensive part, and plots are limited.' },
  { t: 'The result is filed under the kid', d: 'The yield of the hybrid is recorded under the candidate\'s ID. It scores the kid as a parent: "hybrids made with C1.7.3 yield 184".' },
]

type Node = { x: number; y: number; label: string; steps: number[]; kind?: 'parent' | 'kid' | 'tester' | 'seed' | 'plot' }

const NODES: Node[] = [
  { x: 110, y: 70, label: 'Parent A', steps: [1, 2], kind: 'parent' },
  { x: 110, y: 150, label: 'Parent B', steps: [1, 2], kind: 'parent' },
  { x: 290, y: 40, label: 'C1.7.1', steps: [2, 3], kind: 'kid' },
  { x: 290, y: 90, label: 'C1.7.2', steps: [2, 3], kind: 'kid' },
  { x: 290, y: 140, label: 'C1.7.3', steps: [2, 3, 4, 5, 6], kind: 'kid' },
  { x: 290, y: 190, label: 'C1.7.4', steps: [2, 3], kind: 'kid' },
  { x: 475, y: 262, label: 'Tester (C2)', steps: [0, 4], kind: 'tester' },
  { x: 470, y: 140, label: 'hybrid seed', steps: [4, 5], kind: 'seed' },
  { x: 650, y: 140, label: 'field plot', steps: [5, 6], kind: 'plot' },
]

export function Pipeline() {
  const [step, setStep] = useState(0)
  const on = (n: Node) => n.steps.includes(step)
  const lit = (steps: number[]) => (steps.includes(step) ? 1 : 0.18)
  return (
    <div>
      <div className="steps">
        {STEPS.map((s, i) => (
          <button key={s.t} className={'step' + (i === step ? ' active' : '')} onClick={() => setStep(i)}>
            <b>{i + 1}</b> {s.t}
          </button>
        ))}
      </div>
      <svg className="chart" viewBox="0 0 760 320" role="img" aria-label="Breeding pipeline diagram">
        {/* pools */}
        <g opacity={lit([0, 1, 2])}>
          <rect x={30} y={15} width={340} height={210} rx={14} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeDasharray="6 4" />
          <text x={42} y={36} fontSize={13} fill="var(--series-1)" fontWeight={600}>Pool C1</text>
        </g>
        <g opacity={lit([0, 4])}>
          <rect x={395} y={222} width={160} height={92} rx={12} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeDasharray="6 4" />
          <text x={405} y={240} fontSize={12} fill="var(--series-2)" fontWeight={600}>Pool C2</text>
        </g>
        {/* edges */}
        <g stroke="var(--text-3)" strokeWidth={1.5} fill="none">
          <g opacity={lit([1, 2])}>
            {[40, 90, 140, 190].map((y) => (
              <path key={y} d={`M150,110 C210,110 220,${y} 250,${y}`} />
            ))}
          </g>
          <path d="M330,140 L430,140" opacity={lit([4])} />
          <path d="M475,246 L475,160" opacity={lit([4])} />
          <path d="M510,140 L610,140" opacity={lit([5])} markerEnd="url(#arr)" />
          <path d="M650,165 C650,230 330,260 300,165" opacity={lit([6])} strokeDasharray="4 4" markerEnd="url(#arr)" />
        </g>
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--text-3)" />
          </marker>
        </defs>
        <text x={190} y={115} fontSize={20} fill="var(--text-2)" opacity={lit([1])}>×</text>
        <text x={370} y={134} fontSize={20} fill="var(--text-2)" opacity={lit([4])}>×</text>
        {/* nodes */}
        {NODES.map((n) => (
          <g key={n.label} opacity={on(n) ? 1 : 0.18}>
            {n.kind === 'plot' ? (
              <g>
                <rect x={n.x - 40} y={n.y - 24} width={80} height={48} rx={6} fill="var(--good)" opacity={0.18} />
                {[-16, -6, 4, 14].map((dy) => (
                  <line key={dy} x1={n.x - 32} x2={n.x + 32} y1={n.y + dy} y2={n.y + dy} stroke="var(--good)" strokeWidth={2} />
                ))}
              </g>
            ) : n.kind === 'seed' ? (
              <ellipse cx={n.x + 5} cy={n.y} rx={20} ry={13} fill="var(--warn)" />
            ) : (
              <circle cx={n.x} cy={n.y} r={n.kind === 'parent' ? 20 : 15}
                fill={n.kind === 'tester' ? 'var(--series-2)' : 'var(--series-1)'}
                stroke={n.label === 'C1.7.3' && step >= 3 ? 'var(--text)' : 'var(--surface)'} strokeWidth={n.label === 'C1.7.3' && step >= 3 ? 3 : 2} />
            )}
            <text x={n.x + (n.kind === 'kid' ? 22 : 0)} y={n.kind === 'kid' ? n.y + 4 : n.y + (n.kind === 'plot' ? 42 : 36)}
              fontSize={12} fill="var(--text-2)" textAnchor={n.kind === 'kid' ? 'start' : 'middle'}>{n.label}</text>
          </g>
        ))}
        {step === 3 && <text x={360} y={105} fontSize={12} fill="var(--text)">DNA read: M1..M6 →</text>}
        {step === 6 && <text x={560} y={196} fontSize={13} fill="var(--text)" textAnchor="middle" fontWeight={600}>184 bu/ac → filed under C1.7.3</text>}
      </svg>
      <p className="explain"><b>Step {step + 1}. {STEPS[step].t}.</b> {STEPS[step].d}</p>
      <div className="row-actions">
        <button className="btn ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>← back</button>
        <button className="btn" disabled={step === STEPS.length - 1} onClick={() => setStep((s) => s + 1)}>next →</button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- 3. the ID */

export function IdDecoder() {
  const [id, setId] = useState('C1.7.3')
  const m = id.trim().match(/^C(\d+)\.(\d+)\.(\d+)$/i)
  return (
    <div>
      <label className="field">
        Type an ID <input value={id} onChange={(e) => setId(e.target.value)} spellCheck={false} />
      </label>
      {m ? (
        <div className="decode">
          <div><span className="chip c1">C{m[1]}</span><p>Pool (cluster) {m[1]}. One of the two gene pools. Kids belong to their parents' pool.</p></div>
          <div><span className="chip c2">{m[2]}</span><p>Family {m[2]}: every kid of one specific cross, parent A × parent B, both from pool C{m[1]}.</p></div>
          <div><span className="chip c3">{m[3]}</span><p>Kid number {m[3]} of that family. Its brothers and sisters are C{m[1]}.{m[2]}.1, C{m[1]}.{m[2]}.2, …</p></div>
        </div>
      ) : (
        <p className="muted">Use the pattern C&lt;pool&gt;.&lt;family&gt;.&lt;kid&gt;, like C1.7.3</p>
      )}
      <p className="explain">
        Siblings share a family number. That matters later: siblings have nearly the same DNA, which is exactly what makes
        a careless test look better than it is.
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------- 4. reads -> numbers */

const PLANTS = [
  { name: 'Plant 1', reads: 'TTTTTTTT', geno: 'TT' },
  { name: 'Plant 2', reads: 'TATTAATA', geno: 'TA' },
  { name: 'Plant 3', reads: 'AAAAAAAA', geno: 'AA' },
]

export function ReadsToNumbers() {
  const [stage, setStage] = useState(0)
  const m = MARKERS[0]
  const stages = ['Reads', 'Genotype', 'Count the A\'s', 'Shift by one']
  return (
    <div>
      <div className="steps">
        {stages.map((s, i) => (
          <button key={s} className={'step' + (i === stage ? ' active' : '')} onClick={() => setStage(i)}>
            <b>{i + 1}</b> {s}
          </button>
        ))}
      </div>
      <p className="muted small">One position in the genome: marker <b>{m.id}</b>, at {m.where}. Across all lines only two letters ever show up here: <b>{m.v1}</b> and <b>{m.v2}</b>.</p>
      <div className="plants">
        {PLANTS.map((p) => {
          const a = p.geno.split('').filter((c) => c === 'A').length
          return (
            <div key={p.name} className="plant">
              <div className="pname">{p.name}</div>
              <div className="reads">
                {p.reads.split('').map((c, i) => (
                  <span key={i} className={'read ' + (c === 'A' ? 'v2' : 'v1')}>{c}</span>
                ))}
              </div>
              {stage >= 1 && <div className="arrow">↓ {p.geno === 'TA' ? 'half T, half A' : `all ${p.geno[0]}`}</div>}
              {stage >= 1 && <div className="big">{p.geno}</div>}
              {stage >= 2 && <div className="arrow">↓ copies of A</div>}
              {stage >= 2 && <div className="big">{a}</div>}
              {stage >= 3 && <div className="arrow">↓ minus 1</div>}
              {stage >= 3 && <div className={'big code ' + (a === 0 ? 'v1' : a === 2 ? 'v2' : 'mid')}>{a - 1 > 0 ? '+1' : a - 1}</div>}
            </div>
          )
        })}
      </div>
      <p className="explain">
        {[
          'The sequencer reads many short pieces of DNA that cover this spot. Each little box is one read, showing which letter it saw.',
          'A plant has two copies of every chromosome, one from each parent. All reads T means both copies are T. Half and half means one of each. "AT" and "TA" are the same thing: nobody knows or needs to know which copy is which.',
          'Your counting table: at this spot only T and A exist, so counting one letter says everything. 0 A\'s = TT, 1 = TA, 2 = AA.',
          'Subtract one and you have the numbers in the data file: −1, 0, +1. A 0 is a spot that hasn\'t settled yet: lines are often tested before they\'re fully settled. That\'s all they are. Every line with TT here gets −1, in every row of the table, so the letter is never lost, just renamed.',
        ][stage]}
      </p>
    </div>
  )
}

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

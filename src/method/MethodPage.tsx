import { useEffect, useMemo, useState, type ReactNode } from 'react'
import ThemeToggle from '../components/ThemeToggle'
import Validation from '../components/Validation'
import { loadJson } from '../lib/data'
import type { Recommendations } from '../lib/types'

const f2 = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? 'n/a' : x.toFixed(2))

function corr(a: number[], b: number[]): number {
  const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n
  let sab = 0, saa = 0, sbb = 0
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y }
  return sab / Math.sqrt(saa * sbb)
}

/** Lines in ten groups by what the engine predicted; each bar is what the group really yielded. */
function Deciles({ data }: { data: Recommendations }) {
  const [engine, setEngine] = useState<'family' | 'gblup'>('family')
  const { groups, r } = useMemo(() => {
    const rows = data.candidates.filter((c) => c.actual_yield != null && (engine === 'family' || c.gy != null))
    const pred = rows.map((c) => (engine === 'family' ? c.pred_yield : c.gy!))
    const act = rows.map((c) => c.actual_yield!)
    const order = pred.map((_, i) => i).sort((a, b) => pred[b] - pred[a])
    const mean = act.reduce((s, v) => s + v, 0) / act.length
    const groups = Array.from({ length: 10 }, (_, g) => {
      const idx = order.slice(Math.floor((g * order.length) / 10), Math.floor(((g + 1) * order.length) / 10))
      return idx.reduce((s, i) => s + act[i], 0) / idx.length - mean
    })
    return { groups, r: corr(pred, act) }
  }, [data, engine])
  const W = 640, H = 230, pad = 28
  const max = Math.max(1, ...groups.map(Math.abs))
  const y0 = (H - 18) / 2          // the bottom 18px hold the group labels
  const bw = (W - pad * 2) / 10
  return (
    <div>
      <div className="toggle" style={{ marginBottom: 8 }}>
        <button className={engine === 'family' ? 'on' : ''} onClick={() => setEngine('family')}>2-Step</button>
        <button className={engine === 'gblup' ? 'on' : ''} onClick={() => setEngine('gblup')}>Standard</button>
      </div>
      <div className="chartbox">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Real yield of each tenth of the lines, ordered by prediction">
          <line x1={pad} x2={W - pad} y1={y0} y2={y0} stroke="var(--border)" />
          {groups.map((g, i) => {
            const h = (Math.abs(g) / max) * (y0 - 18)
            return (
              <g key={i}>
                <rect x={pad + i * bw + 6} width={bw - 12} y={g >= 0 ? y0 - h : y0} height={h}
                  fill={g >= 0 ? 'var(--good)' : 'var(--text-3)'} opacity={g >= 0 ? 0.85 : 0.5} rx={3} />
                <text x={pad + i * bw + bw / 2} y={g >= 0 ? y0 - h - 4 : y0 + h + 12} textAnchor="middle" fontSize={10}
                  fill="var(--text-2)">{g >= 0 ? '+' : ''}{g.toFixed(1)}</text>
                <text x={pad + i * bw + bw / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="var(--text-3)">
                  {i === 0 ? 'top 10%' : i === 9 ? 'bottom' : `${(i + 1) * 10}%`}</text>
              </g>
            )
          })}
        </svg>
      </div>
      <p className="small muted" style={{ margin: '4px 0 0' }}>
        {data.meta.held_out_year} lines ordered by the {engine === 'family' ? '2-Step' : 'Standard'} prediction and cut into
        ten groups; each bar is the group's real yield against the average line, bu/ac. A staircase going down means the
        ranking works. Accuracy here: <b>r = {f2(r)}</b>.
      </p>
    </div>
  )
}

interface Step { id: string; title: string; why: string; body: ReactNode }

export default function MethodPage() {
  const [data, setData] = useState<Recommendations | null>(null)
  useEffect(() => { loadJson<Recommendations>('recommendations.json').then(setData).catch(() => setData(null)) }, [])
  const v = data?.validation
  const year = data?.meta.held_out_year ?? null
  const eng = (id: string) => v?.engines?.find((e) => e.id === id)
  const fam = eng('family'), std = eng('gblup')
  const nFam = useMemo(() => (data ? new Set(data.candidates.map((c) => c.family)).size : 0), [data])

  const steps: Step[] = data && v ? [
    {
      id: 'values', title: 'One number per line, per trait',
      why: 'The model learns from clean, fair numbers, not from raw plots.',
      body: (
        <p className="explain" style={{ marginTop: 0 }}>
          After cleaning, every line's plots become one value for each of four traits: <b>yield</b>, <b>harvest
          moisture</b>, <b>maturity</b> and <b>lodging</b>. Each plot counts against its own field, and the tester's effect is
          taken out, so a line is credited only for itself. These values are what the engines learn from, and what they are
          graded against. (<a href="/cleaning/">The cleaning steps</a>.)
        </p>
      ),
    },
    {
      id: 'engines', title: 'Two engines, chosen by the shape of the data',
      why: 'Lines that come in families carry extra information; lines that don\'t, don\'t.',
      body: (
        <>
          <div className="three" style={{ marginTop: 4 }}>
            <div className="lanes" style={{ marginTop: 0 }}>
              <b>2-Step</b> <span className="small muted">for lines that come in families</span>
              <p className="small" style={{ margin: '6px 0 0' }}>
                <b>Step 1</b>: rate each cross from its two parents' DNA (the family's level).<br />
                <b>Step 2</b>: rate each line against its brothers and sisters, from the DNA it inherited.<br />
                The two add up to one score per line.
              </p>
            </div>
            <div className="lanes" style={{ marginTop: 0 }}>
              <b>Standard</b> <span className="small muted">for lines that don't</span>
              <p className="small" style={{ margin: '6px 0 0' }}>
                GBLUP, the usual method: one model over every line tested before, from its DNA. No family needed.
              </p>
            </div>
          </div>
          <p className="explain">
            ProMaize looks at how the lines are organized and recommends the engine. Bayer's {year} lines come in{' '}
            <b>{nFam}</b> families, so the recommendation is 2-Step. Both engines predict the same four traits from DNA,
            and both learn only from earlier seasons.
          </p>
        </>
      ),
    },
    {
      id: 'test', title: 'Tested the honest way',
      why: 'A model is only as good as its record on seasons it never saw.',
      body: (
        <p className="explain" style={{ marginTop: 0 }}>
          Every season from {v.by_year?.[0]?.year} to {year} was predicted using only the seasons before it, and its families had
          never been seen. The settings were chosen on {v.tuned_on?.join(', ')} only; {year}, the decision year, was held out
          to the end. The tempting shortcut, letting brothers and sisters of the test lines into training, reads{' '}
          r = {f2(v.leaky_r)}; it is not real, and we show it only so nobody mistakes one for the other.
        </p>
      ),
    },
    {
      id: 'accuracy', title: 'How we measure accuracy',
      why: 'Put every prediction next to what really happened, and see if the order holds.',
      body: (
        <>
          <p className="explain" style={{ marginTop: 0 }}>
            For each line we put what we predicted in January next to what it really did in the field. <b>r</b> measures
            how well the two orders line up: <b>1</b> is a perfect ranking, <b>0</b> is no better than drawing names from a
            hat. Averaged over {v.seasons ?? v.by_year?.length} seasons: <b>2-Step {f2(fam?.r_mean)}</b>, Standard {f2(std?.r_mean)}.
            In {year}: <b>2-Step {f2(fam?.r_last)}</b>, Standard {f2(std?.r_last)}.
          </p>
          <div style={{ marginTop: 12 }}><Deciles data={data} /></div>
          <p className="explain">
            <b>Why the best possible score is about {f2(v.ceiling)}, not 1.</b> The field result is itself noisy: two plots of
            the same line differ by about 16 bushels from luck alone (soil patches, storms, weighing), while real differences
            between lines are about 7. So even a model that knew every line's true value would match the field only up to
            about {f2(v.ceiling)}: the square root of how repeatable the field averages are (0.46 here). This bound is standard
            in quantitative genetics; it says what "good" means for this data.
          </p>
        </>
      ),
    },
    {
      id: 'ranges', title: 'Ranges you can trust',
      why: 'A prediction is only useful if you know how wrong it can be.',
      body: (
        <p className="explain" style={{ marginTop: 0 }}>
          Every predicted yield comes with a 90% range, built from how wrong the model was on earlier seasons. In {year},{' '}
          <b>{Math.round((v.coverage90 ?? 0) * 100)}%</b> of the real results landed inside their ranges: the ranges mean what
          they say.
        </p>
      ),
    },
  ] : []

  return (
    <div className="learn">
      <header className="lhead">
        <div>
          <h1>How we analyzed the data <span className="version" title={`ProMaize v${__VERSION__}, built ${__BUILD__} UTC`}>v{__VERSION__}</span></h1>
          <p className="sub">What happens after cleaning, step by step, with the real numbers. The demo shows the decision; this
            page shows how we got there.</p>
        </div>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <a className="pill" href="/">Back to the demo</a>
          <a className="pill" href="/cleaning/">How we cleaned the data</a>
          <ThemeToggle />
        </span>
      </header>

      {!data || !v ? <p className="muted">Loading…</p> : (
        <div className="lgrid">
          <nav className="toc">
            <div className="small muted">Steps</div>
            <ol>
              {steps.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}
              <li><a href="#numbers">All the numbers</a></li>
            </ol>
          </nav>
          <div className="lbody">
            {steps.map((s, i) => (
              <section key={s.id} id={s.id} className="panel lsec">
                <div className="num">{i + 1}</div>
                <h2>{s.title}</h2>
                <p className="oneline">{s.why}</p>
                {s.body}
              </section>
            ))}
            <section id="numbers" className="lsec">
              <Validation v={v} baselines={data.baselines} notes={data.meta.notes} heldOut={year} />
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

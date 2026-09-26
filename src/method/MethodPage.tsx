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

/** The exam format: to grade a season, learn only from the seasons before it. */
function WalkForward({ years, tests }: { years: number[]; tests: number[] }) {
  const cw = 52, rh = 26, left = 96, top = 22
  const W = left + years.length * cw + 8, H = top + tests.length * rh + 6
  return (
    <div className="chartbox">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Each season is predicted from the seasons before it only">
        {years.map((y, j) => (
          <text key={y} x={left + j * cw + cw / 2} y={14} textAnchor="middle" fontSize={11} fill="var(--text-3)">{y}</text>
        ))}
        {tests.map((t, i) => (
          <g key={t}>
            <text x={left - 8} y={top + i * rh + 17} textAnchor="end" fontSize={11} fill="var(--text-2)">grading {t}</text>
            {years.map((y, j) => {
              const kind = y < t ? 'learn' : y === t ? 'test' : 'future'
              return (
                <rect key={y} x={left + j * cw + 3} y={top + i * rh + 4} width={cw - 6} height={rh - 8} rx={4}
                  fill={kind === 'learn' ? 'var(--accent)' : kind === 'test' ? 'var(--good)' : 'none'}
                  opacity={kind === 'learn' ? 0.35 : 1} stroke={kind === 'future' ? 'var(--border)' : 'none'} />
              )
            })}
          </g>
        ))}
      </svg>
      <div className="legend">
        <span><i style={{ background: 'var(--accent)', opacity: 0.35, height: 10, width: 14, borderRadius: 3 }} />learns from</span>
        <span><i style={{ background: 'var(--good)', height: 10, width: 14, borderRadius: 3 }} />predicts, then checks against the field</span>
        <span><i style={{ border: '1px solid var(--border)', height: 10, width: 14, borderRadius: 3 }} />not used</span>
      </div>
    </div>
  )
}

/** Where the scores sit between chance and perfect, with the part field noise puts out of reach. */
function Ruler({ standard, ours, ceiling }: { standard: number; ours: number; ceiling: number }) {
  const W = 640, H = 92, l = 20, r = 20
  const x = (v: number) => l + v * (W - l - r)
  const mark = (v: number, label: string, color: string, up: boolean) => (
    <g>
      <line x1={x(v)} x2={x(v)} y1={34} y2={58} stroke={color} strokeWidth={3} />
      <text x={x(v)} y={up ? 26 : 76} textAnchor="middle" fontSize={11} fill={color} fontWeight={600}>{label}</text>
    </g>
  )
  return (
    <div className="chartbox">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Accuracy scale from 0 to 1">
        <rect x={x(0)} y={40} width={x(1) - x(0)} height={12} rx={6} fill="var(--grid)" />
        <rect x={x(ceiling)} y={40} width={x(1) - x(ceiling)} height={12} rx={6} fill="var(--text-3)" opacity={0.35} />
        <text x={x((ceiling + 1) / 2)} y={76} textAnchor="middle" fontSize={11} fill="var(--text-3)">out of reach: field noise</text>
        <text x={x(0)} y={26} textAnchor="start" fontSize={11} fill="var(--text-3)">0 · chance</text>
        <text x={x(1)} y={26} textAnchor="end" fontSize={11} fill="var(--text-3)">1 · perfect</text>
        {mark(standard, `Standard ${standard.toFixed(2)}`, 'var(--text-2)', false)}
        {mark(ours, `2-Step ${ours.toFixed(2)}`, 'var(--accent)', true)}
        {mark(ceiling, `best possible ${ceiling.toFixed(2)}`, 'var(--text-3)', true)}
      </svg>
    </div>
  )
}

/** Six separate exams, the two engines side by side. */
function Seasons({ rows }: { rows: { year: number; ours: number; std: number }[] }) {
  const max = Math.max(...rows.flatMap((r) => [r.ours, r.std]), 0.01)
  const W = 640, H = 150, pad = 24
  const gw = (W - pad * 2) / rows.length
  const h = (v: number) => (Math.max(0, v) / max) * (H - 50)
  return (
    <div className="chartbox">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Accuracy per season, 2-Step and Standard">
        {rows.map((r, i) => {
          const x0 = pad + i * gw
          return (
            <g key={r.year}>
              <rect x={x0 + gw / 2 - 24} y={H - 26 - h(r.ours)} width={22} height={h(r.ours)} rx={3} fill="var(--accent)" />
              <rect x={x0 + gw / 2 + 2} y={H - 26 - h(r.std)} width={22} height={h(r.std)} rx={3} fill="var(--text-3)" opacity={0.6} />
              <text x={x0 + gw / 2 - 13} y={H - 30 - h(r.ours)} textAnchor="middle" fontSize={10} fill="var(--text-2)">{r.ours.toFixed(2)}</text>
              <text x={x0 + gw / 2 + 13} y={H - 30 - h(r.std)} textAnchor="middle" fontSize={10} fill="var(--text-3)">{r.std.toFixed(2)}</text>
              <text x={x0 + gw / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--text-2)">{r.year}</text>
            </g>
          )
        })}
      </svg>
      <div className="legend">
        <span><i style={{ background: 'var(--accent)', height: 10, width: 14, borderRadius: 3 }} />2-Step</span>
        <span><i style={{ background: 'var(--text-3)', opacity: 0.6, height: 10, width: 14, borderRadius: 3 }} />Standard</span>
      </div>
    </div>
  )
}

/** 100 real results: how many landed inside their predicted range. */
function Hundred({ inside }: { inside: number }) {
  const n = Math.round(inside * 100)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(20, 12px)', gap: 4, margin: '6px 0 0' }} aria-label={`${n} of 100 inside`}>
      {Array.from({ length: 100 }, (_, i) => (
        <span key={i} style={{ width: 12, height: 12, borderRadius: 99, background: i < n ? 'var(--good)' : 'var(--text-3)', opacity: i < n ? 0.85 : 0.35 }} />
      ))}
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
      id: 'test', title: 'How we test it: every season is a real January',
      why: 'An exam the model has never seen, six times over.',
      body: (
        <>
          <WalkForward years={Array.from({ length: (year ?? 2008) - 1999 }, (_, k) => 2000 + k)}
            tests={(v.by_year ?? []).map((b) => b.year)} />
          <p className="explain">
            To grade a season, the engine learns only from the seasons before it, predicts that season's lines (from
            families it has never seen), and only then do we open the field results. Every setting was chosen on earlier
            seasons; {year}, the decision year, is the final exam. We never let brothers and sisters of the test lines into
            training: it would score far better ({f2(v.leaky_r)}) and mean nothing.
          </p>
        </>
      ),
    },
    {
      id: 'accuracy', title: 'How we measure accuracy',
      why: 'Put every prediction next to what really happened, and see if the order holds.',
      body: (
        <>
          <p className="explain" style={{ marginTop: 0 }}>
            For each line we set its prediction next to its real result. <b>r</b> says how well the two orders line up:
            0 is a coin toss, 1 is a perfect ranking. Here is where the engines land, averaged over the six exams:
          </p>
          <div style={{ marginTop: 10 }}>
            <Ruler standard={std?.r_mean ?? 0} ours={fam?.r_mean ?? 0} ceiling={v.ceiling ?? 0.68} />
          </div>
          <p className="explain">
            <b>Why 1 is out of reach.</b> The field result is itself noisy: two plots of the same line differ by about 16
            bushels from luck alone (a wet patch, a storm), while real differences between lines are about 7. Even a model
            that knew every line's true value would score only about {f2(v.ceiling)} against this field. That is the real
            yardstick: 2-Step gets a third of the way there, Standard a fifth.
          </p>
          <p className="explain"><b>What that looks like in {year}.</b> Lines cut into ten groups by prediction; each bar is
            what the group really yielded, against the average line:</p>
          <div style={{ marginTop: 8 }}><Deciles data={data} /></div>
          <p className="explain"><b>Six exams, one by one.</b> 2-Step is ahead in every one (barely in 2003); in 2007 and
            2008 it is two to three times as accurate:</p>
          <div style={{ marginTop: 8 }}>
            <Seasons rows={(v.by_year ?? []).map((b) => ({ year: b.year, ours: b.r, std: b.r_gblup }))} />
          </div>
        </>
      ),
    },
    {
      id: 'ranges', title: 'Ranges you can trust',
      why: 'A prediction is only useful if you know how far off it can be.',
      body: (
        <>
          <p className="explain" style={{ marginTop: 0 }}>
            Every predicted yield comes with a 90% range, built from how far off the model was in earlier seasons. Out of
            every 100 real {year} results, this many landed inside their range:
          </p>
          <Hundred inside={v.coverage90 ?? 0} />
          <p className="explain"><b>{Math.round((v.coverage90 ?? 0) * 100)} of 100</b>: the ranges mean what they say.</p>
        </>
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

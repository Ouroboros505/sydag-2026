import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Prices } from '../lib/econ'
import type { EngineId, EngineInfo } from '../lib/types'
import Info from './Info'
import DataCheck from './DataCheck'

interface Props {
  n: number
  budget: number
  cap: number
  even: boolean
  maxFamily: number
  prices: Prices
  onBudget: (k: number) => void
  onCap: (c: number) => void
  onPrices: (p: Prices) => void
  onEven: (e: boolean) => void
  engines?: EngineInfo[]
  engine: EngineId
  onEngine: (e: EngineId) => void
  heldOut: number | null
  seasons?: number
  dataset?: string
  shape?: DataShape
  real?: Partial<Record<EngineId, number | undefined>>   // what each engine's picks really earned in past seasons, $/acre
  ceiling?: number                          // the best accuracy the field's own noise allows
  plotsPerLine?: number
}

/** How the loaded lines are organized: the fact that decides which engine fits. */
export interface DataShape { lines: number; families: number; inFamilies: number; perFamily: number }
export const hasFamilies = (s: DataShape) => s.families >= 3 && s.inFamilies / s.lines >= 0.5

const SHORT: Record<EngineId, string> = { family: '2-Step', gblup: 'Standard', environment: 'Environment' }
// what each engine runs on, for the hover
const FOR: Record<EngineId, string> = { family: 'for data with families', gblup: 'for data without families', environment: '' }
const HOW: Record<EngineId, string> = {
  family: "Step 1 rates each cross from its parents' DNA; step 2 ranks the lines inside each family.",
  gblup: 'One model over every line, no family needed: the usual method (GBLUP).',
  environment: '',
}

/** a tiny bar under a number in the engine card, so the difference reads at a glance */
function Bar({ v, max, on }: { v: number; max: number; on: boolean }) {
  return <span className="minibar"><i style={{ width: `${Math.max(0, Math.min(1, v / (max || 1))) * 100}%`, opacity: on ? 1 : 0.45 }} /></span>
}

export default function Controls({ n, budget, cap, even, maxFamily, prices, onBudget, onCap, onPrices, onEven, engines, engine, onEngine, heldOut, dataset, shape, real, plotsPerLine, ceiling }: Props) {
  const set = (key: keyof Prices) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onPrices({ ...prices, [key]: Number(e.target.value) })
  const capTop = Math.min(maxFamily, 80)
  const capValue = Number.isFinite(cap) ? cap : capTop + 1

  const cur = engines?.find((e) => e.id === engine)
  const [peek, setPeek] = useState<EngineId | null>(null)
  // where the hovered button sits on screen: the card is drawn at the top of the page, above every
  // other element (native sliders can paint over anything nested in the panel)
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)
  const show = (id: EngineId, el: HTMLElement) => {
    const r = el.parentElement!.getBoundingClientRect()
    setAt({ left: r.left, top: r.bottom + 6 }); setPeek(id)
  }
  const [fit, setFit] = useState(false)
  const best: EngineId = shape && hasFamilies(shape) ? 'family' : 'gblup'

  return (
    <div className="panel">
      <h2>Your data<Info>
        The Bayer maize trials, 2000 to {heldOut ?? 'now'}, cleaned in seven steps before any model saw them. Drop a new
        season's field-results file and ProMaize cleans it the same way, in your browser; nothing is uploaded.
      </Info></h2>
      <div className="control">
        <div className="small" style={{ marginBottom: 8 }}>
          <b>{dataset ?? `Bayer maize trials, 2000 to ${heldOut ?? 'now'}`}</b>: {n.toLocaleString('en-US')} new lines to rank.{' '}
          <a href="/cleaning/">How it was cleaned →</a>
        </div>
        <DataCheck compact />
      </div>

      {engines && engines.length > 1 && cur && (
        <>
          <h2 style={{ marginTop: 20 }}>Prediction engine<Info wide>
            Every engine predicts the same things for each new line, from its DNA: yield, grain moisture and lodging.
            They differ in how they learn from earlier seasons.<br /><br />
            <b>2-Step</b>, ProMaize's own engine: first predicts each family's average from its two parents' DNA, then ranks the
            brothers and sisters inside the family.<br />
            <b>Standard</b>: GBLUP, the method most breeding programs use; one model over all earlier lines.<br /><br />
            <b>Accuracy</b> is how well the predicted ranking matched the real one, in seasons the engine never saw:
            1 is perfect, 0 is no better than chance. Switch engines and every panel on the page updates, including
            what {heldOut ?? 'the field'} actually said.
          </Info></h2>
          <div className="control" style={{ position: 'relative' }}>
            <div className="toggle">
              {engines.map((e) => (
                <button key={e.id} className={e.id === engine ? 'on' : ''} onClick={() => onEngine(e.id)}
                  onMouseEnter={(ev) => show(e.id, ev.currentTarget)} onMouseLeave={() => setPeek(null)}
                  onFocus={(ev) => show(e.id, ev.currentTarget)} onBlur={() => setPeek(null)}>{SHORT[e.id]}</button>
              ))}
            </div>
            {peek && at && createPortal(
              <div className="enginecard" role="tooltip" style={{ left: at.left, top: at.top }}>
                <div><b>{SHORT[peek]}</b> <span className="muted">{FOR[peek]}</span></div>
                <div style={{ margin: '4px 0 8px' }}>{HOW[peek]}</div>
                <table className="mini">
                  <thead><tr><th /> {engines.map((e) => <th key={e.id} className={e.id === peek ? 'hi' : ''}>{SHORT[e.id]}</th>)}</tr></thead>
                  <tbody>
                    <tr><td>accuracy, past seasons{ceiling ? <span className="muted"> (best possible here: {ceiling.toFixed(2)})</span> : null}</td>
                      {engines.map((e) => <td key={e.id} className={e.id === peek ? 'hi' : ''}>{e.r_mean.toFixed(2)}
                        <Bar v={e.r_mean} max={Math.max(...engines.map((x) => x.r_mean))} on={e.id === peek} /></td>)}</tr>
                    {real && (
                      <tr><td>value of its picks, past seasons <span className="muted">($/acre above an average line)</span></td>
                        {engines.map((e) => <td key={e.id} className={e.id === peek ? 'hi' : ''}>
                          {real[e.id] != null ? `+$${real[e.id]!.toFixed(0)}` : ''}
                          <Bar v={real[e.id] ?? 0} max={Math.max(...engines.map((x) => real[x.id] ?? 0))} on={e.id === peek} /></td>)}</tr>
                    )}
                  </tbody>
                </table>
              </div>, document.body,
            )}
            {shape && (
              <div style={{ marginTop: 8 }}>
                <button className="link small" onClick={() => setFit((f) => !f)}>Which engine fits my data?</button>
                {fit && (
                  <div className="small fitnote">
                    {best === 'family'
                      ? <>Your lines come in families: <b>{shape.families.toLocaleString('en-US')}</b> families of about{' '}
                        {shape.perFamily} lines. ProMaize recommends <b>2-Step</b>.</>
                      : <>Your lines don't come in families. ProMaize recommends <b>Standard</b>.</>}
                    {engine !== best && engines.some((e) => e.id === best) && (
                      <> <button className="link" onClick={() => onEngine(best)}>Use {SHORT[best]}</button></>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <h2 style={engines && engines.length > 1 ? { marginTop: 20 } : undefined}>Your plots<Info>
        <b>Available plots to test</b>: how many of the new lines get tested this season. Each one gets a plot at
        each of its test sites, about five per line.<br />
        <b>How plots are spread</b>: aggressive gives them to the best-predicted lines, wherever they come from;
        conservative gives every family the same share.<br />
        <b>Most lines from one family</b>: a cap, so a few families can't take all the plots.
      </Info></h2>

      <div className="control">
        <label>
          Available plots to test <b>{budget.toLocaleString('en-US')} of {n.toLocaleString('en-US')} lines</b>
        </label>
        <input type="range" min={10} max={n} step={10} value={budget} onChange={(e) => onBudget(Number(e.target.value))} />
        {plotsPerLine && (
          <div className="hint">about {(Math.round((budget * plotsPerLine) / 100) * 100).toLocaleString('en-US')} plots, {plotsPerLine.toFixed(1)} per line</div>
        )}
      </div>

      <div className="control">
        <label>How plots are spread</label>
        <div className="toggle" style={{ marginTop: 4 }}>
          <button className={!even ? 'on' : ''} onClick={() => onEven(false)}>aggressive: rank all</button>
          <button className={even ? 'on' : ''} onClick={() => onEven(true)}>conservative: same share</button>
        </div>
        <div className="hint">
          Aggressive bets the plots on the best-predicted families. Conservative gives every family its fair share and
          lets markers pick the siblings: nearly free in 2008, when the family call was weak.
        </div>
      </div>

      <div className="control" style={even ? { opacity: 0.45 } : undefined}>
        <label>
          Most lines from one family <b>{even ? 'n/a' : Number.isFinite(cap) ? cap : 'no limit'}</b>
        </label>
        <input
          type="range" min={1} max={capTop + 1} step={1} value={capValue}
          onChange={(e) => { const v = Number(e.target.value); onCap(v > capTop ? Infinity : v) }}
        />
        <div className="hint">Keeps the advanced set genetically broad. The tiles show what it costs.</div>
      </div>

      <h2 style={{ marginTop: 20 }}>Your economics<Info>
        The prices that turn predicted bushels into dollars per acre:<br />
        <b>$/acre = yield × corn price − drying cost − lodging loss</b><br /><br />
        Drying cost = points of moisture above the target × cost per point × yield.<br />
        Lodging loss = share of plants fallen × share of their yield lost × yield × price.
      </Info></h2>

      <div className="control">
        <label>Corn price <b>${prices.corn_price.toFixed(2)} / bu</b></label>
        <input type="range" min={3} max={7} step={0.05} value={prices.corn_price} onChange={set('corn_price')} />
      </div>

      <div className="control">
        <label>Drying cost <b>${prices.drying_cost_per_point.toFixed(3)} / bu / pt</b></label>
        <input type="range" min={0} max={0.1} step={0.005} value={prices.drying_cost_per_point} onChange={set('drying_cost_per_point')} />
        <div className="hint">Per bushel, per point of moisture removed.</div>
      </div>

      <div className="control">
        <label>Target moisture <b>{prices.target_moisture.toFixed(1)}%</b></label>
        <input type="range" min={13} max={18} step={0.5} value={prices.target_moisture} onChange={set('target_moisture')} />
      </div>

      <div className="control">
        <label>Yield lost per lodged plant <b>{Math.round(prices.lodging_loss_fraction * 100)}%</b></label>
        <input type="range" min={0} max={1} step={0.05} value={prices.lodging_loss_fraction} onChange={set('lodging_loss_fraction')} />
      </div>
    </div>
  )
}

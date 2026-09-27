import { Fragment, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Prices } from '../lib/econ'
import type { EngineId, EngineInfo } from '../lib/types'
import Info from './Info'
import DataCheck from './DataCheck'

interface Props {
  n: number
  budget: number
  prices: Prices
  onBudget: (k: number) => void
  onPrices: (p: Prices) => void
  engines?: EngineInfo[]
  engine: EngineId
  onEngine: (e: EngineId) => void
  heldOut: number | null
  seasons?: number
  dataset?: string
  shape?: DataShape
}

/** How the loaded lines are organized: the fact that decides which engine fits. */
export interface DataShape { lines: number; families: number; inFamilies: number; perFamily: number }
export const hasFamilies = (s: DataShape) => s.families >= 3 && s.inFamilies / s.lines >= 0.5

const SHORT: Record<EngineId, string> = { family: '2-Step', gblup: 'Standard', environment: 'Environment' }
// dollars as cents: 0.045 -> 4.5¢, 0.2025 -> 20¢
const fmtCents = (usd: number) => `${Number((usd * 100).toFixed(usd < 0.1 ? 1 : 0))}¢`
const fmtNum1 = (x: number) => `${Number(x.toFixed(1))}`
// what each engine runs on, for the hover
const FOR: Record<EngineId, string> = { family: 'for data with families', gblup: 'for data without families', environment: '' }
const HOW: Record<EngineId, string> = {
  family: "Rates each cross from its parents' DNA, then ranks the siblings.",
  gblup: 'One model over every line: the usual method (GBLUP).',
  environment: '',
}

/** a bar beside each engine's accuracy in the engine card, so the difference reads at a glance */
function Bar({ v, max, on }: { v: number; max: number; on: boolean }) {
  return <span className="minibar"><i style={{ width: `${Math.max(0, Math.min(1, v / (max || 1))) * 100}%`, opacity: on ? 1 : 0.45 }} /></span>
}

export default function Controls({ n, budget, prices, onBudget, onPrices, engines, engine, onEngine, heldOut, dataset, shape }: Props) {
  const set = (key: keyof Prices) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onPrices({ ...prices, [key]: Number(e.target.value) })

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
                <div style={{ margin: '4px 0 10px' }}>{HOW[peek]}</div>
                <div className="muted" style={{ marginBottom: 4 }}>accuracy, past seasons</div>
                <div className="enginebars">
                  {engines.map((e) => (
                    <Fragment key={e.id}>
                      <span className={e.id === peek ? 'on' : ''}>{SHORT[e.id]}</span>
                      <Bar v={e.r_mean} max={Math.max(...engines.map((x) => x.r_mean))} on={e.id === peek} />
                      <span className={e.id === peek ? 'on' : ''}>{e.r_mean.toFixed(2)}</span>
                    </Fragment>
                  ))}
                </div>
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
        <b>Available plots to test</b>: how many of the new lines get tested this season.<br />
        Every family gets a fair share of the plots, in proportion to its size, and the engine picks the best lines
        inside each. That keeps the forecast honest in a season like {heldOut ?? 'this one'}, when many new families
        have parents with no earlier results.
      </Info></h2>

      <div className="control">
        <label style={{ display: 'block' }}>
          Available plots to test
          <b style={{ display: 'block', marginTop: 2 }}>{budget.toLocaleString('en-US')} of {n.toLocaleString('en-US')} ({Math.round((budget / Math.max(1, n)) * 100)}%) lines</b>
        </label>
        <input type="range" min={10} max={n} step={10} value={budget} onChange={(e) => onBudget(Number(e.target.value))} />
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
        <label>
          {/* a worked example that follows the knobs: 'point' is one percent of moisture */}
          <span>Drying cost<Info>
            Wet corn is dried to the target moisture before it's sold. Harvested at 20%, that's{' '}
            {fmtNum1(20 - prices.target_moisture)} points to remove: {fmtCents((20 - prices.target_moisture) * prices.drying_cost_per_point)} a bushel.
          </Info></span>
          <b>{fmtCents(prices.drying_cost_per_point)} per bushel per point</b>
        </label>
        <input type="range" min={0} max={0.1} step={0.005} value={prices.drying_cost_per_point} onChange={set('drying_cost_per_point')} />
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

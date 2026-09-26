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
}

const SHORT: Record<EngineId, string> = { family: '2-Step', gblup: 'Standard', environment: 'Environment' }
// what each engine runs on, for the hover
const BEHIND: Record<EngineId, string> = {
  family: "2-Step, ProMaize's own engine. Step 1 rates each cross from its parents' DNA; step 2 ranks each line against its brothers and sisters (two GBLUP-type marker models)",
  gblup: 'The standard method in plant breeding: GBLUP, one marker model over every line tested before, no family step',
  environment: '2-Step plus weather and soil',
}
// when each engine is the right tool, in the breeder's terms
const WHEN: Record<EngineId, string> = {
  family: "ProMaize's own engine, built for seasons full of new families: it rates each cross by what its parents passed on, then ranks the lines inside it against each other.",
  gblup: "The standard method in plant breeding: one model over every line tested before. It needs no family records, and it lets you check ProMaize against the method your team already trusts.",
  environment: '2-Step plus each test site\'s weather and soil.',
}

export default function Controls({ n, budget, cap, even, maxFamily, prices, onBudget, onCap, onPrices, onEven, engines, engine, onEngine, heldOut, seasons, dataset }: Props) {
  const set = (key: keyof Prices) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onPrices({ ...prices, [key]: Number(e.target.value) })
  const capTop = Math.min(maxFamily, 80)
  const capValue = Number.isFinite(cap) ? cap : capTop + 1

  const cur = engines?.find((e) => e.id === engine)

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
          <div className="control">
            <div className="toggle">
              {engines.map((e) => (
                <button key={e.id} className={e.id === engine ? 'on' : ''} onClick={() => onEngine(e.id)} title={BEHIND[e.id]}>{SHORT[e.id]}</button>
              ))}
            </div>
            <div className="engine-note">
              {WHEN[engine]}<br />
              Track record: accuracy <b>{cur.r_mean.toFixed(2)}</b> on average over {seasons ?? 'the'} past seasons
              {heldOut ? <>, <b>{cur.r_last.toFixed(2)}</b> in {heldOut}, when <b>{Math.round(cur.coverage90 * 100)}%</b> of
              real results fell inside its ranges</> : null}.
            </div>
          </div>
        </>
      )}

      <h2 style={engines && engines.length > 1 ? { marginTop: 20 } : undefined}>Your season<Info>
        <b>Lines you can field-test</b>: the plot budget, how many candidates get into the field this year.<br />
        <b>Most lines from one family</b>: a limit to keep the advanced set varied; "no limit" ranks purely on value.
      </Info></h2>

      <div className="control">
        <label>
          Lines you can field-test <b>{budget.toLocaleString('en-US')} of {n.toLocaleString('en-US')}</b>
        </label>
        <input type="range" min={10} max={n} step={10} value={budget} onChange={(e) => onBudget(Number(e.target.value))} />
        <div className="hint">The plot budget. Everything reorders as you move it.</div>
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

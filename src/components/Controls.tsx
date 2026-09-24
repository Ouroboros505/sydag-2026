import type { Prices } from '../lib/econ'
import Info from './Info'

interface Props {
  n: number
  budget: number
  cap: number
  maxFamily: number
  prices: Prices
  onBudget: (k: number) => void
  onCap: (c: number) => void
  onPrices: (p: Prices) => void
}

export default function Controls({ n, budget, cap, maxFamily, prices, onBudget, onCap, onPrices }: Props) {
  const set = (key: keyof Prices) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onPrices({ ...prices, [key]: Number(e.target.value) })
  const capTop = Math.min(maxFamily, 80)
  const capValue = Number.isFinite(cap) ? cap : capTop + 1

  return (
    <div className="panel">
      <h2>Your season<Info>
        <b>Lines you can field-test</b>: the plot budget, how many candidates get into the field this year.<br />
        <b>Most lines from one family</b>: a limit to keep the advanced set varied; "no limit" ranks purely on value.
      </Info></h2>

      <div className="control">
        <label>
          Lines you can field-test <b>{budget.toLocaleString()} of {n.toLocaleString()}</b>
        </label>
        <input type="range" min={10} max={n} step={10} value={budget} onChange={(e) => onBudget(Number(e.target.value))} />
        <div className="hint">The plot budget. Everything reorders as you move it.</div>
      </div>

      <div className="control">
        <label>
          Most lines from one family <b>{Number.isFinite(cap) ? cap : 'no limit'}</b>
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

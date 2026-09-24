import type { Prices } from '../lib/econ'

interface Props {
  n: number
  budget: number
  prices: Prices
  onBudget: (k: number) => void
  onPrices: (p: Prices) => void
}

export default function Controls({ n, budget, prices, onBudget, onPrices }: Props) {
  const set = (key: keyof Prices) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onPrices({ ...prices, [key]: Number(e.target.value) })

  return (
    <div className="panel">
      <h2>Your season</h2>

      <div className="control">
        <label>
          Lines you can field-test <b>{budget.toLocaleString()} of {n.toLocaleString()}</b>
        </label>
        <input type="range" min={10} max={n} step={10} value={budget} onChange={(e) => onBudget(Number(e.target.value))} />
        <div className="hint">The plot budget. Everything below reorders as you move it.</div>
      </div>

      <h2 style={{ marginTop: 20 }}>Your economics</h2>

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

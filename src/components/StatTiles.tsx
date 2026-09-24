import type { Summary } from '../lib/econ'
import { fmtNum, fmtUSD } from '../lib/econ'

interface Props extends Summary {
  budget: number
}

export default function StatTiles({ budget, gainByMargin, gainByYield, gap, swapCount }: Props) {
  return (
    <div className="tiles">
      <div className="tile">
        <div className="k">Lines advanced</div>
        <div className="v">{fmtNum(budget)}</div>
        <div className="d">this season's plot budget</div>
      </div>
      <div className="tile">
        <div className="k">Gain per acre, ranking by $</div>
        <div className="v">{fmtUSD(gainByMargin)}</div>
        <div className="d">over advancing at random</div>
      </div>
      <div className="tile">
        <div className="k">Gain per acre, ranking by bushels</div>
        <div className="v">{fmtUSD(gainByYield)}</div>
        <div className="d">same budget, sorted the usual way</div>
      </div>
      <div className="tile">
        <div className="k">Left on the table</div>
        <div className={'v' + (gap > 0 ? ' good' : '')}>{fmtUSD(gap)}</div>
        <div className="d">per acre, every acre you advance</div>
      </div>
      <div className="tile">
        <div className="k">Lines that change hands</div>
        <div className="v">{fmtNum(swapCount)}</div>
        <div className="d">advanced on $, cut on bushels</div>
      </div>
    </div>
  )
}

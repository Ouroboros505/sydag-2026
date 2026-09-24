import type { Summary } from '../lib/econ'
import { fmtNum, fmtPct, fmtUSD } from '../lib/econ'

interface Props extends Summary {
  capped: boolean
}

export default function StatTiles({ gainByMargin, gainByYield, gap, swapCount, diversity, capCost, capped }: Props) {
  return (
    <div className="tiles">
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
      <div className="tile">
        <div className="k">Genetic breadth</div>
        <div className="v">{fmtNum(diversity.effective, 1)}</div>
        <div className="d">
          effective families · {diversity.families} present · largest {fmtPct(diversity.largestShare)}
          {capped && <> · cap costs {fmtUSD(capCost)}/ac</>}
        </div>
      </div>
    </div>
  )
}

import { fmtNum, fmtPct, fmtUSD } from '../lib/econ'

interface Props {
  budget: number
  capturedByMargin: number
  capturedByYield: number
  dollarGap: number       // $/acre summed across the advanced set, margin-rank minus yield-rank
  swapCount: number
}

export default function StatTiles({ budget, capturedByMargin, capturedByYield, dollarGap, swapCount }: Props) {
  return (
    <div className="tiles">
      <div className="tile">
        <div className="k">Lines advanced</div>
        <div className="v">{fmtNum(budget)}</div>
        <div className="d">this season's plot budget</div>
      </div>
      <div className="tile">
        <div className="k">Margin captured, ranking by $</div>
        <div className="v">{fmtPct(capturedByMargin)}</div>
        <div className="d">of what advancing every line would earn</div>
      </div>
      <div className="tile">
        <div className="k">Margin captured, ranking by bushels</div>
        <div className="v">{fmtPct(capturedByYield)}</div>
        <div className="d">the same budget, sorted the usual way</div>
      </div>
      <div className="tile">
        <div className="k">Left on the table by ranking on bushels</div>
        <div className={'v' + (dollarGap > 0 ? ' good' : '')}>{fmtUSD(dollarGap)}</div>
        <div className="d">per acre, summed over the advanced set</div>
      </div>
      <div className="tile">
        <div className="k">Lines that change hands</div>
        <div className="v">{fmtNum(swapCount)}</div>
        <div className="d">advanced on margin, cut on bushels</div>
      </div>
    </div>
  )
}

import type { Summary } from '../lib/econ'
import { fmtNum, fmtPct, fmtUSD } from '../lib/econ'
import Info from './Info'

interface Props extends Summary {
  capped: boolean
}

export default function StatTiles({ gainByMargin, gainByYield, gap, swapCount, diversity, capCost, capped }: Props) {
  return (
    <div className="tiles">
      <div className="tile">
        <div className="k">Expected gain per acre, ranking by $<Info>
          Rank every candidate by its predicted <b>$/acre</b> and advance the top ones (your budget). This is how much
          more an acre of those lines is expected to be worth than an acre of a line picked <b>at random</b>, by the
          model's own predictions. What the field then actually paid is in the panel below.<br /><br />
          = average predicted $/acre of the advanced lines − average predicted $/acre of all candidates.
        </Info></div>
        <div className="v">{fmtUSD(gainByMargin)}</div>
        <div className="d">over advancing at random</div>
      </div>
      <div className="tile">
        <div className="k">Expected gain per acre, ranking by bushels<Info>
          The usual way: advance the lines with the highest predicted <b>yield</b>, same budget. Then value those
          lines in dollars, the same way, and compare with random.<br /><br />
          = average $/acre of the top lines by yield − average $/acre of all candidates.
        </Info></div>
        <div className="v">{fmtUSD(gainByYield)}</div>
        <div className="d">same budget, sorted the usual way</div>
      </div>
      <div className="tile">
        <div className="k">Left on the table (expected)<Info>
          How much money per acre the bushel ranking loses compared with the dollar ranking: the two tiles to the left,
          subtracted. It comes from lines that yield well but are wet at harvest (drying costs) or fall over (lodging).
        </Info></div>
        <div className={'v' + (gap > 0 ? ' good' : '')}>{fmtUSD(gap)}</div>
        <div className="d">per acre, every acre you advance</div>
      </div>
      <div className="tile">
        <div className="k">Lines that change hands<Info>
          Lines the dollar ranking advances that the bushel ranking would have <b>cut</b>. The same number go the
          other way. These are the decisions that actually change if you rank by money. They're the highlighted rows
          in the advancement list.
        </Info></div>
        <div className="v">{fmtNum(swapCount)}</div>
        <div className="d">advanced on $, cut on bushels</div>
      </div>
      <div className="tile">
        <div className="k">Genetic breadth<Info>
          How varied the advanced lines are, in families (siblings from the same cross).<br /><br />
          <b>Effective families</b>: if the advanced lines came in equal-sized families, how many families it would
          take. Low means a few families dominate.<br />
          <b>Present</b>: families with at least one line advanced.<br />
          <b>Largest</b>: share of the plots taken by the single biggest family.<br />
          <b>Breadth costs</b>: $/acre the model expects to give up for your family limit or even share, compared
          with ranking all lines. What 2008 actually charged is in the panel below: in a year when the family call is
          weak, much less.
        </Info></div>
        <div className="v">{fmtNum(diversity.effective, 1)}</div>
        <div className="d">
          effective families · {diversity.families} present · largest {fmtPct(diversity.largestShare)}
          {capped && <> · breadth costs {fmtUSD(capCost)}/ac, expected</>}
        </div>
      </div>
    </div>
  )
}

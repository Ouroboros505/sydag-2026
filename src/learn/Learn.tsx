import type { ReactNode } from 'react'
import ThemeToggle from '../components/ThemeToggle'
import { IdDecoder, ProblemPicture, ReadsToNumbers } from './Basics'
import { DecisionToy, GLOSSARY, MoneyLine } from './Decision'
import { PoolCycle, WhatIsALine } from './Lines'
import { LeakageTrap, MarkerExplorer, MatrixView, Predictor } from './Model'
import { CandidateYear } from './Year'

interface Sec { id: string; title: string; oneLine: string; body: ReactNode }

const SECTIONS: Sec[] = [
  { id: 'problem', title: 'The problem in one picture', oneLine: 'Too many new corn lines, too few field plots to test them. (Testing a line means planting its test hybrid; section 5 shows how. Bayer uses the same shorthand: which lines to advance into field plots.)', body: <ProblemPicture /> },
  { id: 'line', title: 'What is a line? (pure breed)', oneLine: 'A line is a corn variety you can copy exactly: plant its seeds and every plant comes out the same. You make one by letting a plant pollinate itself for a few seasons.', body: <WhatIsALine /> },
  { id: 'pools', title: 'Pools are a cycle', oneLine: 'A pool is many lines. Pairs of them make families; the best kids become next year\'s parents.', body: <PoolCycle /> },
  { id: 'ids', title: 'Reading an ID', oneLine: 'C1.7.3 = pool 1, family 7, kid 3.', body: <IdDecoder /> },
  { id: 'year', title: 'One candidate\'s year', oneLine: 'Follow one kid from January, when all we have is its DNA, to December, when its field results become next year\'s training data.', body: <CandidateYear /> },
  { id: 'dna', title: 'From DNA to numbers', oneLine: '−1, 0 and +1 are just a count of one letter at one spot, minus one.', body: <ReadsToNumbers /> },
  { id: 'table', title: 'The data table', oneLine: 'Rows are lines, columns are DNA spots, plus a yield for the lines already tested.', body: <MatrixView /> },
  { id: 'learn', title: 'How the model learns', oneLine: 'For each DNA spot, compare lines with one version against lines with the other.', body: <MarkerExplorer /> },
  { id: 'predict', title: 'Predicting a line nobody has grown', oneLine: 'Prediction = starting point + (version count × weight) for every marker. Both were learned from the past lines.', body: <Predictor /> },
  { id: 'honest', title: 'The honesty trap', oneLine: 'Test on a family the model never saw, or the score is fake.', body: <LeakageTrap /> },
  { id: 'money', title: 'From bushels to dollars', oneLine: 'Wet corn costs money to dry, fallen corn is lost: bushels are not the whole story.', body: <MoneyLine /> },
  { id: 'decide', title: 'The decision', oneLine: 'Pick which lines get plots: by dollars, and without putting every plot in one family.', body: <DecisionToy /> },
]

export default function Learn() {
  return (
    <div className="learn">
      <header className="lhead">
        <div>
          <h1>ProMaize, from zero</h1>
          <p className="sub">What the breeding problem is, what the data looks like, and what the model does. No background needed.</p>
        </div>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="banner" style={{ marginLeft: 0 }}>toy data</span>
          <ThemeToggle />
        </span>
      </header>

      <div className="lgrid">
        <nav className="toc">
          <div className="small muted">Sections</div>
          <ol>
            {SECTIONS.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}
            <li><a href="#glossary">Glossary</a></li>
          </ol>
          <a className="btn" href="/">Open the ProMaize demo →</a>
        </nav>

        <div className="lbody">
          {SECTIONS.map((s, i) => (
            <section key={s.id} id={s.id} className="panel lsec">
              <div className="num">{i + 1}</div>
              <h2>{s.title}</h2>
              <p className="oneline">{s.oneLine}</p>
              {s.body}
            </section>
          ))}

          <section className="panel lsec" id="summary">
            <h2>Putting it together</h2>
            <ol className="recap">
              <li>A seed company makes thousands of new corn lines a year and can field-test only a few hundred.</li>
              <li>DNA is cheap, fields are expensive. So: learn from past lines which DNA versions go with high yield.</li>
              <li>Use that to predict new lines before planting. Accuracy is honestly low (0.13 to 0.31 depending on the year), and we say so.</li>
              <li><b>ProMaize's twist:</b> rank by what an acre is worth in dollars, not just bushels, and keep the chosen lines genetically broad.</li>
            </ol>
            <p className="muted small">
              Everything on this page uses a tiny made-up dataset so each idea is easy to see. The demo uses the real
              Bayer data: the 2008 cohort, ranked the way it stood in January 2008, then checked against what it did.
            </p>
            <a className="btn" href="/">Open the ProMaize demo →</a>
          </section>

          <section className="panel lsec" id="glossary">
            <h2>Glossary</h2>
            <dl className="gloss">
              {GLOSSARY.map(([t, d]) => (
                <div key={t}><dt>{t}</dt><dd>{d}</dd></div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}

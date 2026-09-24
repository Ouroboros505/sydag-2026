/** Toy data for the learning page. Small on purpose, and built so each idea is visible:
 *  two markers genuinely move yield (M2 strongly, M5 a little) and the rest are noise.
 *  The past lines form a balanced design, so a marker's effect can be read straight off the
 *  difference between the two groups it splits the lines into. */

export type Code = -1 | 0 | 1

export interface Marker {
  id: string
  where: string         // chromosome and position, the marker's "address"
  v1: string            // version 1 letter  -> code -1 when both copies carry it
  v2: string            // version 2 letter  -> code +1 when both copies carry it
}

export const MARKERS: Marker[] = [
  { id: 'M1', where: 'chr 1, base 1,007,742', v1: 'T', v2: 'A' },
  { id: 'M2', where: 'chr 2, base 4,281,006', v1: 'G', v2: 'C' },
  { id: 'M3', where: 'chr 3, base 912,448', v1: 'A', v2: 'G' },
  { id: 'M4', where: 'chr 5, base 7,730,219', v1: 'C', v2: 'T' },
  { id: 'M5', where: 'chr 7, base 2,016,573', v1: 'T', v2: 'G' },
  { id: 'M6', where: 'chr 9, base 5,448,901', v1: 'A', v2: 'C' },
]

export interface Line {
  id: string
  year: number
  codes: Code[]
  yield?: number        // testcross yield, bu/ac. Missing for lines not grown yet.
  truth?: number        // what the field later showed (only for the reveal)
}

/** Lines tested in past seasons: DNA and field results. The model learns from these. */
export const PAST: Line[] = [
  { id: 'C1.3.1', year: 2005, codes: [1, 1, 1, 1, 1, 1], yield: 187 },
  { id: 'C1.3.2', year: 2005, codes: [1, 1, 1, -1, -1, -1], yield: 177 },
  { id: 'C1.4.1', year: 2006, codes: [1, -1, -1, 1, 1, -1], yield: 168 },
  { id: 'C1.4.2', year: 2006, codes: [1, -1, -1, -1, -1, 1], yield: 158 },
  { id: 'C1.5.1', year: 2006, codes: [-1, 1, -1, -1, 1, 1], yield: 184 },
  { id: 'C1.5.2', year: 2007, codes: [-1, 1, -1, 1, -1, -1], yield: 179 },
  { id: 'C1.6.1', year: 2007, codes: [-1, -1, 1, -1, 1, -1], yield: 166 },
  { id: 'C1.6.2', year: 2007, codes: [-1, -1, 1, 1, -1, 1], yield: 157 },
]

/** A new family: two parents, and their kids that have never been in a field. */
export const PARENT_A: Line = { id: 'Parent A', year: 0, codes: [1, 1, 1, -1, -1, -1] }
export const PARENT_B: Line = { id: 'Parent B', year: 0, codes: [-1, -1, -1, 1, 1, 1] }

export const NEW: Line[] = [
  { id: 'C1.7.1', year: 2008, codes: [1, 1, 1, 1, 1, 1], truth: 188 },
  { id: 'C1.7.2', year: 2008, codes: [-1, -1, 1, -1, -1, -1], truth: 157 },
  { id: 'C1.7.3', year: 2008, codes: [1, 1, -1, 1, 1, -1], truth: 184 },
  { id: 'C1.7.4', year: 2008, codes: [-1, -1, -1, 1, -1, -1], truth: 159 },
]

export function letters(m: Marker, c: Code): string {
  return c === -1 ? m.v1 + m.v1 : c === 1 ? m.v2 + m.v2 : m.v1 + m.v2
}

export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)

/** Average yield of past lines carrying each version at marker j. */
export function split(j: number) {
  const lo = PAST.filter((l) => l.codes[j] === -1).map((l) => l.yield!)
  const hi = PAST.filter((l) => l.codes[j] === 1).map((l) => l.yield!)
  return { lo: mean(lo), hi: mean(hi), gap: mean(hi) - mean(lo), nLo: lo.length, nHi: hi.length }
}

/** The learned model: baseline plus one weight per marker. With a balanced design this is exactly
 *  what least squares gives; ridge regression does the same job when the design is messy. */
export const BASE = mean(PAST.map((l) => l.yield!))
export const WEIGHTS = MARKERS.map((_, j) => split(j).gap / 2)

export function predict(l: Line): number {
  return BASE + l.codes.reduce<number>((s, c, j) => s + c * WEIGHTS[j], 0)
}

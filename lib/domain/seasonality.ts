import type { Seasonality } from "./types"

/**
 * Seasonality from a year of monthly average sales ranks. Pure: the caller
 * supplies the twelve buckets, whether they came from Keepa history or a
 * fixture.
 *
 * The point of this analysis is that judging a product on today's rank
 * systematically hides the best seasonal buys. A product that looks mediocre
 * in June can be the strongest buy of the year in September.
 */

export interface SeasonalProfile {
  /** 1-indexed months whose demand is materially above the year's mean. */
  peakMonths: number[]
  /**
   * Mean rank in the run-up divided by the best month's rank. Higher means a
   * bigger surge is coming. Null when the best month is the first with data,
   * so there is no run-up to measure against.
   */
  surgeMultiple: number | null
  /**
   * Best three months' mean rank over the annual mean. Lower means stronger
   * seasonality; near 1 means the product sells the same all year.
   */
  seasonRatio: number | null
  classification: Seasonality
}

/** Below this the peak is so much better than the rest of the year that
 * stocking off-season is a mistake. */
const HIGHLY_SEASONAL_RATIO = 0.25
const SEASONAL_RATIO = 0.5
/** A peak of one or two months with a very sharp lift reads as an event. */
const EVENT_SURGE = 8

const MONTHS = 12

export function analyseSeasonality(monthlyRank: (number | null)[]): SeasonalProfile {
  const known = monthlyRank
    .map((rank, index) => ({ rank, month: index + 1 }))
    .filter((m): m is { rank: number; month: number } => m.rank !== null && m.rank > 0)

  // Four months is the least that can distinguish a season from noise.
  if (known.length < 4) {
    return {
      peakMonths: [],
      surgeMultiple: null,
      seasonRatio: null,
      classification: "unknown",
    }
  }

  const annualMean = known.reduce((sum, m) => sum + m.rank, 0) / known.length

  // Rank is inverted: a *lower* rank is more demand, so a peak month is one
  // whose rank is well below the annual mean. A flat product has no peaks,
  // which is an answer rather than a failure to find one.
  const peakMonths = known
    .filter((m) => m.rank <= annualMean * 0.6)
    .map((m) => m.month)
    .sort((a, b) => a - b)

  // Measured on the best three months rather than the detected peaks, so the
  // ratio exists even when nothing stands out. That is how an evergreen
  // product reads as evergreen instead of as unclassifiable.
  const bestThree = [...known].sort((a, b) => a.rank - b.rank).slice(0, 3)
  const bestThreeMean = bestThree.reduce((sum, m) => sum + m.rank, 0) / bestThree.length
  const seasonRatio = round2(bestThreeMean / annualMean)

  const surgeMultiple = computeSurge(known)

  return {
    peakMonths,
    surgeMultiple,
    seasonRatio,
    classification: classify(seasonRatio, surgeMultiple, peakMonths.length),
  }
}

/**
 * How much better the best month is than the run-up to it. Measured against
 * the months *before* it rather than the whole year, because what the seller
 * is deciding is whether to buy now for a lift that has not happened yet.
 */
function computeSurge(known: { rank: number; month: number }[]): number | null {
  const best = known.reduce((a, b) => (b.rank < a.rank ? b : a))
  const runUp = known.filter((m) => m.month < best.month)
  if (runUp.length === 0 || best.rank <= 0) return null
  const runUpMean = runUp.reduce((sum, m) => sum + m.rank, 0) / runUp.length
  return round1(runUpMean / best.rank)
}

function classify(
  seasonRatio: number | null,
  surgeMultiple: number | null,
  peakCount: number,
): Seasonality {
  if (seasonRatio === null) return "unknown"
  if (surgeMultiple !== null && surgeMultiple >= EVENT_SURGE && peakCount <= 2) {
    return "event-driven"
  }
  if (seasonRatio <= HIGHLY_SEASONAL_RATIO) return "highly-seasonal"
  if (seasonRatio <= SEASONAL_RATIO) return "seasonal"
  return "evergreen"
}

const GLYPHS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]

/**
 * Twelve months of demand in twelve characters, for markdown, chat and CSV.
 *
 * Bars show demand, not rank. Plotting rank directly would make the best
 * month the shortest bar. Normalised per product because absolute rank means
 * nothing across categories, and on a power scale because a linear 1/rank
 * makes the peak tower and flattens the rest of the year to nothing.
 */
export function demandSparkline(monthlyRank: (number | null)[]): string {
  const demand = monthlyRank
    .slice(0, MONTHS)
    .map((rank) => (rank !== null && rank > 0 ? 1 / rank : 0))
  const max = Math.max(...demand)
  if (max === 0) return "·".repeat(MONTHS)
  return demand
    .map((d) => {
      if (d === 0) return "·"
      const scaled = Math.pow(d / max, 0.4)
      // Any month with data gets at least one glyph: a sliver reads as absent.
      const index = Math.min(GLYPHS.length - 1, Math.max(0, Math.round(scaled * (GLYPHS.length - 1))))
      return GLYPHS[index]
    })
    .join("")
}

/**
 * Bar heights in pixels for the sparkline row. Same scale as the text
 * version, and a floor so a month with data never renders as a missing one.
 */
export function barHeights(monthlyRank: (number | null)[], maxPx = 34): number[] {
  const demand = monthlyRank
    .slice(0, MONTHS)
    .map((rank) => (rank !== null && rank > 0 ? 1 / rank : 0))
  const max = Math.max(...demand)
  if (max === 0) return demand.map(() => 0)
  return demand.map((d) =>
    d > 0 ? Math.max(3, Math.round(maxPx * Math.pow(d / max, 0.4))) : 0,
  )
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

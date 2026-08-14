import { describe, expect, it } from "vitest"
import {
  analyseSeasonality,
  barHeights,
  demandSparkline,
  describeSeason,
} from "../seasonality"
import type { SeasonalProfile } from "../seasonality"

/**
 * Reference profiles are real amazon.ca monthly rank averages for 2025.
 */
const BACK_TO_SCHOOL = [26848, 12967, 27833, 42416, 31999, 33971, 37456, 12218, 1807, 2643, 2975, 3914]
const STEADY = [6169, 4702, 6591, 3594, 3769, 3770, 3222, 3132, 4501, 6660, 6200, 5529]
const JANUARY_PEAK = [58, 75, 94, 138, 101, 181, 1856, 2398, 1433, 3484, 7354, 7891]
/** A narrow new-year peak, for the wrap-around case. */
const NEW_YEAR = [300, 350, 4000, 5000, 6000, 6000, 5500, 5000, 4800, 5200, 4000, 3000]
const PARTIAL = [null, null, null, null, null, null, null, 60127, 1761, 2657, 2907, 3920]
const CRAYOLA = [1204, 3157, 328, 419, 327, 311, 635, 497, 363, 557, 1327, 1399]

describe("seasonality", () => {
  it("finds the peak from the data, not from the category", () => {
    const autumn = analyseSeasonality(BACK_TO_SCHOOL)
    expect(autumn.peakMonths).toEqual([9, 10, 11, 12])
    // The same analysis on a January peaker must not assume back-to-school.
    expect(analyseSeasonality(JANUARY_PEAK).peakMonths).toEqual([1, 2, 3, 4, 5, 6])
  })

  it("reads a peak as demand, so a lower rank is a taller bar", () => {
    const heights = barHeights(BACK_TO_SCHOOL)
    // September is the best rank, so it must be the tallest bar.
    expect(Math.max(...heights)).toBe(heights[8])
    expect(heights[8]).toBeGreaterThan(heights[3])
  })

  it("quantifies the surge against the run-up, not the whole year", () => {
    // The decision is whether to buy now for a lift that has not happened.
    const autumn = analyseSeasonality(BACK_TO_SCHOOL)
    expect(autumn.surgeMultiple).toBeGreaterThan(10)
    expect(analyseSeasonality(STEADY).surgeMultiple).toBeLessThan(2)
  })

  it("separates a strong seasonal from a year-round seller", () => {
    expect(analyseSeasonality(BACK_TO_SCHOOL).classification).toBe("highly-seasonal")
    expect(analyseSeasonality(STEADY).classification).toBe("evergreen")
  })

  it("refuses to classify on too little data", () => {
    const thin = analyseSeasonality([null, null, 4000, null, null, null, null, null, null, null, null, null])
    expect(thin.classification).toBe("unknown")
    expect(thin.seasonRatio).toBeNull()
  })

  it("works on a partial year without treating absent months as dead", () => {
    const partial = analyseSeasonality(PARTIAL)
    expect(partial.peakMonths).toEqual([9, 10, 11, 12])
    expect(partial.classification).not.toBe("unknown")
  })
})

describe("describeSeason", () => {
  it("says when the peak is and how far away it is from where the seller stands", () => {
    const autumn = analyseSeasonality(BACK_TO_SCHOOL)
    // Standing in June, the September peak is three months out and buying now
    // is buying into it. Standing inside the window, it is already here.
    expect(describeSeason(autumn, 6)).toContain("September")
    expect(describeSeason(autumn, 6)).toContain("3 months out")
    expect(describeSeason(autumn, 11)).toContain("this month")
  })

  it("wraps the year rather than reporting a peak as past", () => {
    const said = describeSeason(analyseSeasonality(NEW_YEAR), 12)
    expect(said).toContain("next month")
  })

  it("names the dead patch when the peak covers half the year", () => {
    // Six months called "hardest" is noise. What changes a buy is knowing
    // which months the product dies in.
    const said = describeSeason(analyseSeasonality(JANUARY_PEAK), 6)
    expect(said).toContain("slows through July to December")
    expect(said).toContain("stock bought just before that sits")
  })

  it("names a broad peak's slower run across the end of the year", () => {
    const said = describeSeason(analyseSeasonality(CRAYOLA), 10)
    expect(said).toContain("slows through November to February")
    expect(said).toContain("stock bought just before that sits")
  })

  it("does not invent a slower run when the broad peak has none", () => {
    const profile: SeasonalProfile = {
      peakMonths: [1, 2, 3, 4, 5, 6],
      quietMonths: [],
      slowerMonths: [],
      surgeMultiple: null,
      seasonRatio: 0.5,
      classification: "seasonal",
    }
    expect(describeSeason(profile, 6)).toContain("timing is not the risk")
    expect(describeSeason(profile, 6)).not.toContain("slows")
  })

  it("reads a run of months as a window rather than a list", () => {
    const said = describeSeason(analyseSeasonality(PARTIAL), 6)
    expect(said).toContain("September to December")
  })

  it("tells an evergreen seller that timing is not the risk", () => {
    const said = describeSeason(analyseSeasonality(STEADY), 6)
    expect(said).toContain("all year")
  })

  it("says nothing at all when the history cannot support a claim", () => {
    const thin = analyseSeasonality([null, null, 4000, null, null, null, null, null, null, null, null, null])
    expect(describeSeason(thin, 6)).toBeNull()
  })
})

describe("sparkline", () => {
  it("renders twelve months in twelve characters", () => {
    expect(demandSparkline(BACK_TO_SCHOOL)).toHaveLength(12)
  })

  it("marks a month with no data apart from a weak month", () => {
    const line = demandSparkline(PARTIAL)
    expect(line.slice(0, 7)).toBe("·······")
    expect(line[8]).not.toBe("·")
  })

  it("keeps the off-season readable rather than flattening it", () => {
    // A linear 1/rank scale makes the peak tower and everything else vanish.
    const line = demandSparkline(BACK_TO_SCHOOL)
    const offSeason = new Set(line.slice(0, 7).split(""))
    expect(offSeason.has("▁")).toBe(false)
    expect(line[8]).toBe("█")
  })

  it("gives any month with data at least one pixel", () => {
    const heights = barHeights(BACK_TO_SCHOOL)
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(3)
    // A month with no data gets nothing at all, which the row draws dashed.
    expect(barHeights(PARTIAL)[0]).toBe(0)
  })
})

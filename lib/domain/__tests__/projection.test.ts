import { describe, expect, it } from "vitest"
import { project, projectYear, reachability, runRateAt } from "../projection"
import type { ProjectionInputs } from "../types"

const base: ProjectionInputs = {
  capital: 2000,
  targetRoi: 0.3,
  turnsPerYear: 8,
  reinvestRate: 1,
}

describe("earnings projection", () => {
  it("compounds capital once per turn", () => {
    const p = projectYear(base)
    expect(p.turns).toHaveLength(8)
    // 2000 x 1.3^8
    expect(p.endingCapital).toBeCloseTo(16314.61, 1)
  })

  it("projects an arbitrary horizon, not only a year", () => {
    const p = project(base, 16)
    expect(p.turns).toHaveLength(16)
    // Year two continues from where year one ended.
    expect(p.turns[8].openingCapital).toBeCloseTo(
      projectYear(base).endingCapital,
      1,
    )
    // Cumulative profit covers every turn projected, not just the first year.
    expect(p.cumulativeProfit).toBeGreaterThan(
      projectYear(base).cumulativeProfit,
    )
  })

  it("reports the final turn's profit, not the next turn's", () => {
    const p = projectYear(base)
    const lastTurn = p.turns[7]
    expect(lastTurn.openingCapital).toBeCloseTo(12549.7, 1)
    expect(p.finalTurnProfit).toBeCloseTo(3764.91, 1)
    // A common off-by-one is to take 30% of the *ending* capital, which
    // reports a turn the seller has not run yet and overstates the run rate
    // by 30%.
    expect(p.finalTurnProfit).not.toBeCloseTo(p.endingCapital * 0.3, 1)
  })

  it("spreads the final turn's profit over the length of a turn", () => {
    const p = projectYear(base)
    // 8 turns a year is a turn every 1.5 months.
    expect(p.monthlyRunRate).toBeCloseTo(3764.91 / 1.5, 1)
  })

  it("does not compound profit the seller takes out", () => {
    const withdrawn = projectYear({ ...base, reinvestRate: 0 })
    expect(withdrawn.endingCapital).toBe(2000)
    expect(withdrawn.cumulativeProfit).toBeCloseTo(2000 * 0.3 * 8, 1)
    expect(withdrawn.endingCapital).toBeLessThan(
      projectYear(base).endingCapital,
    )
  })

  it("turn speed and ROI are separate levers", () => {
    const faster = projectYear({ ...base, turnsPerYear: 12 })
    const richer = projectYear({ ...base, targetRoi: 0.45 })
    expect(faster.endingCapital).toBeGreaterThan(
      projectYear(base).endingCapital,
    )
    expect(richer.endingCapital).toBeGreaterThan(
      projectYear(base).endingCapital,
    )
  })

  it("rejects a zero turn rate rather than dividing by it", () => {
    expect(() => projectYear({ ...base, turnsPerYear: 0 })).toThrow()
  })

  it("returns a run rate of zero before the first turn completes", () => {
    expect(runRateAt(base, 1)).toBe(0)
    expect(runRateAt(base, 2)).toBeGreaterThan(0)
  })
})

describe("reachability", () => {
  it("confirms a target the trajectory actually reaches", () => {
    const r = reachability(base, 2000, 12, "CAD")
    expect(r.verdict).toBe("reachable")
    expect(r.runRateAtDeadline).toBeGreaterThanOrEqual(2000)
  })

  it("gives a real date for an over-ambitious target instead of a fantasy plan", () => {
    const r = reachability(base, 5000, 12, "CAD")
    expect(r.verdict).toBe("reachable-later")
    expect(r.runRateAtDeadline).toBeLessThan(5000)
    expect(r.monthsToTarget).not.toBeNull()
    expect(r.monthsToTarget!).toBeGreaterThan(12)
  })

  it("shows the arithmetic behind every verdict", () => {
    const r = reachability(base, 5000, 12, "CAD")
    expect(r.workings.length).toBeGreaterThanOrEqual(3)
    expect(r.workings.join(" ")).toContain("30%")
    expect(r.workings.join(" ")).toContain("8 turns")
  })

  it("says so plainly when the target is out of reach on these assumptions", () => {
    const r = reachability(
      { ...base, capital: 200, turnsPerYear: 2 },
      500_000,
      12,
      "CAD",
    )
    expect(r.monthsToTarget).toBeNull()
    expect(r.workings.join(" ")).toContain("Raise turn speed")
  })

  it("does not judge a seller who has set no profit target", () => {
    expect(reachability(base, 0, 12, "CAD").verdict).toBe("not-modelled")
  })

  it("moves the date when the seller changes an assumption", () => {
    const slow = reachability(base, 5000, 12, "CAD")
    const fast = reachability({ ...base, turnsPerYear: 12 }, 5000, 12, "CAD")
    expect(fast.monthsToTarget!).toBeLessThan(slow.monthsToTarget!)
  })

  it("uses the seller's currency in the workings", () => {
    const r = reachability(base, 5000, 12, "GBP")
    expect(r.workings.join(" ")).toContain("GBP 2,000")
    expect(r.workings.join(" ")).toContain("GBP 2,510")
  })

  it("keeps fractional ROI truthful in the workings", () => {
    const r = reachability({ ...base, targetRoi: 0.007 }, 5000, 12, "CAD")
    expect(r.workings[0]).toContain("at 0.7% ROI")
  })
})

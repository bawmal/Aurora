import type {
  Currency,
  Projection,
  ProjectionInputs,
  ProjectionTurn,
  Reachability,
} from "./types"
import { round } from "./fees"

/**
 * The earnings model. Capital compounds each inventory turn at the ROI the
 * seller actually holds, so the two levers they control, turn speed and ROI
 * discipline, are the two inputs.
 *
 * This is what turns "buy below $14.63" from an arbitrary constraint into
 * the thing that compounds. It is also the honest answer to an unreachable
 * goal, which is why the reachability check lives beside it rather than in
 * the journey generator.
 *
 * Always a model, never a promise. Every output is derived from assumptions
 * the seller can see and change.
 */

const MONTHS_PER_YEAR = 12
/** Stop searching for the target date rather than projecting a decade out. */
const HORIZON_MONTHS = 120

function monthsPerTurn(turnsPerYear: number): number {
  return MONTHS_PER_YEAR / turnsPerYear
}

export function projectYear(inputs: ProjectionInputs): Projection {
  return project(inputs, Math.round(inputs.turnsPerYear))
}

export function project(inputs: ProjectionInputs, turnCount: number): Projection {
  if (inputs.turnsPerYear <= 0) throw new Error("turnsPerYear must be positive")

  const turns: ProjectionTurn[] = []
  let capital = inputs.capital
  let cumulativeProfit = 0

  for (let turn = 1; turn <= Math.max(0, turnCount); turn++) {
    const opening = capital
    const profit = opening * inputs.targetRoi
    // Profit not reinvested leaves the business, so it compounds nothing.
    capital = opening + profit * inputs.reinvestRate
    cumulativeProfit += profit
    turns.push({
      turn,
      openingCapital: round(opening),
      profit: round(profit),
      closingCapital: round(capital),
    })
  }

  const finalTurnProfit = turns.length > 0 ? turns[turns.length - 1].profit : 0

  return {
    turns,
    endingCapital: round(capital),
    cumulativeProfit: round(cumulativeProfit),
    finalTurnProfit,
    monthlyRunRate: round(finalTurnProfit / monthsPerTurn(inputs.turnsPerYear)),
    assumptions: inputs,
  }
}

/** Monthly profit run rate after `months` of compounding at these assumptions. */
export function runRateAt(inputs: ProjectionInputs, months: number): number {
  const turns = Math.floor((months / MONTHS_PER_YEAR) * inputs.turnsPerYear)
  if (turns < 1) return 0
  return project(inputs, turns).monthlyRunRate
}

/**
 * Never generate a fantasy roadmap. Where the goal does not arrive on the
 * seller's timeline, show what does arrive, and when the original number
 * arrives on the current trajectory.
 */
export function reachability(
  inputs: ProjectionInputs,
  targetMonthlyProfit: number,
  timelineMonths: number,
  currency: Currency,
): Reachability {
  const atDeadline = runRateAt(inputs, timelineMonths)
  const workings: string[] = [
    `${money(currency, inputs.capital)} at ${pct(inputs.targetRoi)} ROI, ${inputs.turnsPerYear} turns a year`,
    `by month ${timelineMonths}: about ${money(currency, atDeadline)} a month`,
  ]

  if (targetMonthlyProfit <= 0) {
    return {
      verdict: "not-modelled",
      runRateAtDeadline: atDeadline,
      targetMonthlyProfit,
      monthsToTarget: null,
      workings: [...workings, "no profit target set, so there is nothing to compare against"],
    }
  }

  if (atDeadline >= targetMonthlyProfit) {
    workings.push(`target of ${money(currency, targetMonthlyProfit)} a month is reached inside the timeline`)
    return {
      verdict: "reachable",
      runRateAtDeadline: atDeadline,
      targetMonthlyProfit,
      monthsToTarget: monthsToReach(inputs, targetMonthlyProfit),
      workings,
    }
  }

  const months = monthsToReach(inputs, targetMonthlyProfit)
  workings.push(
    months === null
      ? `target of ${money(currency, targetMonthlyProfit)} a month is not reached within ${HORIZON_MONTHS} months on these assumptions. Raise turn speed, raise ROI, or add capital`
      : `target of ${money(currency, targetMonthlyProfit)} a month arrives around month ${months} on this trajectory`,
  )

  return {
    verdict: "reachable-later",
    runRateAtDeadline: atDeadline,
    targetMonthlyProfit,
    monthsToTarget: months,
    workings,
  }
}

function monthsToReach(inputs: ProjectionInputs, targetMonthlyProfit: number): number | null {
  const step = monthsPerTurn(inputs.turnsPerYear)
  for (let turn = 1; turn * step <= HORIZON_MONTHS; turn++) {
    if (project(inputs, turn).monthlyRunRate >= targetMonthlyProfit) {
      return Math.ceil(turn * step)
    }
  }
  return null
}

function money(currency: Currency, n: number): string {
  return `${currency} ${round(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

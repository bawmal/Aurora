import type { Confidence, DataQuality } from "./types"

/**
 * Confidence is a function of the data, not a number the model chooses.
 *
 * A language model asked "how confident are you" produces a fluent guess
 * that correlates with how confident the prose sounds, which is exactly the
 * failure this separates out: the verdict says what the arithmetic supports,
 * confidence says how much the arithmetic rests on real inputs.
 *
 * Every deduction below is a missing or stale input, and each one is named,
 * so the seller can raise confidence by supplying the thing rather than
 * wondering what a 62% means.
 */

interface Deduction {
  /** Fraction of confidence lost. */
  weight: number
  reason: string
}

const FLOOR = 0.1

/** Signals older than this are treated as history, not as the current state. */
const STALE_DAYS = 30

export function confidence(quality: DataQuality): Confidence {
  const deductions: Deduction[] = []

  if (!quality.livePrice) {
    deductions.push({ weight: 0.2, reason: "sale price is your estimate, not a live Buy Box read" })
  }
  if (!quality.liveFees) {
    deductions.push({ weight: 0.15, reason: "fees come from the fee table, not from Amazon" })
  }
  if (!quality.sellerEnteredCost) {
    deductions.push({ weight: 0.25, reason: "no invoice price entered, so ROI is illustrative" })
  }
  if (!quality.landedCostsEntered) {
    deductions.push({
      weight: 0.15,
      reason: "prep, freight and duty are unset, so the landed cost is only the invoice price",
    })
  }
  if (!quality.knownCategory) {
    deductions.push({ weight: 0.1, reason: "category is unrecognised, so the referral rate is a default" })
  }
  if (quality.historyDays < 90) {
    deductions.push({
      weight: quality.historyDays <= 0 ? 0.2 : 0.1,
      reason:
        quality.historyDays <= 0
          ? "no price or rank history, so demand and stability are unjudged"
          : `only ${quality.historyDays} days of history, too short to read seasonality`,
    })
  }
  if (quality.signalAgeDays > STALE_DAYS) {
    deductions.push({
      weight: 0.1,
      reason: `data is ${quality.signalAgeDays} days old`,
    })
  }

  const lost = deductions.reduce((sum, d) => sum + d.weight, 0)
  const value = Math.max(FLOOR, 1 - lost)

  return {
    // Coarse on purpose. A confidence of 62.4% is a fake-precise decimal
    // dressed up as a measurement.
    value: Math.round(value * 10) / 10,
    limits: deductions.map((d) => d.reason),
  }
}

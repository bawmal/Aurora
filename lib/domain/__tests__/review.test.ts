import { describe, expect, it } from "vitest"
import { confidence } from "../confidence"
import { UNKNOWN_SIGNALS, review } from "../review"
import type { DataQuality, MarketSignals, ProductInput, SellerProfile } from "../types"
import { DEFAULT_CRITERIA, NO_EXTRA_COSTS } from "../types"

const profile: SellerProfile = {
  id: "t",
  residency: "US",
  entityJurisdiction: "US",
  marketplaces: ["amazon.com"],
  stage: "ra-operating",
  minRoi: 0.3,
  capital: 5000,
  costs: NO_EXTRA_COSTS,
  completedRequirements: [],
  provenance: {},
}

/** Comfortably profitable, so any downgrade must come from the criteria. */
const winner: ProductInput = {
  asin: "B000000000",
  marketplace: "amazon.com",
  category: "toys",
  salePrice: 40,
  weightTier: "standard",
  unitCost: 8,
}

const signals = (over: Partial<MarketSignals> = {}): MarketSignals => ({
  ...UNKNOWN_SIGNALS,
  ...over,
})

const quality = (over: Partial<DataQuality> = {}): DataQuality => ({
  livePrice: true,
  liveFees: true,
  sellerEnteredCost: true,
  landedCostsEntered: true,
  knownCategory: true,
  historyDays: 365,
  signalAgeDays: 0,
  ...over,
})

describe("criteria as a veto", () => {
  it("leaves a clean product alone", () => {
    const r = review(winner, profile, DEFAULT_CRITERIA)
    expect(r.analysis.verdict).toBe("BUY")
    expect(r.verdict).toBe("BUY")
  })

  it("downgrades a profitable product Amazon is selling on", () => {
    const r = review(winner, profile, DEFAULT_CRITERIA, signals({ amazonOnListing: true }))
    expect(r.analysis.verdict).toBe("BUY")
    expect(r.verdict).toBe("WATCH")
    expect(r.risks.join(" ")).toContain("Amazon is selling")
  })

  it("respects a seller who has decided Amazon on the listing is fine", () => {
    const r = review(
      winner,
      profile,
      { ...DEFAULT_CRITERIA, allowAmazonOnListing: true },
      signals({ amazonOnListing: true }),
    )
    expect(r.verdict).toBe("BUY")
  })

  it("names the number that broke the rule, not just the rule", () => {
    const r = review(winner, profile, DEFAULT_CRITERIA, signals({ sellerCount: 22 }))
    expect(r.risks.join(" ")).toContain("22 sellers")
    expect(r.risks.join(" ")).toContain("15")
  })

  it("downgrades on a sales rank worse than the seller's ceiling", () => {
    const r = review(winner, profile, DEFAULT_CRITERIA, signals({ salesRank: 400_000 }))
    expect(r.verdict).toBe("WATCH")
  })

  it("never promotes a loser, however good the demand", () => {
    const loser: ProductInput = { ...winner, unitCost: 34 }
    const r = review(
      loser,
      profile,
      DEFAULT_CRITERIA,
      signals({ salesRank: 900, sellerCount: 2, amazonOnListing: false }),
    )
    expect(r.analysis.verdict).toBe("PASS")
    expect(r.verdict).toBe("PASS")
  })

  it("takes a vetoed WATCH down to PASS", () => {
    // Above the buy-below price, below breakeven: profitable, but not by
    // enough to clear the seller's ROI floor.
    const marginal: ProductInput = { ...winner, unitCost: 22.5 }
    const plain = review(marginal, profile, DEFAULT_CRITERIA)
    expect(plain.verdict).toBe("WATCH")
    const vetoed = review(marginal, profile, DEFAULT_CRITERIA, signals({ sellerCount: 40 }))
    expect(vetoed.verdict).toBe("PASS")
  })

  it("does not veto on a signal it has not read", () => {
    const r = review(winner, profile, DEFAULT_CRITERIA, UNKNOWN_SIGNALS)
    expect(r.verdict).toBe("BUY")
    expect(r.reasons.filter((x) => x.state === "unknown").length).toBeGreaterThan(0)
  })

  it("gives three reasons, each with a number and a state", () => {
    const r = review(winner, profile, DEFAULT_CRITERIA, signals({ salesRank: 2400, sellerCount: 3 }))
    expect(r.reasons).toHaveLength(3)
    for (const reason of r.reasons) {
      expect(reason.label.length).toBeGreaterThan(0)
      expect(reason.value.length).toBeGreaterThan(0)
    }
  })

  it("lets a BUY carry a watch on one line", () => {
    const r = review(winner, profile, DEFAULT_CRITERIA, signals({ salesRank: 2400, sellerCount: 14 }))
    expect(r.verdict).toBe("BUY")
    expect(r.reasons.some((x) => x.state === "watch")).toBe(true)
  })
})

describe("confidence is computed, not asserted", () => {
  it("is full only when every input is real", () => {
    expect(confidence(quality()).value).toBe(1)
    expect(confidence(quality()).limits).toEqual([])
  })

  it("falls when the seller has not entered a cost, and says why", () => {
    const c = confidence(quality({ sellerEnteredCost: false }))
    expect(c.value).toBeLessThan(1)
    expect(c.limits.join(" ")).toContain("invoice price")
  })

  it("falls further as more inputs go missing", () => {
    const some = confidence(quality({ livePrice: false }))
    const more = confidence(quality({ livePrice: false, liveFees: false, historyDays: 0 }))
    expect(more.value).toBeLessThan(some.value)
  })

  it("never reaches zero, because a floor is honest and a zero is not", () => {
    const c = confidence({
      livePrice: false,
      liveFees: false,
      sellerEnteredCost: false,
      landedCostsEntered: false,
      knownCategory: false,
      historyDays: 0,
      signalAgeDays: 400,
    })
    expect(c.value).toBeGreaterThan(0)
    expect(c.limits.length).toBeGreaterThanOrEqual(6)
  })

  it("stays coarse rather than fake-precise", () => {
    const c = confidence(quality({ livePrice: false, knownCategory: false }))
    expect(c.value * 10).toBeCloseTo(Math.round(c.value * 10), 10)
  })

  it("is independent of the verdict", () => {
    const good = review(winner, profile, DEFAULT_CRITERIA, UNKNOWN_SIGNALS, quality())
    const bad = review({ ...winner, unitCost: 34 }, profile, DEFAULT_CRITERIA, UNKNOWN_SIGNALS, quality())
    expect(good.verdict).not.toBe(bad.verdict)
    expect(good.confidence.value).toBe(bad.confidence.value)
  })
})

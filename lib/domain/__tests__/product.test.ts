import { describe, expect, it } from "vitest"
import { analyse, breakevenPrice, buyBelow, computeFees, landedCost, netProceeds } from "../product"
import type { LandedCostInputs, ProductInput, SellerProfile } from "../types"
import { NO_EXTRA_COSTS } from "../types"

const product: ProductInput = {
  asin: "B089T7PX27",
  marketplace: "amazon.ca",
  category: "toys-games",
  salePrice: 39.99,
  weightTier: "standard",
  unitCost: 12,
}

const realCosts: LandedCostInputs = {
  inboundPerUnit: 1.1,
  prepPerUnit: 1.5,
  irrecoverableTaxRate: 0,
  dutyRate: 0.06,
  returnsRate: 0.03,
}

const seller = (over: Partial<SellerProfile> = {}): SellerProfile => ({
  id: "t",
  residency: "CA",
  entityJurisdiction: "CA",
  marketplaces: ["amazon.ca"],
  stage: "ra-operating",
  minRoi: 0.3,
  capital: 5000,
  costs: NO_EXTRA_COSTS,
  completedRequirements: [],
  provenance: {},
  ...over,
})

describe("fees", () => {
  it("uses the category referral rate", () => {
    const fees = computeFees(product)
    expect(fees.referral).toBe(6) // 15% of 39.99
    expect(fees.total).toBe(fees.referral + fees.fulfilment + fees.surcharge)
  })

  it("applies the tiered rate above the step for tiered categories", () => {
    const cheap = computeFees({ ...product, category: "beauty", salePrice: 8 })
    const dear = computeFees({ ...product, category: "beauty", salePrice: 30 })
    expect(cheap.referral).toBe(0.64) // all at 8%
    expect(dear.referral).toBe(3.8) // 10 @ 8% + 20 @ 15%
  })

  it("falls back to the default rate for an unknown category", () => {
    expect(computeFees({ ...product, category: "unmapped" }).referral).toBe(6)
  })
})

describe("landed cost", () => {
  it("is the invoice price when nothing else is set", () => {
    expect(landedCost(12, NO_EXTRA_COSTS)).toBe(12)
  })

  it("scales multiplicative costs and adds per-unit costs", () => {
    // 12 × 1.06 duty = 12.72, + 1.10 inbound + 1.50 prep
    expect(landedCost(12, realCosts)).toBe(15.32)
  })
})

describe("buyBelow", () => {
  it("is net / (1 + roi) when there are no landed costs", () => {
    const net = netProceeds(product, NO_EXTRA_COSTS)
    expect(buyBelow(product, NO_EXTRA_COSTS, 0.3)).toBe(Math.round((net / 1.3) * 100) / 100)
  })

  it("is materially lower once prep, freight and duty are real", () => {
    const naive = buyBelow(product, NO_EXTRA_COSTS, 0.3)
    const real = buyBelow(product, realCosts, 0.3)
    expect(real).toBeLessThan(naive)
    // The gap is the whole point: paying the naive number misses the floor.
    expect(naive - real).toBeGreaterThan(2)
  })

  it("returns a price that lands exactly on the ROI floor", () => {
    const price = buyBelow(product, realCosts, 0.3)
    const landed = landedCost(price, realCosts)
    const profit = netProceeds(product, realCosts) - landed
    expect(profit / landed).toBeCloseTo(0.3, 2)
  })

  it("never goes negative when per-unit costs exceed what the product can bear", () => {
    const brutal = { ...realCosts, prepPerUnit: 500 }
    expect(buyBelow(product, brutal, 0.3)).toBe(0)
  })
})

describe("verdict", () => {
  it("BUYs at or below the buy-below price", () => {
    const below = buyBelow(product, realCosts, 0.3)
    const result = analyse({ ...product, unitCost: below }, seller({ costs: realCosts }))
    expect(result.verdict).toBe("BUY")
  })

  it("WATCHes between buy-below and breakeven", () => {
    const below = buyBelow(product, realCosts, 0.3)
    const breakeven = breakevenPrice(product, realCosts)
    const midpoint = (below + breakeven) / 2
    const result = analyse({ ...product, unitCost: midpoint }, seller({ costs: realCosts }))
    expect(result.verdict).toBe("WATCH")
  })

  it("PASSes at or above breakeven", () => {
    const breakeven = breakevenPrice(product, realCosts)
    const result = analyse({ ...product, unitCost: breakeven }, seller({ costs: realCosts }))
    expect(result.verdict).toBe("PASS")
  })

  it("flips a naive BUY to WATCH once landed costs are applied", () => {
    // Priced exactly at the invoice-only buy-below: looks fine, is not.
    const naive = buyBelow(product, NO_EXTRA_COSTS, 0.3)
    const withCosts = analyse({ ...product, unitCost: naive }, seller({ costs: realCosts }))
    expect(withCosts.verdict).not.toBe("BUY")
    expect(withCosts.roi).toBeLessThan(0.3)
  })
})

describe("output contract", () => {
  it("always shows the arithmetic", () => {
    const result = analyse(product, seller({ costs: realCosts }))
    expect(result.workings.length).toBeGreaterThan(4)
    expect(result.workings.join(" ")).toContain("landed cost")
  })

  it("always states at least one risk", () => {
    expect(analyse(product, seller({ costs: realCosts })).risks.length).toBeGreaterThan(0)
  })

  it("warns when the numbers are invoice-price only", () => {
    const result = analyse(product, seller())
    expect(result.risks.join(" ")).toMatch(/invoice-price calculation/)
  })

  it("warns when selling cross-border with no duty set", () => {
    const result = analyse({ ...product, marketplace: "amazon.com" }, seller())
    expect(result.risks.join(" ")).toMatch(/importer of record/)
  })

  it("warns on an unknown category rather than quoting a confident fee", () => {
    const result = analyse({ ...product, category: "unmapped" }, seller({ costs: realCosts }))
    expect(result.risks.join(" ")).toMatch(/No referral rate on file/)
  })
})

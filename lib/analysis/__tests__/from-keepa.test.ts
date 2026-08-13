import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { toAnalysisInput, weightTierFromGrams } from "../from-keepa"
import { review } from "@/lib/domain/review"
import { DEFAULT_CRITERIA, NO_EXTRA_COSTS } from "@/lib/domain/types"
import type { SellerProfile } from "@/lib/domain/types"
import type { KeepaProduct, KeepaResponse } from "@/lib/keepa/types"

const DIR = join(process.cwd(), "tests/fixtures/keepa")

function fixture(name: string): KeepaProduct {
  const body = JSON.parse(readFileSync(join(DIR, name), "utf8")) as KeepaResponse
  const product = body.products?.[0]
  if (!product) throw new Error(`fixture ${name} has no product`)
  return product
}

const seller: SellerProfile = {
  id: "s1",
  residency: "CA",
  entityJurisdiction: null,
  marketplaces: ["amazon.ca"],
  stage: "ra-operating",
  minRoi: 0.3,
  capital: 2000,
  costs: NO_EXTRA_COSTS,
  completedRequirements: [],
  provenance: {},
}

describe("keepa to analysis input", () => {
  it("carries the reference case through to a buy-below", () => {
    const result = toAnalysisInput(fixture("super-tips-t2.json"), "amazon.ca", 0, {
      historyYear: 2025,
    })
    if (!result.ok) throw new Error("expected a usable product")

    expect(result.product.salePrice).toBe(32.65)
    expect(result.product.category).toBe("toys-games")
    // 810g lands in the 501-1000g band.
    expect(result.product.weightTier).toBe("standard")
    expect(result.signals.amazonOnListing).toBe(false)
    expect(result.signals.sellerCount).toBe(19)
    expect(result.demandPerMonth).toBe(300)

    const verdict = review(result.product, seller, DEFAULT_CRITERIA, result.signals, result.quality)
    expect(verdict.analysis.buyBelow).toBeGreaterThan(10)
    expect(verdict.analysis.buyBelow).toBeLessThan(result.product.salePrice)
  })

  it("reads seasonality from history when it is there", () => {
    const withHistory = toAnalysisInput(fixture("super-tips-t2.json"), "amazon.ca", 0, {
      historyYear: 2025,
    })
    const withoutHistory = toAnalysisInput(fixture("amazon-by-price.json"), "amazon.ca", 0)
    if (!withHistory.ok || !withoutHistory.ok) throw new Error("expected usable products")
    expect(withHistory.signals.seasonality).not.toBe("unknown")
    expect(withHistory.quality.historyDays).toBe(365)
    // No history requested means unknown, never an assumed evergreen.
    expect(withoutHistory.signals.seasonality).toBe("unknown")
    expect(withoutHistory.quality.historyDays).toBe(0)
  })

  it("surfaces a guessed weight instead of silently pricing on it", () => {
    // The default moves the FBA fee and therefore the number the seller acts on.
    const result = toAnalysisInput(fixture("no-buybox.json"), "amazon.ca", 0)
    if (!result.ok) throw new Error("expected a usable product")
    expect(result.assumptions.some((a) => a.includes("weight"))).toBe(true)
    expect(result.product.weightTier).toBe("standard")
  })

  it("says when the price is an average and when the listing is dormant", () => {
    const result = toAnalysisInput(fixture("no-buybox.json"), "amazon.ca", 0)
    if (!result.ok) throw new Error("expected a usable product")
    expect(result.assumptions.some((a) => a.includes("90-day average"))).toBe(true)
    expect(result.assumptions.some((a) => a.includes("dormant"))).toBe(true)
    expect(result.quality.livePrice).toBe(false)
  })

  it("returns a typed not-found rather than pricing an all -1 product", () => {
    const result = toAnalysisInput(fixture("all-missing.json"), "amazon.ca", 0)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("not-found")
  })

  it("flags a spike so margin is not computed against a price that reverts", () => {
    const result = toAnalysisInput(fixture("price-spike.json"), "amazon.ca", 0)
    if (!result.ok) throw new Error("expected a usable product")
    expect(result.priceSpike).toBe(true)
    // Sourcing prices at the 90-day average, so the spike does not inflate it.
    expect(result.product.salePrice).toBe(32)
  })

  it("never claims live fees, whatever Keepa returned", () => {
    const result = toAnalysisInput(fixture("super-tips-t2.json"), "amazon.ca", 12)
    if (!result.ok) throw new Error("expected a usable product")
    expect(result.quality.liveFees).toBe(false)
    expect(result.quality.livePrice).toBe(true)
    expect(result.quality.sellerEnteredCost).toBe(true)
  })

  it("stores inputs, never a conclusion", () => {
    // Changing the ROI floor re-prices with nothing to invalidate.
    const result = toAnalysisInput(fixture("super-tips-t2.json"), "amazon.ca", 15)
    if (!result.ok) throw new Error("expected a usable product")
    expect(result.product).not.toHaveProperty("verdict")
    expect(result.product).not.toHaveProperty("buyBelow")
    const strict = review(result.product, { ...seller, minRoi: 0.5 }, { ...DEFAULT_CRITERIA, minRoi: 0.5 }, result.signals, result.quality)
    const loose = review(result.product, { ...seller, minRoi: 0.3 }, DEFAULT_CRITERIA, result.signals, result.quality)
    expect(strict.analysis.buyBelow).toBeLessThan(loose.analysis.buyBelow)
  })
})

describe("weight bands", () => {
  it("maps grams to the fee table's tiers", () => {
    expect(weightTierFromGrams(80)).toBe("envelope")
    expect(weightTierFromGrams(250)).toBe("small")
    expect(weightTierFromGrams(810)).toBe("standard")
    expect(weightTierFromGrams(4000)).toBe("large")
    expect(weightTierFromGrams(12000)).toBe("oversize")
  })
})

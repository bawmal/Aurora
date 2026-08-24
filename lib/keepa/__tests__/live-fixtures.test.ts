import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  amazonPresent,
  buyBoxRequested,
  fbaOfferCount,
  hasUsableData,
  monthlyDemand,
  monthlyRankProfile,
  offerCount,
  priceSpikeRisk,
  resolveSalePrice,
  salesRank,
} from "../parse"
import { STAT } from "../types"
import type { KeepaProduct, KeepaResponse } from "../types"
import { toAnalysisInput } from "@/lib/analysis/from-keepa"
import { analyseSeasonality, demandSparkline } from "@/lib/domain/seasonality"

/**
 * These fixtures are real Keepa responses, captured on 2026-08-12 against
 * amazon.ca. They replace the hand-built ones for anything where the guess
 * and the reality differ — and on the first live call, several did.
 */

const DIR = join(process.cwd(), "tests/fixtures/keepa")

function load(name: string): KeepaProduct {
  const body = JSON.parse(readFileSync(join(DIR, name), "utf8")) as KeepaResponse
  const product = body.products?.[0]
  if (!product) throw new Error(`fixture ${name} has no product`)
  return product
}

const basic = load("live-t1-basic.json")
const buybox = load("live-buybox.json")
const offers = load("live-offers.json")
const history = load("live-history.json")
const notFound = load("live-not-found.json")

describe("a real basic response", () => {
  it("has no buy box at all, which is not the same as having no buy box", () => {
    // The documented plan read the buy box from a cheap lookup. Keepa does
    // not send it: index 18 is -1 and buyBoxPrice is -2, meaning unrequested.
    expect(basic.stats?.current?.[STAT.buyBoxPrice]).toBe(-1)
    expect(basic.stats?.buyBoxPrice).toBe(-2)
    expect(buyBoxRequested(basic)).toBe(false)
    expect(buyBoxRequested(buybox)).toBe(true)
  })

  it("falls through to the lowest new offer and says so", () => {
    const price = resolveSalePrice(basic, "sourcing")
    expect(price.source).toBe("new90")
    expect(price.value).toBeCloseTo(32.66, 2)
    expect(price.buyBoxUnrequested).toBe(true)
    expect(price.stale).toBe(false)
  })

  it("still carries rank, offers and demand", () => {
    expect(salesRank(basic)).toBeGreaterThan(0)
    expect(offerCount(basic)).toBe(19)
    expect(monthlyDemand(basic)).toBe(300)
    // FBA/FBM split is an offers-tier field, so null rather than zero here.
    expect(fbaOfferCount(basic)).toBeNull()
    expect(fbaOfferCount(offers)).toBe(8)
  })

  it("reads Amazon as absent from the Amazon price alone", () => {
    // buyBoxIsAmazon is null below the buy-box tier: unknown, not false.
    expect(basic.stats?.buyBoxIsAmazon).toBeNull()
    expect(amazonPresent(basic)).toBe(false)
    expect(buybox.stats?.buyBoxIsAmazon).toBe(false)
    expect(amazonPresent(buybox)).toBe(false)
  })

  it("can still spot a price spike without the buy box", () => {
    // Comparing buy box to buy box would return false on every cheap lookup,
    // silently suppressing the warning where it is needed most.
    expect(priceSpikeRisk(basic)).toBe(false)
    const current = [...(basic.stats?.current ?? [])]
    current[STAT.newPrice] = 9999
    const spiked: KeepaProduct = { ...basic, stats: { ...basic.stats, current } }
    expect(priceSpikeRisk(spiked)).toBe(true)
  })
})

describe("a real buy-box response", () => {
  it("prices off the box once it has been paid for", () => {
    expect(buybox.stats?.buyBoxPrice).toBeGreaterThan(0)
    const price = resolveSalePrice(buybox, "listing")
    expect(price.source).toBe("buyBox")
    expect(price.buyBoxUnrequested).toBe(false)
  })
})

describe("a real unknown asin", () => {
  it("answers 200 with a null title and every stat missing", () => {
    // Not a 404. Treating -1 as a price here is how a dead listing gets a
    // buy-below.
    expect(notFound.title ?? null).toBeNull()
    expect(hasUsableData(notFound)).toBe(false)
    const result = toAnalysisInput(notFound, "amazon.ca", 0)
    expect(result.ok).toBe(false)
  })
})

describe("a real history response", () => {
  it("yields twelve months of rank and a legible shape", () => {
    const profile = monthlyRankProfile(history, 2025)
    expect(profile.filter((m) => m !== null)).toHaveLength(12)
    const season = analyseSeasonality(profile)
    expect(season.classification).not.toBe("unknown")
    expect(demandSparkline(profile)).toHaveLength(12)
  })

  it("costs the same one token as a bare lookup, so it is on by default", () => {
    const bareBody = JSON.parse(
      readFileSync(join(DIR, "live-t1-basic.json"), "utf8"),
    ) as KeepaResponse
    const historyBody = JSON.parse(
      readFileSync(join(DIR, "live-history.json"), "utf8"),
    ) as KeepaResponse
    expect(historyBody.tokensConsumed).toBe(bareBody.tokensConsumed)
  })
})

describe("the analysis adapter on real data", () => {
  it("produces inputs a seller would recognise, and names its guesses", () => {
    const result = toAnalysisInput(history, "amazon.ca", 16.97)
    if (!result.ok) throw new Error("expected usable data")

    expect(result.product.category).toBe("toys-games")
    // 810g package, which lands in the standard band.
    expect(result.product.weightTier).toBe("standard")
    expect(result.product.salePrice).toBeCloseTo(32.66, 2)
    expect(result.signals.sellerCount).toBe(19)
    expect(result.signals.amazonOnListing).toBe(false)
    expect(result.demandPerMonth).toBe(300)
    expect(result.assumptions.join(" ")).toMatch(/buy box was not fetched/)
  })
})

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  amazonPresent,
  hasUsableData,
  monthlyDemand,
  monthlyRankProfile,
  offerCount,
  parseSeries,
  priceSpikeRisk,
  resolveSalePrice,
  salesRank,
} from "../parse"
import { STAT } from "../types"
import type { KeepaProduct, KeepaResponse } from "../types"

const DIR = join(process.cwd(), "tests/fixtures/keepa")

function fixture(name: string): KeepaProduct {
  const body = JSON.parse(readFileSync(join(DIR, name), "utf8")) as KeepaResponse
  const product = body.products?.[0]
  if (!product) throw new Error(`fixture ${name} has no product`)
  return product
}

describe("usable data", () => {
  it("treats an all -1 stats object as not found, not as free", () => {
    // A 200 is not usable data. This product is tracked but never sold.
    const product = fixture("all-missing.json")
    expect(hasUsableData(product)).toBe(false)
    expect(resolveSalePrice(product).value).toBeNull()
  })

  it("accepts a product with any real figure", () => {
    expect(hasUsableData(fixture("super-tips-t2.json"))).toBe(true)
  })

  it("does not treat a null title as a missing product", () => {
    const dormant = fixture("no-buybox.json")
    expect(dormant.title).toBeNull()
    expect(hasUsableData(dormant)).toBe(true)
  })
})

describe("price resolution", () => {
  it("sources at the 90-day average, not today's price", () => {
    // Buying stock that sells over weeks: today's price is noise.
    const price = resolveSalePrice(fixture("super-tips-t2.json"), "sourcing")
    expect(price.value).toBe(32.65)
    expect(price.source).toBe("buyBox90")
    expect(price.stale).toBe(false)
  })

  it("reads the live box when the question is what it pays now", () => {
    const price = resolveSalePrice(fixture("super-tips-t2.json"), "listing")
    expect(price.value).toBe(31.99)
    expect(price.source).toBe("buyBox")
  })

  it("flags a dormant listing whatever the intent", () => {
    for (const intent of ["sourcing", "listing"] as const) {
      const price = resolveSalePrice(fixture("no-buybox.json"), intent)
      expect(price.stale).toBe(true)
      // It still returns the only figure there is, rather than nothing.
      expect(price.value).toBe(45.99)
      expect(price.source).toBe("new90")
    }
  })
})

describe("amazon presence", () => {
  it("catches Amazon by its price entry", () => {
    const product = fixture("amazon-by-price.json")
    expect(product.stats?.buyBoxIsAmazon).toBeNull()
    expect(amazonPresent(product)).toBe(true)
  })

  it("catches Amazon by the buy box flag with no price entry", () => {
    // Checking only stats.current[0] misses this case entirely.
    const product = fixture("amazon-by-buybox.json")
    expect(product.stats?.current?.[STAT.amazonPrice]).toBe(-1)
    expect(amazonPresent(product)).toBe(true)
  })

  it("reports absence when neither signal is there", () => {
    expect(amazonPresent(fixture("super-tips-t2.json"))).toBe(false)
  })
})

describe("offers and demand", () => {
  it("distinguishes offers not requested from zero offers", () => {
    // -1 means we did not ask, which is missing data, not a dead listing.
    expect(offerCount(fixture("no-buybox.json"))).toBeNull()
    expect(offerCount(fixture("super-tips-t2.json"))).toBe(19)
  })

  it("prefers Amazon's own figure and falls back to rank drops", () => {
    expect(monthlyDemand(fixture("super-tips-t2.json"))).toBe(300)
    // A rank drop is a sale event, so drops approximate unit velocity.
    expect(monthlyDemand(fixture("price-spike.json"))).toBe(42)
  })

  it("returns nothing rather than a guess when neither is present", () => {
    expect(monthlyDemand(fixture("amazon-by-price.json"))).toBeNull()
  })
})

describe("price spike", () => {
  it("flags a current price well above its 90-day average", () => {
    // 49.99 against a 32.00 average: it reverts before the stock lands.
    expect(priceSpikeRisk(fixture("price-spike.json"))).toBe(true)
  })

  it("does not flag a stable listing", () => {
    expect(priceSpikeRisk(fixture("super-tips-t2.json"))).toBe(false)
  })
})

describe("history", () => {
  it("walks flat time/value pairs and drops sentinels", () => {
    const points = parseSeries(fixture("super-tips-t2.json"), STAT.salesRank)
    expect(points).toHaveLength(24)
    expect(points[0].at.getUTCFullYear()).toBe(2025)
    expect(points.every((p) => p.value > 0)).toBe(true)
  })

  it("buckets a year of rank into twelve months", () => {
    const profile = monthlyRankProfile(fixture("super-tips-t2.json"), 2025)
    expect(profile).toEqual([1204, 3157, 328, 419, 327, 311, 635, 497, 363, 557, 1327, 1399])
  })

  it("returns nulls for a year with no data rather than zeros", () => {
    // An absent month is not a zero-demand month.
    expect(monthlyRankProfile(fixture("super-tips-t2.json"), 2019)).toEqual(
      Array.from({ length: 12 }, () => null),
    )
  })

  it("has no history without a history-tier response", () => {
    expect(parseSeries(fixture("amazon-by-price.json"), STAT.salesRank)).toEqual([])
  })

  it("reads current rank from stats", () => {
    expect(salesRank(fixture("super-tips-t2.json"))).toBe(910)
  })
})

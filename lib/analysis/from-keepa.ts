import type {
  DataQuality,
  MarketSignals,
  Marketplace,
  ProductInput,
  WeightTier,
} from "@/lib/domain/types"
import { analyseSeasonality } from "@/lib/domain/seasonality"
import type { SeasonalProfile } from "@/lib/domain/seasonality"
import { isKnownCategory } from "@/lib/domain/fees"
import type { KeepaProduct, PriceIntent } from "@/lib/keepa/types"
import { DEFAULT_WEIGHT_GRAMS } from "@/lib/keepa/types"
import {
  amazonPresent,
  categoryName,
  fbaOfferCount,
  hasUsableData,
  monthlyDemand,
  monthlyRankProfile,
  offerCount,
  priceSpikeRisk,
  resolveSalePrice,
  salesRank,
  salesRank90dAvg,
} from "@/lib/keepa/parse"

/**
 * Turns a Keepa product into the inputs the pure domain expects. It decides
 * nothing: no verdict, no confidence, no buy-below. Those are computed from
 * these inputs on every read, which is what lets a seller change their ROI
 * floor and have the whole library re-price with nothing to invalidate.
 */

export interface KeepaAnalysisInput {
  product: ProductInput
  signals: MarketSignals
  quality: DataQuality
  /**
   * Every default we had to invent. Surfaced, never silent: a guessed weight
   * moves the FBA fee and therefore the number the seller acts on.
   */
  assumptions: string[]
  demandPerMonth: number | null
  priceSpike: boolean
  /**
   * Twelve monthly average ranks and what they mean. History costs the same
   * one token as a bare lookup, so withholding this saves nothing.
   */
  season: { year: number; monthlyRank: (number | null)[]; profile: SeasonalProfile } | null
}

export type KeepaAnalysisFailure = { reason: "not-found" | "no-price" }

export type KeepaAnalysisResult =
  | ({ ok: true } & KeepaAnalysisInput)
  | ({ ok: false } & KeepaAnalysisFailure)

/** Amazon's own category names mapped to our fee-table slugs. */
const CATEGORY_SLUGS: Record<string, string> = {
  "Toys & Games": "toys-games",
  "Home & Kitchen": "home-kitchen",
  Beauty: "beauty",
  "Beauty & Personal Care": "beauty",
  "Grocery & Gourmet Food": "grocery",
  "Health & Personal Care": "health-personal-care",
  "Health & Household": "health-personal-care",
  Electronics: "consumer-electronics",
  "Office Products": "office-products",
  "Pet Supplies": "pet-supplies",
  "Sports & Outdoors": "sports-outdoors",
  "Tools & Home Improvement": "tools-home-improvement",
  Books: "books",
}

/** Grams to the fee table's bands. */
export function weightTierFromGrams(grams: number): WeightTier {
  if (grams <= 100) return "envelope"
  if (grams <= 250) return "small"
  if (grams <= 1000) return "standard"
  if (grams <= 9000) return "large"
  return "oversize"
}

export function toAnalysisInput(
  keepa: KeepaProduct,
  marketplace: Marketplace,
  unitCost: number,
  options: { intent?: PriceIntent; historyYear?: number; signalAgeDays?: number } = {},
): KeepaAnalysisResult {
  if (!hasUsableData(keepa)) return { ok: false, reason: "not-found" }

  const price = resolveSalePrice(keepa, options.intent ?? "sourcing")
  if (price.value === null) return { ok: false, reason: "no-price" }

  const assumptions: string[] = []

  const grams = keepa.packageWeight ?? null
  if (grams === null) {
    assumptions.push(
      `weight not published, assumed ${DEFAULT_WEIGHT_GRAMS}g, which sets the FBA fee`,
    )
  }
  const weightTier = weightTierFromGrams(grams ?? DEFAULT_WEIGHT_GRAMS)

  const amazonCategory = categoryName(keepa)
  const category = amazonCategory ? (CATEGORY_SLUGS[amazonCategory] ?? amazonCategory) : ""
  if (!isKnownCategory(category)) {
    assumptions.push(
      amazonCategory
        ? `no fee rate on file for "${amazonCategory}", used the 15% default`
        : "no category returned, used the 15% default referral rate",
    )
  }

  if (price.source === "buyBox90" || price.source === "new90") {
    assumptions.push("priced at the 90-day average, not today's buy box")
  }
  if (price.buyBoxUnrequested) {
    // The buy box is a paid extra. Saying "buy box" when we read the lowest
    // new offer would overstate what we know about what the listing pays.
    assumptions.push(
      "priced off the lowest new offer; the buy box was not fetched, and Amazon presence is read from the Amazon price alone",
    )
  }
  if (price.stale) {
    assumptions.push("no live price on the listing; it may be dormant")
  }

  // The most recent complete year: the current one is a partial shape, and a
  // half-drawn season reads as a product that dies every August.
  const year = options.historyYear ?? new Date().getUTCFullYear() - 1
  const monthlyRank = monthlyRankProfile(keepa, year)
  const hasHistory = monthlyRank.some((month) => month !== null)
  const profile = hasHistory ? analyseSeasonality(monthlyRank) : null
  const seasonality = profile?.classification ?? ("unknown" as const)

  const product: ProductInput = {
    asin: keepa.asin,
    marketplace,
    category,
    salePrice: price.value,
    weightTier,
    unitCost,
  }

  const signals: MarketSignals = {
    salesRank: salesRank(keepa),
    salesRank90dAvg: salesRank90dAvg(keepa),
    sellerCount: offerCount(keepa),
    fbaSellerCount: fbaOfferCount(keepa),
    amazonOnListing: amazonPresent(keepa),
    seasonality,
  }

  const quality: DataQuality = {
    livePrice: !price.stale,
    // Fees still come from our table rather than SP-API, whatever Keepa gave us.
    liveFees: false,
    sellerEnteredCost: unitCost > 0,
    landedCostsEntered: false,
    knownCategory: isKnownCategory(category),
    historyDays: monthlyRank.filter((month) => month !== null).length * 30,
    signalAgeDays: options.signalAgeDays ?? 0,
  }

  return {
    ok: true,
    product,
    signals,
    quality,
    assumptions,
    demandPerMonth: monthlyDemand(keepa),
    priceSpike: priceSpikeRisk(keepa),
    season: profile ? { year, monthlyRank, profile } : null,
  }
}

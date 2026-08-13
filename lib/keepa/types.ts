import type { Marketplace } from "@/lib/domain/types"

/**
 * The shape Keepa actually returns, and the constants that make it legible.
 * Nothing here talks to the network; the client does that and hands the
 * decoded body to the pure parsers.
 */

/**
 * Keepa bills per call and richer requests cost more, so the tier is a
 * unit-economics decision made per use, not a default.
 */
export type KeepaTier = "basic" | "history" | "offers"

/** How long each tier's answer stays true. Tuned to how fast the data moves. */
export const TIER_TTL_MINUTES: Record<KeepaTier, number> = {
  // Price and rank move intraday.
  basic: 6 * 60,
  // A product's seasonal shape does not change week to week. Re-deriving it
  // on every page view is pure waste.
  history: 30 * 24 * 60,
  offers: 24 * 60,
}

/** One request for twenty ASINs costs far less than twenty requests. */
export const BATCH_SIZE = 20

/** Below this, stop spending and serve cache with a notice. */
export const TOKEN_FLOOR = 20

export const KEEPA_DOMAIN: Record<Marketplace, number> = {
  "amazon.com": 1,
  "amazon.co.uk": 2,
  "amazon.ca": 6,
}

/**
 * Fixed indices into `stats` and `csv`. Prices are in cents; -1 means no
 * data, which is not the same as zero.
 */
export const STAT = {
  amazonPrice: 0,
  newPrice: 1,
  usedPrice: 2,
  salesRank: 3,
  listPrice: 4,
  newOfferCount: 11,
  buyBoxPrice: 18,
} as const

/** Keepa counts minutes from 2011-01-01. */
export const KEEPA_EPOCH_MINUTES = 21_564_000

/**
 * Standard Large is the most common band for arbitrage stock, so it is the
 * least wrong default. It still moves the FBA fee, so callers must surface
 * the assumption rather than let it quietly falsify buy-below.
 */
export const DEFAULT_WEIGHT_GRAMS = 400

export type KeepaStatsArray = (number | null)[]

export interface KeepaStats {
  current?: KeepaStatsArray
  avg30?: KeepaStatsArray
  avg90?: KeepaStatsArray
  avg180?: KeepaStatsArray
  avg365?: KeepaStatsArray
  buyBoxIsAmazon?: boolean | null
  buyBoxIsFBA?: boolean | null
  salesRankDrops30?: number | null
  salesRankDrops90?: number | null
}

export interface KeepaProduct {
  asin: string
  domainId?: number
  /** Null on some stats-only responses. Not a missing product. */
  title?: string | null
  stats?: KeepaStats | null
  /** Present only when history=1. Flat [time, value, time, value] pairs. */
  csv?: (number[] | null)[] | null
  /** Amazon's own "bought in past month". Null more often than not. */
  monthlySold?: number | null
  /** Grams. Often null. */
  packageWeight?: number | null
  numberOfItems?: number | null
  upcList?: string[] | null
  eanList?: string[] | null
  categoryTree?: { catId?: number; name: string }[] | null
  listedSince?: number | null
  trackingSince?: number | null
}

export interface KeepaResponse {
  products?: KeepaProduct[]
  /** Watch this on every response. */
  tokensLeft?: number
  refillIn?: number
  refillRate?: number
  tokenFlowReduction?: number
}

/** What the price came from, so the caller can say so rather than imply live. */
export type PriceIntent = "sourcing" | "listing"

export interface ResolvedPrice {
  /** Currency units, not cents. Null when the listing has no usable price. */
  value: number | null
  source: "buyBox" | "buyBox90" | "new" | "new90" | "none"
  /**
   * No live price at all. The listing may be dormant, and a buy-below built
   * on a 90-day average alone should say so.
   */
  stale: boolean
}

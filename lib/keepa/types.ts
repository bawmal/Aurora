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
export type KeepaTier = "basic" | "history" | "buybox" | "offers"

/** How long each tier's answer stays true. Tuned to how fast the data moves. */
export const TIER_TTL_MINUTES: Record<KeepaTier, number> = {
  // Price and rank move intraday.
  basic: 6 * 60,
  // A product's seasonal shape does not change week to week. Re-deriving it
  // on every page view is pure waste.
  history: 30 * 24 * 60,
  buybox: 6 * 60,
  offers: 24 * 60,
}

/**
 * Tokens per product, measured live against amazon.ca on 2026-08-12 rather
 * than assumed. Two of these contradict the obvious guess:
 *
 * - History is free. `history=1` returns nine years of series for the same
 *   one token as a bare lookup, so seasonality costs bandwidth and latency,
 *   not money, and there is no reason to withhold it from a sweep.
 * - The buy box is not. Without `buybox=1` the buy-box stats are absent
 *   entirely, so a "basic" call prices off the lowest new offer.
 */
export const TIER_TOKEN_COST: Record<KeepaTier, number> = {
  basic: 1,
  history: 1,
  buybox: 3,
  offers: 5,
}

/**
 * Twenty per request. Tokens are billed per product either way — a batch of
 * five costs five — so this buys round trips and rate-limit headroom, not
 * money.
 */
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
  /**
   * -2 means the buy box was not requested, which is not the same as a
   * listing with no buy box. Without it there is no way to tell a price we
   * chose not to pay for from a price that does not exist.
   */
  buyBoxPrice?: number | null
  offerCountFBA?: number | null
  offerCountFBM?: number | null
  totalOfferCount?: number | null
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
  tokensConsumed?: number
  refillIn?: number
  refillRate?: number
  tokenFlowReduction?: number
  /**
   * Present on a 402. The body still carries `tokensLeft: 0`, which is a lie
   * about the account rather than a fact about it.
   */
  error?: { message?: string; type?: string }
}

/** What the price came from, so the caller can say so rather than imply live. */
export type PriceIntent = "sourcing" | "listing"

export interface ResolvedPrice {
  /** Currency units, not cents. Null when the listing has no usable price. */
  value: number | null
  source: "buyBox" | "buyBox90" | "new" | "new90" | "none"
  /** The buy box was never fetched, so "no buy box" here means "not asked". */
  buyBoxUnrequested: boolean
  /**
   * No live price at all. The listing may be dormant, and a buy-below built
   * on a 90-day average alone should say so.
   */
  stale: boolean
}

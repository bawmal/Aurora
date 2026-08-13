import type {
  KeepaProduct,
  KeepaStatsArray,
  PriceIntent,
  ResolvedPrice,
} from "./types"
import { KEEPA_EPOCH_MINUTES, STAT } from "./types"

/**
 * Pure decoding of a Keepa product. Every function here is total: a missing
 * field, a -1 sentinel or an absent series returns null rather than throwing
 * or, worse, returning a number that looks real.
 */

/** -1 is Keepa's "no data". Treating it as a price is the classic mistake. */
function value(stats: KeepaStatsArray | undefined, index: number): number | null {
  if (!stats) return null
  const raw = stats[index]
  if (raw === null || raw === undefined) return null
  return raw < 0 ? null : raw
}

/** Prices arrive in cents. */
function money(stats: KeepaStatsArray | undefined, index: number): number | null {
  const cents = value(stats, index)
  return cents === null ? null : cents / 100
}

export function keepaMinutesToDate(minutes: number): Date {
  return new Date((minutes + KEEPA_EPOCH_MINUTES) * 60 * 1000)
}

export interface SeriesPoint {
  at: Date
  value: number
}

/**
 * `csv` entries are flat [time, value, time, value] pairs, not tuples.
 * Sentinels are dropped rather than plotted as zero.
 */
export function parseSeries(product: KeepaProduct, index: number): SeriesPoint[] {
  const flat = product.csv?.[index]
  if (!flat) return []
  const points: SeriesPoint[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const raw = flat[i + 1]
    if (raw < 0) continue
    points.push({ at: keepaMinutesToDate(flat[i]), value: raw })
  }
  return points
}

/**
 * A 200 is not usable data. Products exist with a complete stats object where
 * every value is -1: tracked but never sold, or region-mismatched. Callers
 * return a typed not-found rather than pricing a listing that has no prices.
 */
export function hasUsableData(product: KeepaProduct): boolean {
  const stats = product.stats
  if (!stats) return false
  const anyReal = [stats.current, stats.avg30, stats.avg90, stats.avg180, stats.avg365]
    .filter((a): a is KeepaStatsArray => Array.isArray(a))
    .some((a) => a.some((v) => v !== null && v !== undefined && v >= 0))
  return anyReal
}

/**
 * Which price you analyse at is a product decision.
 *
 * `sourcing` prefers the 90-day average: you are buying stock that will sell
 * over weeks, so today's price is noise and a buy-below computed against a
 * spike is a number that will not exist when the stock lands.
 *
 * `listing` prefers the current buy box, because the question is what the box
 * pays right now.
 */
export function resolveSalePrice(
  product: KeepaProduct,
  intent: PriceIntent = "sourcing",
): ResolvedPrice {
  const stats = product.stats ?? {}
  const candidates: { value: number | null; source: ResolvedPrice["source"] }[] =
    intent === "sourcing"
      ? [
          { value: money(stats.avg90, STAT.buyBoxPrice), source: "buyBox90" },
          { value: money(stats.avg90, STAT.newPrice), source: "new90" },
          { value: money(stats.current, STAT.buyBoxPrice), source: "buyBox" },
          { value: money(stats.current, STAT.newPrice), source: "new" },
        ]
      : [
          { value: money(stats.current, STAT.buyBoxPrice), source: "buyBox" },
          { value: money(stats.current, STAT.newPrice), source: "new" },
          { value: money(stats.avg90, STAT.buyBoxPrice), source: "buyBox90" },
          { value: money(stats.avg90, STAT.newPrice), source: "new90" },
        ]

  // Staleness is a property of the listing, not of the intent: no current buy
  // box and no current new price means nothing live to read either way.
  const stale =
    money(stats.current, STAT.buyBoxPrice) === null &&
    money(stats.current, STAT.newPrice) === null

  const hit = candidates.find((c) => c.value !== null)
  if (!hit || hit.value === null) return { value: null, source: "none", stale: true }
  return { value: hit.value, source: hit.source, stale }
}

/**
 * Both checks are required. Amazon frequently holds the buy box with no
 * separate Amazon price entry, and equally often lists a price while a third
 * party holds the box. Checking one misses about half of real cases, and
 * Amazon on the listing is the commonest reason to reject a good product.
 */
export function amazonPresent(product: KeepaProduct): boolean {
  const stats = product.stats ?? {}
  return money(stats.current, STAT.amazonPrice) !== null || stats.buyBoxIsAmazon === true
}

export function salesRank(product: KeepaProduct): number | null {
  return value(product.stats?.current, STAT.salesRank)
}

export function salesRank90dAvg(product: KeepaProduct): number | null {
  return value(product.stats?.avg90, STAT.salesRank)
}

/**
 * -1 on the offer count means offers were *not requested*, not that there are
 * none. Zero offers is a dead listing; unrequested is missing data, and they
 * lead to opposite decisions.
 */
export function offerCount(product: KeepaProduct): number | null {
  return value(product.stats?.current, STAT.newOfferCount)
}

/**
 * A rank drop is a sale event: rank improves sharply when a unit sells, so
 * counting drops approximates unit velocity. It understates high-volume items
 * but ranks products correctly against each other.
 *
 * Never substitute raw sales rank for this. Rank 500 in Toys and rank 500 in
 * Electronics are wildly different volumes.
 */
export function monthlyDemand(product: KeepaProduct): number | null {
  return product.monthlySold ?? product.stats?.salesRankDrops30 ?? null
}

/**
 * A current price well above its 90-day average usually reverts before the
 * stock arrives, leaving margin computed against a price that no longer
 * exists.
 */
export function priceSpikeRisk(product: KeepaProduct): boolean {
  const now = money(product.stats?.current, STAT.buyBoxPrice)
  const avg = money(product.stats?.avg90, STAT.buyBoxPrice)
  if (now === null || avg === null || avg <= 0) return false
  return now > avg * 1.25
}

export function categoryName(product: KeepaProduct): string | null {
  return product.categoryTree?.[0]?.name ?? null
}

/**
 * Twelve monthly average ranks for a calendar year, Jan to Dec, null where
 * there is no data. An absent month is not a zero-demand month.
 *
 * Requires a history-tier response.
 */
export function monthlyRankProfile(
  product: KeepaProduct,
  year: number,
): (number | null)[] {
  const totals = Array.from({ length: 12 }, () => ({ sum: 0, count: 0 }))
  for (const point of parseSeries(product, STAT.salesRank)) {
    if (point.at.getUTCFullYear() !== year) continue
    const bucket = totals[point.at.getUTCMonth()]
    bucket.sum += point.value
    bucket.count += 1
  }
  return totals.map((b) => (b.count === 0 ? null : Math.round(b.sum / b.count)))
}

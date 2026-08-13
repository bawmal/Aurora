import type { KeepaProduct, KeepaTier } from "./types"
import { TIER_TTL_MINUTES } from "./types"

/**
 * Cache policy, kept pure so the TTL rules are testable without a database.
 * The store that holds the entries is a separate concern.
 */

export interface CacheEntry {
  key: string
  tier: KeepaTier
  fetchedAt: Date
  product: KeepaProduct
}

/**
 * Keyed on what identifies the data, never on the request URL: the URL
 * carries the API key, which must not end up in a cache table.
 */
export function cacheKey(asin: string, domain: number, tier: KeepaTier): string {
  return `${asin}:${domain}:${tier}`
}

export function isFresh(entry: CacheEntry, now: Date): boolean {
  const ageMinutes = (now.getTime() - entry.fetchedAt.getTime()) / 60_000
  return ageMinutes < TIER_TTL_MINUTES[entry.tier]
}

/**
 * A stale entry is still the best answer available when tokens run out, so
 * expiry means "refetch if you can", never "delete".
 */
export function servableWhenBroke(entry: CacheEntry | null): entry is CacheEntry {
  return entry !== null
}

export function ageInMinutes(entry: CacheEntry, now: Date): number {
  return Math.max(0, Math.round((now.getTime() - entry.fetchedAt.getTime()) / 60_000))
}

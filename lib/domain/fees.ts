import type { Marketplace, WeightTier } from "./types"

/**
 * Fee tables live in code, not the database, so CI validates them and a
 * change shows up in review. Figures are indicative and must be reconciled
 * against Amazon's published schedules per marketplace before launch.
 */

const DEFAULT_REFERRAL = 0.15

const REFERRAL_BY_CATEGORY: Record<string, number> = {
  "amazon-device-accessories": 0.45,
  "beauty": 0.08,
  "books": 0.15,
  "cell-phone-devices": 0.08,
  "consumer-electronics": 0.08,
  "grocery": 0.08,
  "health-personal-care": 0.08,
  "home-kitchen": 0.15,
  "jewelry": 0.2,
  "office-products": 0.15,
  "pet-supplies": 0.15,
  "sports-outdoors": 0.15,
  "tools-home-improvement": 0.15,
  "toys-games": 0.15,
}

/**
 * Categories where the referral rate steps at a price point. Rate applies to
 * the portion of the price above the threshold.
 */
const REFERRAL_TIERS: Record<string, { upTo: number; low: number; high: number }> = {
  beauty: { upTo: 10, low: 0.08, high: 0.15 },
  "health-personal-care": { upTo: 10, low: 0.08, high: 0.15 },
  grocery: { upTo: 15, low: 0.08, high: 0.15 },
}

const FULFILMENT_BY_TIER: Record<Marketplace, Record<WeightTier, number>> = {
  "amazon.com": {
    envelope: 3.06,
    small: 3.7,
    standard: 5.16,
    large: 9.61,
    oversize: 26.33,
  },
  "amazon.ca": {
    envelope: 3.6,
    small: 4.68,
    standard: 6.55,
    large: 11.9,
    oversize: 31.4,
  },
  "amazon.co.uk": {
    envelope: 1.85,
    small: 2.42,
    standard: 3.05,
    large: 5.4,
    oversize: 14.2,
  },
}

export function referralFee(category: string, salePrice: number): number {
  const tier = REFERRAL_TIERS[category]
  if (tier) {
    const below = Math.min(salePrice, tier.upTo)
    const above = Math.max(0, salePrice - tier.upTo)
    return round(below * tier.low + above * tier.high)
  }
  const rate = REFERRAL_BY_CATEGORY[category] ?? DEFAULT_REFERRAL
  return round(salePrice * rate)
}

export function fulfilmentFee(marketplace: Marketplace, tier: WeightTier): number {
  return FULFILMENT_BY_TIER[marketplace][tier]
}

export function referralRate(category: string): number {
  return REFERRAL_BY_CATEGORY[category] ?? DEFAULT_REFERRAL
}

export function isKnownCategory(category: string): boolean {
  return category in REFERRAL_BY_CATEGORY
}

export function round(n: number): number {
  return Math.round(n * 100) / 100
}

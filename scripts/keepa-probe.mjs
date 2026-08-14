#!/usr/bin/env node
/**
 * Measures what a Keepa tier actually costs, against the live API.
 *
 *   KEEPA_API_KEY=… node scripts/keepa-probe.mjs B071CP6X88
 *
 * Spends real tokens — roughly ten for a full sweep of the four tiers — so it
 * is a deliberate command, never part of the test suite. It exists because
 * the tier costs in lib/keepa/types.ts are measurements, and a measurement
 * that cannot be repeated is a number nobody will trust in six months.
 *
 * Prints one line per tier: tokens consumed, tokens left, payload size, and
 * whether the buy box came back. Nothing it prints contains the key.
 */

const TIERS = {
  basic: { stats: "90", history: "0" },
  history: { stats: "90", history: "1" },
  buybox: { stats: "90", history: "0", buybox: "1" },
  offers: { stats: "90", history: "0", buybox: "1", offers: "20" },
}

const key = process.env.KEEPA_API_KEY
if (!key) {
  console.error("Set KEEPA_API_KEY. This script spends tokens.")
  process.exit(1)
}

const asin = process.argv[2] ?? "B071CP6X88"
const domain = process.argv[3] ?? "6"

for (const [tier, extra] of Object.entries(TIERS)) {
  const params = new URLSearchParams({ key, domain, asin, ...extra })
  const started = Date.now()
  const response = await fetch(`https://api.keepa.com/product?${params}`)
  const body = await response.json()

  if (body.error) {
    console.error(`${tier}: ${body.error.message}`)
    break
  }

  const stats = body.products?.[0]?.stats ?? {}
  console.log(
    [
      tier.padEnd(8),
      `${String(body.tokensConsumed).padStart(2)} tokens`,
      `${String(body.tokensLeft).padStart(4)} left`,
      `${String(Math.round(JSON.stringify(body).length / 1024)).padStart(4)} kB`,
      `${Date.now() - started}ms`,
      stats.buyBoxPrice === -2 ? "no buy box" : `buy box ${stats.buyBoxPrice}`,
    ].join("  "),
  )
}

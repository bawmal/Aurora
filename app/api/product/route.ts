import { NextResponse } from "next/server"
import { KeepaClient, KeepaTokensExhausted } from "@/lib/keepa/client"
import { KEEPA_DOMAIN } from "@/lib/keepa/types"
import type { KeepaTier } from "@/lib/keepa/types"
import { toAnalysisInput } from "@/lib/analysis/from-keepa"
import { MARKETPLACES } from "@/lib/domain/types"
import type { Marketplace } from "@/lib/domain/types"

/**
 * Server-side so the Keepa key never reaches the browser. Returns the inputs
 * to an analysis, never a verdict: the verdict is computed from the seller's
 * own criteria, which the server has no business deciding.
 */

export const runtime = "nodejs"

const ASIN = /^[A-Z0-9]{10}$/

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const asin = (params.get("asin") ?? "").trim().toUpperCase()
  const marketplace = params.get("marketplace") as Marketplace | null
  const tier = (params.get("tier") ?? "basic") as KeepaTier
  const unitCost = Number.parseFloat(params.get("unitCost") ?? "0")

  if (!ASIN.test(asin)) {
    return NextResponse.json({ error: "Not an ASIN. Ten letters or digits." }, { status: 400 })
  }
  if (!marketplace || !MARKETPLACES.includes(marketplace)) {
    return NextResponse.json({ error: "Unknown marketplace." }, { status: 400 })
  }

  const apiKey = process.env.KEEPA_API_KEY
  if (!apiKey) {
    // Analysis still works on typed numbers, so this is a degraded path and
    // not an error the seller has to solve.
    return NextResponse.json(
      { error: "No Keepa key configured. Enter the numbers by hand for now." },
      { status: 503 },
    )
  }

  try {
    // Overridable so the path can be exercised against a fixture server
    // without spending tokens on a live call.
    const client = new KeepaClient({ apiKey, baseUrl: process.env.KEEPA_BASE_URL })
    const { products, lowTokens } = await client.products(
      [asin],
      KEEPA_DOMAIN[marketplace],
      tier,
    )
    const product = products[0]
    if (!product) {
      return NextResponse.json({ error: `Keepa has nothing for ${asin}.` }, { status: 404 })
    }

    const result = toAnalysisInput(product, marketplace, Number.isFinite(unitCost) ? unitCost : 0)
    if (!result.ok) {
      const message =
        result.reason === "not-found"
          ? `${asin} is tracked but has never sold on this marketplace.`
          : `${asin} has no usable price.`
      return NextResponse.json({ error: message }, { status: 404 })
    }

    return NextResponse.json({
      title: product.title ?? null,
      ...result,
      lowTokens,
    })
  } catch (error) {
    if (error instanceof KeepaTokensExhausted) {
      return NextResponse.json(
        { error: "Keepa tokens are exhausted. Try again shortly." },
        { status: 429 },
      )
    }
    // Never echo the upstream URL: it carries the key.
    return NextResponse.json({ error: "Keepa lookup failed." }, { status: 502 })
  }
}

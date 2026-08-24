import { gunzipSync } from "node:zlib"
import type { KeepaProduct, KeepaResponse, KeepaTier } from "./types"
import { BATCH_SIZE, TOKEN_FLOOR } from "./types"

/**
 * The only module that talks to Keepa. Server-side only: the API key must
 * never reach the browser, and the request URL that carries it must never be
 * logged or used as a cache key.
 *
 * `fetch` is injected so the client can be tested against fixtures. Live
 * calls cost real money, so tests must not make them.
 */

export interface KeepaClientOptions {
  apiKey: string
  fetchImpl?: typeof fetch
  baseUrl?: string
}

export interface KeepaFetchResult {
  products: KeepaProduct[]
  tokensLeft: number | null
  /** What this call actually cost, for the per-seller cost model. */
  tokensConsumed: number
  /** True when the account is close enough to empty to stop spending. */
  lowTokens: boolean
}

export class KeepaTokensExhausted extends Error {
  constructor(readonly tokensLeft: number) {
    super(`Keepa tokens exhausted (${tokensLeft} left); serve cache`)
    this.name = "KeepaTokensExhausted"
  }
}

/**
 * A rejected key answers 402 with `tokensLeft: 0`. Read that as exhaustion
 * and every future session backs off from a full account, waiting for a
 * refill that already happened.
 */
export class KeepaAuthError extends Error {
  constructor(readonly detail: string) {
    super(`Keepa rejected the API key: ${detail}`)
    this.name = "KeepaAuthError"
  }
}

const DEFAULT_BASE = "https://api.keepa.com"

export class KeepaClient {
  private readonly apiKey: string
  private readonly fetchImpl: typeof fetch
  private readonly baseUrl: string

  constructor(options: KeepaClientOptions) {
    this.apiKey = options.apiKey
    this.fetchImpl = options.fetchImpl ?? fetch
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE
  }

  /**
   * One call for up to twenty ASINs. Tokens are billed per product, so this
   * saves round trips and rate-limit headroom rather than money.
   */
  async products(
    asins: string[],
    domain: number,
    tier: KeepaTier = "basic",
  ): Promise<KeepaFetchResult> {
    const products: KeepaProduct[] = []
    let tokensLeft: number | null = null
    let tokensConsumed = 0

    for (const batch of chunk(asins, BATCH_SIZE)) {
      const response = await this.request(batch, domain, tier)
      products.push(...(response.products ?? []))
      tokensLeft = response.tokensLeft ?? tokensLeft
      tokensConsumed += response.tokensConsumed ?? 0
      if (tokensLeft !== null && tokensLeft < TOKEN_FLOOR) {
        // Stop before the account is empty rather than after: the remaining
        // tokens are worth more as headroom for a seller mid-analysis.
        if (products.length === 0) throw new KeepaTokensExhausted(tokensLeft)
        break
      }
    }

    return {
      products,
      tokensLeft,
      tokensConsumed,
      lowTokens: tokensLeft !== null && tokensLeft < TOKEN_FLOOR,
    }
  }

  private async request(
    asins: string[],
    domain: number,
    tier: KeepaTier,
  ): Promise<KeepaResponse> {
    const params = new URLSearchParams({
      key: this.apiKey,
      domain: String(domain),
      asin: asins.join(","),
    })
    params.set("stats", "90")
    params.set("history", tier === "history" ? "1" : "0")
    // The buy box costs two extra tokens and is absent without this, which is
    // why the cheap tier prices off the lowest new offer instead.
    if (tier === "buybox" || tier === "offers") params.set("buybox", "1")
    if (tier === "offers") params.set("offers", "20")

    const response = await this.fetchImpl(`${this.baseUrl}/product?${params}`)
    let body: KeepaResponse
    try {
      body = decodeBody(await response.arrayBuffer())
    } catch {
      // A gateway or proxy in front of Keepa answers HTML, not JSON.
      throw new Error(`Keepa request failed: HTTP ${response.status}, unreadable body`)
    }

    if (!response.ok || body.error) {
      // Never include the URL: it carries the key.
      const detail = body.error?.message ?? `HTTP ${response.status}`
      if (response.status === 402 || body.error?.type === "unauthorized") {
        throw new KeepaAuthError(detail)
      }
      throw new Error(`Keepa request failed: ${detail}`)
    }
    return body
  }
}

/**
 * Responses may arrive gzipped with no reliable content-encoding header, and
 * the failure looks nothing like a compression problem: it surfaces as a
 * UTF-8 decode error on byte 0x8b. Sniff the magic number instead of trusting
 * the header.
 */
export function decodeBody(body: ArrayBuffer): KeepaResponse {
  let bytes = Buffer.from(body)
  if (bytes.length > 1 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    bytes = gunzipSync(bytes)
  }
  return JSON.parse(bytes.toString("utf8")) as KeepaResponse
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { KeepaAuthError, KeepaClient, KeepaTokensExhausted, decodeBody } from "../client"
import { cacheKey, isFresh, ageInMinutes } from "../cache"
import type { CacheEntry } from "../cache"
import { BATCH_SIZE, KEEPA_DOMAIN } from "../types"

const DIR = join(process.cwd(), "tests/fixtures/keepa")

function body(name: string): ArrayBuffer {
  const buf = readFileSync(join(DIR, name))
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

function json(value: unknown): ArrayBuffer {
  const buf = Buffer.from(JSON.stringify(value))
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

function respondWith(name: string, calls: string[] = []): typeof fetch {
  return (async (url: string) => {
    calls.push(String(url))
    return { ok: true, status: 200, arrayBuffer: async () => body(name) }
  }) as unknown as typeof fetch
}

describe("decoding", () => {
  it("gunzips when the header lies", () => {
    // The failure mode without this is a UTF-8 decode error on byte 0x8b,
    // which looks nothing like a compression problem.
    const gz = decodeBody(body("super-tips-t2.json.gz"))
    const plain = decodeBody(body("super-tips-t2.json"))
    expect(gz.products?.[0].asin).toBe("B071CP6X88")
    expect(gz).toEqual(plain)
  })

  it("reads an uncompressed body", () => {
    expect(decodeBody(body("super-tips-t2.json")).tokensLeft).toBe(294)
  })
})

describe("client", () => {
  it("never puts the api key in an error message", async () => {
    const failing = (async () => ({
      ok: false,
      status: 429,
      arrayBuffer: async () => json({ error: { message: "too many requests" } }),
    })) as unknown as typeof fetch
    const client = new KeepaClient({ apiKey: "secret-key", fetchImpl: failing })
    await expect(client.products(["B071CP6X88"], 6)).rejects.toThrow(/too many requests/)
    await expect(client.products(["B071CP6X88"], 6)).rejects.not.toThrow(/secret-key/)
  })

  it("tells a rejected key apart from an empty account", async () => {
    // The real 402 body carries tokensLeft: 0. Believing it makes every
    // caller wait for a refill that is not coming.
    const rejected = (async () => ({
      ok: false,
      status: 402,
      arrayBuffer: async () =>
        json({
          error: { message: "Operation unauthorized. No active API plan found.", type: "unauthorized" },
          tokensLeft: 0,
        }),
    })) as unknown as typeof fetch
    const client = new KeepaClient({ apiKey: "bad", fetchImpl: rejected })
    const failure = client.products(["B071CP6X88"], 6)
    await expect(failure).rejects.toBeInstanceOf(KeepaAuthError)
    await expect(failure).rejects.not.toBeInstanceOf(KeepaTokensExhausted)
  })

  it("batches at twenty asins per call", async () => {
    const calls: string[] = []
    const client = new KeepaClient({
      apiKey: "k",
      fetchImpl: respondWith("super-tips-t2.json", calls),
    })
    const asins = Array.from({ length: 45 }, (_, i) => `B${String(i).padStart(9, "0")}`)
    await client.products(asins, KEEPA_DOMAIN["amazon.ca"])
    expect(calls).toHaveLength(3)
    const first = new URL(calls[0]).searchParams.get("asin")?.split(",")
    expect(first).toHaveLength(BATCH_SIZE)
  })

  it("asks for history only on the history tier", async () => {
    const calls: string[] = []
    const client = new KeepaClient({
      apiKey: "k",
      fetchImpl: respondWith("super-tips-t2.json", calls),
    })
    await client.products(["B071CP6X88"], 6, "basic")
    await client.products(["B071CP6X88"], 6, "history")
    await client.products(["B071CP6X88"], 6, "offers")
    expect(new URL(calls[0]).searchParams.get("history")).toBe("0")
    expect(new URL(calls[1]).searchParams.get("history")).toBe("1")
    expect(new URL(calls[2]).searchParams.get("offers")).toBe("20")
  })

  it("asks for the buy box only on the tiers that pay for it", async () => {
    const calls: string[] = []
    const client = new KeepaClient({
      apiKey: "k",
      fetchImpl: respondWith("super-tips-t2.json", calls),
    })
    await client.products(["B071CP6X88"], 6, "basic")
    await client.products(["B071CP6X88"], 6, "buybox")
    await client.products(["B071CP6X88"], 6, "offers")
    expect(new URL(calls[0]).searchParams.get("buybox")).toBeNull()
    expect(new URL(calls[1]).searchParams.get("buybox")).toBe("1")
    expect(new URL(calls[2]).searchParams.get("buybox")).toBe("1")
  })

  it("stops spending below the token floor", async () => {
    const calls: string[] = []
    const client = new KeepaClient({
      apiKey: "k",
      // This fixture reports 18 tokens left, under the floor of 20.
      fetchImpl: respondWith("price-spike.json", calls),
    })
    const asins = Array.from({ length: 45 }, (_, i) => `B${String(i).padStart(9, "0")}`)
    const result = await client.products(asins, 6)
    expect(calls).toHaveLength(1)
    expect(result.lowTokens).toBe(true)
    expect(result.tokensLeft).toBe(18)
  })

  it("refuses rather than returning nothing when already empty", async () => {
    const empty = (async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => json({ products: [], tokensLeft: 3 }),
    })) as unknown as typeof fetch
    const client = new KeepaClient({ apiKey: "k", fetchImpl: empty })
    await expect(client.products(["B071CP6X88"], 6)).rejects.toBeInstanceOf(
      KeepaTokensExhausted,
    )
  })
})

describe("cache policy", () => {
  const now = new Date("2026-08-13T12:00:00Z")

  function entry(tier: CacheEntry["tier"], hoursAgo: number): CacheEntry {
    return {
      key: cacheKey("B071CP6X88", 6, tier),
      tier,
      fetchedAt: new Date(now.getTime() - hoursAgo * 3600_000),
      product: { asin: "B071CP6X88" },
    }
  }

  it("keys on the data, never on the url that carries the key", () => {
    expect(cacheKey("B071CP6X88", 6, "basic")).toBe("B071CP6X88:6:basic")
    // Same ASIN on two marketplaces is two different answers.
    expect(cacheKey("B071CP6X88", 1, "basic")).not.toBe(cacheKey("B071CP6X88", 6, "basic"))
    // As is the same ASIN at two tiers.
    expect(cacheKey("B071CP6X88", 6, "history")).not.toBe(cacheKey("B071CP6X88", 6, "basic"))
  })

  it("expires price and rank in hours but seasonality in weeks", () => {
    expect(isFresh(entry("basic", 3), now)).toBe(true)
    expect(isFresh(entry("basic", 7), now)).toBe(false)
    // A product's seasonal shape does not change week to week.
    expect(isFresh(entry("history", 24 * 20), now)).toBe(true)
    expect(isFresh(entry("history", 24 * 40), now)).toBe(false)
    expect(isFresh(entry("offers", 30), now)).toBe(false)
  })

  it("reports age so a stale answer can be labelled as one", () => {
    expect(ageInMinutes(entry("basic", 2), now)).toBe(120)
  })
})

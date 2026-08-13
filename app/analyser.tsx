"use client"

import { useCallback, useMemo, useState } from "react"
import { review } from "@/lib/domain/review"
import type {
  DataQuality,
  MarketSignals,
  Marketplace,
  ProductInput,
  SellerProfile,
  SignalState,
  Verdict,
  WeightTier,
} from "@/lib/domain/types"
import { DEFAULT_CRITERIA, MARKETPLACE_CURRENCY } from "@/lib/domain/types"

/**
 * The whole domain is pure, so this runs entirely in the browser with no
 * account and no round trip. Deliberate: the fastest way to discourage a new
 * seller is to make them complete a setup track before the product has shown
 * them anything worth having.
 */

const VERDICT_COLOUR: Record<Verdict, string> = {
  BUY: "var(--buy)",
  WATCH: "var(--watch)",
  PASS: "var(--pass)",
}

const STATE_COLOUR: Record<SignalState, string> = {
  strong: "var(--buy-ink)",
  watch: "var(--watch-ink)",
  weak: "var(--pass-ink)",
  unknown: "var(--text-faint)",
}

const STATE_TINT: Record<SignalState, string> = {
  strong: "var(--buy-tint)",
  watch: "var(--watch-tint)",
  weak: "var(--pass-tint)",
  unknown: "var(--surface-sunken)",
}

const WEIGHT_TIERS: WeightTier[] = ["envelope", "small", "standard", "large", "oversize"]

interface LookupResponse {
  error?: string
  title?: string | null
  product?: ProductInput
  signals?: MarketSignals
  assumptions?: string[]
}

const CATEGORIES = [
  "toys-games",
  "home-kitchen",
  "beauty",
  "grocery",
  "health-personal-care",
  "consumer-electronics",
  "office-products",
  "pet-supplies",
  "sports-outdoors",
  "tools-home-improvement",
]

export function Analyser() {
  const [marketplace, setMarketplace] = useState<Marketplace>("amazon.ca")
  const [category, setCategory] = useState("toys-games")
  const [weightTier, setWeightTier] = useState<WeightTier>("standard")
  const [salePrice, setSalePrice] = useState("39.99")
  const [unitCost, setUnitCost] = useState("12.00")
  const [minRoi, setMinRoi] = useState("30")
  const [prep, setPrep] = useState("1.50")
  const [inbound, setInbound] = useState("1.10")
  const [duty, setDuty] = useState("0")
  const [returns, setReturns] = useState("3")
  const [salesRank, setSalesRank] = useState("")
  const [sellerCount, setSellerCount] = useState("")
  const [amazonOnListing, setAmazonOnListing] = useState(false)
  const [asin, setAsin] = useState("")
  const [title, setTitle] = useState<string | null>(null)
  const [assumptions, setAssumptions] = useState<string[]>([])
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [looking, setLooking] = useState(false)
  /** Typed numbers and read numbers are worth different amounts of confidence. */
  const [live, setLive] = useState(false)

  const currency = MARKETPLACE_CURRENCY[marketplace]

  // Everything Keepa knows is filled in; the seller supplies the one number
  // it cannot know, which is what they are actually paying.
  const lookup = useCallback(async () => {
    setLooking(true)
    setLookupError(null)
    try {
      const params = new URLSearchParams({ asin, marketplace })
      const response = await fetch(`/api/product?${params}`)
      const body = (await response.json()) as LookupResponse
      if (!response.ok || !body.product) {
        setLookupError(body.error ?? "Lookup failed.")
        return
      }
      setTitle(body.title ?? null)
      setSalePrice(body.product.salePrice.toFixed(2))
      setCategory(body.product.category)
      setWeightTier(body.product.weightTier)
      setSalesRank(body.signals?.salesRank?.toString() ?? "")
      setSellerCount(body.signals?.sellerCount?.toString() ?? "")
      setAmazonOnListing(body.signals?.amazonOnListing === true)
      setAssumptions(body.assumptions ?? [])
      setLive(true)
    } catch {
      setLookupError("Could not reach the lookup service.")
    } finally {
      setLooking(false)
    }
  }, [asin, marketplace])

  const result = useMemo(() => {
    const product: ProductInput = {
      asin,
      marketplace,
      category,
      salePrice: num(salePrice),
      weightTier,
      unitCost: num(unitCost),
    }
    const profile: SellerProfile = {
      id: "anonymous",
      residency: marketplace === "amazon.co.uk" ? "GB" : marketplace === "amazon.com" ? "US" : "CA",
      entityJurisdiction: null,
      marketplaces: [marketplace],
      stage: "pre-account",
      minRoi: num(minRoi) / 100,
      capital: 0,
      costs: {
        inboundPerUnit: num(inbound),
        prepPerUnit: num(prep),
        irrecoverableTaxRate: 0,
        dutyRate: num(duty) / 100,
        returnsRate: num(returns) / 100,
      },
      completedRequirements: [],
      provenance: {},
    }
    const signals: MarketSignals = {
      salesRank: optional(salesRank),
      salesRank90dAvg: null,
      sellerCount: optional(sellerCount),
      fbaSellerCount: null,
      amazonOnListing,
      seasonality: "unknown",
    }
    // Confidence is honest about how much of this rests on typed numbers
    // rather than read ones, and rises on its own as fields are filled live.
    const quality: DataQuality = {
      livePrice: live,
      liveFees: false,
      sellerEnteredCost: num(unitCost) > 0,
      landedCostsEntered: num(prep) > 0 || num(inbound) > 0,
      knownCategory: true,
      historyDays: 0,
      signalAgeDays: 0,
    }
    return review(product, profile, { ...DEFAULT_CRITERIA, minRoi: num(minRoi) / 100 }, signals, quality)
  }, [
    asin,
    live,
    marketplace,
    category,
    weightTier,
    salePrice,
    unitCost,
    minRoi,
    prep,
    inbound,
    duty,
    returns,
    salesRank,
    sellerCount,
    amazonOnListing,
  ])

  const analysis = result.analysis

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1.1fr]">
      <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
        <label className="grid gap-1 text-sm">
          <span style={{ color: "var(--text-muted)" }}>ASIN</span>
          <span className="flex gap-2">
            <input
              value={asin}
              onChange={(e) => setAsin(e.target.value.toUpperCase())}
              placeholder="B071CP6X88"
              className="data flex-1 rounded-md border bg-transparent px-3 py-2"
              style={{ borderColor: "var(--hairline)" }}
            />
            <button
              type="button"
              onClick={lookup}
              disabled={looking || asin.length !== 10}
              className="rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              style={{ background: "var(--accent)" }}
            >
              {looking ? "Reading" : "Look up"}
            </button>
          </span>
          {title && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {title}
            </span>
          )}
          {lookupError && (
            <span className="text-xs" style={{ color: "var(--pass-ink)" }}>
              {lookupError}
            </span>
          )}
        </label>
        <Select label="Marketplace" value={marketplace} onChange={(v) => setMarketplace(v as Marketplace)}>
          <option value="amazon.ca">amazon.ca</option>
          <option value="amazon.com">amazon.com</option>
          <option value="amazon.co.uk">amazon.co.uk</option>
        </Select>
        <Select label="Category" value={category} onChange={setCategory}>
          {categoryOptions(category).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select label="Size tier" value={weightTier} onChange={(v) => setWeightTier(v as WeightTier)}>
          {WEIGHT_TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Field label={`Sale price (${currency})`} value={salePrice} onChange={setSalePrice} />
        <Field label={`Your cost per unit (${currency})`} value={unitCost} onChange={setUnitCost} />
        <Field label="Minimum ROI (%)" value={minRoi} onChange={setMinRoi} />

        <Fieldset
          legend="Landed costs"
          note="Leave these at zero and the answer will flatter you. They are the difference between a 30% target and a 15% outcome."
        >
          <Field label={`Prep per unit (${currency})`} value={prep} onChange={setPrep} />
          <Field label={`Inbound freight per unit (${currency})`} value={inbound} onChange={setInbound} />
          <Field label="Duty (%)" value={duty} onChange={setDuty} />
          <Field label="Returns allowance (%)" value={returns} onChange={setReturns} />
        </Fieldset>

        <Fieldset
          legend="The listing"
          note="Optional. A product can be profitable and still be a bad buy."
        >
          <Field label="Sales rank" value={salesRank} onChange={setSalesRank} />
          <Field label="Sellers on the listing" value={sellerCount} onChange={setSellerCount} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={amazonOnListing}
              onChange={(e) => setAmazonOnListing(e.target.checked)}
            />
            <span style={{ color: "var(--text-muted)" }}>Amazon is selling on this listing</span>
          </label>
        </Fieldset>
      </form>

      <section aria-live="polite" className="grid content-start gap-5">
        <div className="flex items-center gap-4">
          <span
            className="text-4xl font-semibold tracking-tight"
            style={{ color: VERDICT_COLOUR[result.verdict] }}
          >
            {result.verdict}
          </span>
          <Confidence value={result.confidence.value} />
        </div>

        <ul className="grid gap-0">
          {result.reasons.map((reason) => (
            <li
              key={reason.label}
              className="flex items-center gap-3 border-t py-3 text-sm"
              style={{ borderColor: "var(--hairline)" }}
            >
              <span className="flex-1">{reason.label}</span>
              <span className="data">{reason.value}</span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{
                  background: STATE_TINT[reason.state],
                  color: STATE_COLOUR[reason.state],
                }}
              >
                {reason.state}
              </span>
            </li>
          ))}
        </ul>

        <Card>
          <Overline>Buy below</Overline>
          <p className="data text-3xl font-semibold">
            {currency} {analysis.buyBelow.toFixed(2)}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            on the invoice, to clear {minRoi}% after landed costs. Breakeven{" "}
            {analysis.breakeven.toFixed(2)}. ROI {(analysis.roi * 100).toFixed(1)}%, margin{" "}
            {(analysis.margin * 100).toFixed(1)}%.
          </p>
        </Card>

        <details open>
          <Card>
            <summary className="cursor-pointer">
              <Overline>The arithmetic</Overline>
            </summary>
            <ul className="data mt-3 space-y-1 text-xs">
              {analysis.workings.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Card>
        </details>

        {assumptions.length > 0 && (
          <Card>
            <Overline>Assumed, because the data did not say</Overline>
            <ul className="mt-2 space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </Card>
        )}

        <Card tint="var(--watch-tint)">
          <Overline>Risks</Overline>
          <ul className="mt-2 space-y-1 text-xs">
            {result.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </Card>

        {result.confidence.limits.length > 0 && (
          <Card>
            <Overline>What would raise confidence</Overline>
            <ul className="mt-2 space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {result.confidence.limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}

/** Ten pips and a whole percentage. Never a fake-precise decimal. */
function Confidence({ value }: { value: number }) {
  const lit = Math.round(value * 10)
  return (
    <span className="flex items-center gap-2">
      <span className="data text-sm" style={{ color: "var(--text-muted)" }}>
        {Math.round(value * 100)}% confidence
      </span>
      <span className="flex gap-[3px]" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <i
            key={i}
            className="h-[6px] w-[14px] rounded-sm"
            style={{ background: i < lit ? "var(--accent)" : "var(--surface-sunken)" }}
          />
        ))}
      </span>
    </span>
  )
}

function Card({ children, tint }: { children: React.ReactNode; tint?: string }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--hairline)", background: tint ?? "var(--surface)" }}
    >
      {children}
    </div>
  )
}

function Overline({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-xs font-semibold uppercase tracking-[0.09em]"
      style={{ color: "var(--text-faint)" }}
    >
      {children}
    </span>
  )
}

function Fieldset({
  legend,
  note,
  children,
}: {
  legend: string
  note: string
  children: React.ReactNode
}) {
  return (
    <fieldset
      className="mt-2 grid gap-4 rounded-xl border p-4"
      style={{ borderColor: "var(--hairline)" }}
    >
      <legend className="px-1">
        <Overline>{legend}</Overline>
      </legend>
      <p className="-mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        {note}
      </p>
      {children}
    </fieldset>
  )
}

/** A looked-up category Amazon has but our fee table does not must still show. */
function categoryOptions(current: string): string[] {
  return CATEGORIES.includes(current) || current === "" ? CATEGORIES : [current, ...CATEGORIES]
}

function num(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Blank means not read, which is different from zero. */
function optional(value: string): number | null {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="data rounded-md border bg-transparent px-3 py-2"
        style={{ borderColor: "var(--hairline)" }}
      />
    </label>
  )
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border bg-transparent px-3 py-2"
        style={{ borderColor: "var(--hairline)" }}
      >
        {children}
      </select>
    </label>
  )
}

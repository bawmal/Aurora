"use client"

import { useMemo, useState } from "react"
import { analyse } from "@/lib/domain/product"
import type {
  Marketplace,
  ProductInput,
  SellerProfile,
  Verdict,
  WeightTier,
} from "@/lib/domain/types"
import { MARKETPLACE_CURRENCY } from "@/lib/domain/types"

/**
 * The whole domain is pure, so this runs entirely in the browser with no
 * account and no round trip. Deliberate: the fastest way to discourage a new
 * seller is to make them complete a setup track before the product has shown
 * them anything worth having.
 */

const VERDICT_STYLE: Record<Verdict, string> = {
  BUY: "bg-emerald-600",
  WATCH: "bg-amber-500",
  PASS: "bg-neutral-500",
}

const WEIGHT_TIERS: WeightTier[] = ["envelope", "small", "standard", "large", "oversize"]

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

  const currency = MARKETPLACE_CURRENCY[marketplace]

  const result = useMemo(() => {
    const product: ProductInput = {
      asin: "",
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
    return analyse(product, profile)
  }, [marketplace, category, weightTier, salePrice, unitCost, minRoi, prep, inbound, duty, returns])

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1.1fr]">
      <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
        <Select label="Marketplace" value={marketplace} onChange={(v) => setMarketplace(v as Marketplace)}>
          <option value="amazon.ca">amazon.ca</option>
          <option value="amazon.com">amazon.com</option>
          <option value="amazon.co.uk">amazon.co.uk</option>
        </Select>
        <Select label="Category" value={category} onChange={setCategory}>
          {CATEGORIES.map((c) => (
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

        <fieldset className="mt-2 grid gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <legend className="px-1 text-xs uppercase tracking-wide text-neutral-500">
            Landed costs
          </legend>
          <p className="-mt-1 text-xs text-neutral-500">
            Leave these at zero and the answer will flatter you. They are the difference between a
            30% target and a 15% outcome.
          </p>
          <Field label={`Prep per unit (${currency})`} value={prep} onChange={setPrep} />
          <Field label={`Inbound freight per unit (${currency})`} value={inbound} onChange={setInbound} />
          <Field label="Duty (%)" value={duty} onChange={setDuty} />
          <Field label="Returns allowance (%)" value={returns} onChange={setReturns} />
        </fieldset>
      </form>

      <section aria-live="polite" className="grid content-start gap-5">
        <div className="flex items-baseline gap-3">
          <span
            className={`rounded px-3 py-1 text-sm font-semibold text-white ${VERDICT_STYLE[result.verdict]}`}
          >
            {result.verdict}
          </span>
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            ROI {(result.roi * 100).toFixed(1)}% · margin {(result.margin * 100).toFixed(1)}%
          </span>
        </div>

        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Buy below</p>
          <p className="text-3xl font-semibold tabular-nums">
            {currency} {result.buyBelow.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            on the invoice, to clear {minRoi}% after landed costs. Breakeven{" "}
            {result.breakeven.toFixed(2)}.
          </p>
        </div>

        <details open className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <summary className="cursor-pointer text-xs uppercase tracking-wide text-neutral-500">
            The arithmetic
          </summary>
          <ul className="mt-3 space-y-1 font-mono text-xs tabular-nums">
            {result.workings.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>

        <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-xs dark:border-amber-900/60 dark:bg-amber-950/30">
          <p className="mb-2 uppercase tracking-wide text-amber-700 dark:text-amber-500">Risks</p>
          <ul className="space-y-1">
            {result.risks.map((risk) => (
              <li key={risk}>· {risk}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

function num(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
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
      <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-neutral-300 bg-transparent px-3 py-2 tabular-nums dark:border-neutral-700"
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
      <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
      >
        {children}
      </select>
    </label>
  )
}

import { fulfilmentFee, isKnownCategory, referralFee, round } from "./fees"
import type {
  Analysis,
  FeeBreakdown,
  LandedCostInputs,
  ProductInput,
  SellerProfile,
  Verdict,
} from "./types"

/**
 * Fuel and inflation surcharge applied to the fulfilment fee. Kept separate
 * from the base fee so it can be updated without touching the tier table.
 */
const FULFILMENT_SURCHARGE = 0.05

export function computeFees(product: ProductInput): FeeBreakdown {
  const referral = referralFee(product.category, product.salePrice)
  const fulfilment = fulfilmentFee(product.marketplace, product.weightTier)
  const surcharge = round(fulfilment * FULFILMENT_SURCHARGE)
  return {
    referral,
    fulfilment,
    surcharge,
    total: round(referral + fulfilment + surcharge),
  }
}

/**
 * What one unit actually costs to get into a fulfilment centre.
 *
 * Multiplicative costs (irrecoverable tax, duty) scale with the invoice
 * price; per-unit costs (inbound freight, prep) do not. The distinction
 * matters when solving for the buy-below price, because it is not a simple
 * ratio.
 */
export function landedCost(unitCost: number, costs: LandedCostInputs): number {
  return round(unitCost * multiplier(costs) + perUnit(costs))
}

function multiplier(costs: LandedCostInputs): number {
  return 1 + costs.irrecoverableTaxRate + costs.dutyRate
}

function perUnit(costs: LandedCostInputs): number {
  return costs.inboundPerUnit + costs.prepPerUnit
}

/**
 * Sale price less Amazon's fees and less the revenue lost to returns.
 * Returns are modelled on the revenue side rather than as a unit cost: a
 * returned unit consumed its fees and rarely resells at full value.
 */
export function netProceeds(product: ProductInput, costs: LandedCostInputs): number {
  const fees = computeFees(product)
  return round(product.salePrice - fees.total - product.salePrice * costs.returnsRate)
}

/**
 * The highest invoice price that still clears the seller's ROI floor *after*
 * landed costs.
 *
 * Solving `net = landed(p) × (1 + minRoi)` for p, where
 * `landed(p) = p × k + f`:
 *
 *     p_max = (net / (1 + minRoi) − f) / k
 *
 * Computing this on the invoice price alone — the common shortcut — quotes a
 * shelf price the seller cannot actually clear their floor at, because prep
 * and freight are still to come.
 */
export function buyBelow(
  product: ProductInput,
  costs: LandedCostInputs,
  minRoi: number,
): number {
  const net = netProceeds(product, costs)
  const maxLanded = net / (1 + minRoi)
  const price = (maxLanded - perUnit(costs)) / multiplier(costs)
  return round(Math.max(0, price))
}

/** The invoice price at which profit is exactly zero. */
export function breakevenPrice(product: ProductInput, costs: LandedCostInputs): number {
  const net = netProceeds(product, costs)
  const price = (net - perUnit(costs)) / multiplier(costs)
  return round(Math.max(0, price))
}

export function analyse(product: ProductInput, profile: SellerProfile): Analysis {
  const costs = profile.costs
  const fees = computeFees(product)
  const net = netProceeds(product, costs)
  const landed = landedCost(product.unitCost, costs)
  const below = buyBelow(product, costs, profile.minRoi)
  const breakeven = breakevenPrice(product, costs)

  const profit = round(net - landed)
  const roi = landed > 0 ? profit / landed : 0
  const margin = product.salePrice > 0 ? profit / product.salePrice : 0

  return {
    verdict: verdictFor(product.unitCost, below, breakeven),
    fees,
    net,
    landedCost: landed,
    breakeven,
    buyBelow: below,
    roi,
    margin,
    workings: workings(product, costs, fees, net, landed, profit, below),
    risks: risks(product, costs, profile),
  }
}

function verdictFor(unitCost: number, below: number, breakeven: number): Verdict {
  if (unitCost <= below) return "BUY"
  if (unitCost >= breakeven) return "PASS"
  return "WATCH"
}

function workings(
  product: ProductInput,
  costs: LandedCostInputs,
  fees: FeeBreakdown,
  net: number,
  landed: number,
  profit: number,
  below: number,
): string[] {
  const lines = [
    `Sale price ${money(product.salePrice)}`,
    `− referral ${money(fees.referral)} − fulfilment ${money(fees.fulfilment)} − surcharge ${money(fees.surcharge)}`,
  ]
  if (costs.returnsRate > 0) {
    lines.push(
      `− returns allowance ${money(round(product.salePrice * costs.returnsRate))} (${pct(costs.returnsRate)} of sale price)`,
    )
  }
  lines.push(`= net proceeds ${money(net)}`)
  lines.push(`Invoice price ${money(product.unitCost)}`)
  if (costs.irrecoverableTaxRate > 0) {
    lines.push(
      `+ unrecoverable tax ${money(round(product.unitCost * costs.irrecoverableTaxRate))} (${pct(costs.irrecoverableTaxRate)})`,
    )
  }
  if (costs.dutyRate > 0) {
    lines.push(`+ duty ${money(round(product.unitCost * costs.dutyRate))} (${pct(costs.dutyRate)})`)
  }
  if (costs.inboundPerUnit > 0) lines.push(`+ inbound freight ${money(costs.inboundPerUnit)}`)
  if (costs.prepPerUnit > 0) lines.push(`+ prep ${money(costs.prepPerUnit)}`)
  lines.push(`= landed cost ${money(landed)}`)
  lines.push(`Profit ${money(net)} − ${money(landed)} = ${money(profit)}`)
  lines.push(`Buy below ${money(below)} on the invoice to clear your ROI floor after landed costs`)
  return lines
}

function risks(
  product: ProductInput,
  costs: LandedCostInputs,
  profile: SellerProfile,
): string[] {
  const out: string[] = []
  if (!isKnownCategory(product.category)) {
    out.push(
      `No referral rate on file for "${product.category}" — the default 15% was used and may be wrong.`,
    )
  }
  if (perUnit(costs) === 0 && costs.irrecoverableTaxRate === 0 && costs.dutyRate === 0) {
    out.push(
      "No prep, freight, tax or duty is set on your profile, so this is an invoice-price calculation. Real landed cost will be higher.",
    )
  }
  if (
    product.marketplace !== marketplaceOf(profile.residency) &&
    costs.dutyRate === 0
  ) {
    out.push(
      "You are selling into a marketplace outside your home country with no duty rate set. Imported inventory usually carries duty, and Amazon will not act as importer of record.",
    )
  }
  if (costs.returnsRate === 0) {
    out.push("No returns allowance is set, so this assumes every unit sells and stays sold.")
  }
  out.push("Fees and the sale price move. This is a snapshot, not a guarantee.")
  return out
}

function marketplaceOf(residency: SellerProfile["residency"]) {
  return residency === "CA" ? "amazon.ca" : residency === "GB" ? "amazon.co.uk" : "amazon.com"
}

function money(n: number): string {
  return n.toFixed(2)
}

function pct(n: number): string {
  return `${round(n * 100)}%`
}

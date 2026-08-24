import { confidence } from "./confidence"
import { round } from "./fees"
import { analyse } from "./product"
import type {
  Analysis,
  DataQuality,
  MarketSignals,
  ProductInput,
  Reason,
  Review,
  SellerCriteria,
  SellerProfile,
  SignalState,
  Verdict,
} from "./types"

/**
 * The layer between the arithmetic and the seller.
 *
 * `analyse` answers one question: does this product clear the ROI floor once
 * every landed cost is paid. That is necessary and not sufficient. A product
 * can be beautifully profitable and still be a bad buy because Amazon is on
 * the listing, or twenty other sellers are, or it sells twice a year.
 *
 * So the economics decide the ceiling, and the seller's own criteria can
 * only lower it. Criteria never promote a PASS to a BUY, because no amount
 * of demand fixes a product that loses money.
 */

export const UNKNOWN_SIGNALS: MarketSignals = {
  salesRank: null,
  salesRank90dAvg: null,
  sellerCount: null,
  fbaSellerCount: null,
  amazonOnListing: null,
  seasonality: "unknown",
}

export function review(
  product: ProductInput,
  profile: SellerProfile,
  criteria: SellerCriteria,
  signals: MarketSignals = UNKNOWN_SIGNALS,
  quality: DataQuality = assumedQuality(product),
): Review {
  const analysis = analyse(product, profile)
  const reasons = reasonsFor(analysis, criteria, signals)
  const vetoes = vetoesFor(analysis, criteria, signals)

  return {
    analysis,
    verdict: applyVetoes(analysis.verdict, vetoes),
    confidence: confidence(quality),
    reasons,
    risks: [...analysis.risks, ...vetoes],
  }
}

/**
 * A veto is a criterion the seller set that this product breaks. Naming each
 * one is the point: "PASS" alone teaches nothing, "PASS, 22 sellers against
 * your limit of 15" teaches the rule.
 */
function vetoesFor(
  analysis: Analysis,
  criteria: SellerCriteria,
  signals: MarketSignals,
): string[] {
  const vetoes: string[] = []

  if (analysis.margin < criteria.minMargin) {
    vetoes.push(
      `Margin ${pct(analysis.margin)} is below your floor of ${pct(criteria.minMargin)}`,
    )
  }
  if (signals.amazonOnListing === true && !criteria.allowAmazonOnListing) {
    vetoes.push("Amazon is selling on this listing and you have chosen to avoid those")
  }
  if (signals.sellerCount !== null && signals.sellerCount > criteria.maxSellerCount) {
    vetoes.push(
      `${signals.sellerCount} sellers on the listing, against your limit of ${criteria.maxSellerCount}`,
    )
  }
  if (signals.salesRank !== null && signals.salesRank > criteria.maxSalesRank) {
    vetoes.push(
      `Sales rank ${signals.salesRank.toLocaleString("en-US")} is worse than your ceiling of ${criteria.maxSalesRank.toLocaleString("en-US")}`,
    )
  }
  if (criteria.seasonality === "evergreen-only" && signals.seasonality !== "evergreen") {
    vetoes.push("You buy evergreen only and this does not read as evergreen")
  }
  if (criteria.seasonality === "avoid-highly-seasonal" && signals.seasonality === "highly-seasonal") {
    vetoes.push("Highly seasonal, and you have chosen to avoid those")
  }

  return vetoes
}

/** Criteria can only ever make the verdict worse. */
function applyVetoes(verdict: Verdict, vetoes: string[]): Verdict {
  if (vetoes.length === 0) return verdict
  if (verdict === "BUY") return "WATCH"
  return "PASS"
}

/**
 * Three lines, each a plain claim, one number and a state. Anything a chart
 * would show and a decision would not use does not appear here.
 */
function reasonsFor(
  analysis: Analysis,
  criteria: SellerCriteria,
  signals: MarketSignals,
): Reason[] {
  return [
    {
      label: "Return on the money you put in",
      value: pct(analysis.roi),
      state: band(analysis.roi, criteria.minRoi, criteria.minRoi * 0.7),
    },
    {
      label: "Demand, by sales rank",
      value: signals.salesRank === null ? "not read" : `#${signals.salesRank.toLocaleString("en-US")}`,
      state:
        signals.salesRank === null
          ? "unknown"
          : invertedBand(signals.salesRank, criteria.maxSalesRank),
    },
    {
      label: "Competition on the listing",
      value: signals.sellerCount === null ? "not read" : `${signals.sellerCount} sellers`,
      state:
        signals.sellerCount === null
          ? "unknown"
          : invertedBand(signals.sellerCount, criteria.maxSellerCount),
    },
  ]
}

/** A BUY can still carry a watch on one line. That nuance is the honesty. */
function band(value: number, strongAt: number, watchAt: number): SignalState {
  if (value >= strongAt) return "strong"
  if (value >= watchAt) return "watch"
  return "weak"
}

function invertedBand(value: number, limit: number): SignalState {
  if (value <= limit * 0.6) return "strong"
  if (value <= limit) return "watch"
  return "weak"
}

/** What we know about the inputs when nothing live has been fetched. */
export function assumedQuality(product: ProductInput): DataQuality {
  return {
    livePrice: false,
    liveFees: false,
    sellerEnteredCost: product.unitCost > 0,
    landedCostsEntered: false,
    knownCategory: true,
    historyDays: 0,
    signalAgeDays: 0,
  }
}

function pct(n: number): string {
  return `${round(n * 100)}%`
}

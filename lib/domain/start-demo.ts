import liveHistory from "../../tests/fixtures/keepa/live-history.json"
import liveBuyBox from "../../tests/fixtures/keepa/live-buybox.json"
import { toAnalysisInput } from "@/lib/analysis/from-keepa"
import { parseSeries } from "@/lib/keepa/parse"
import { STAT } from "@/lib/keepa/types"
import type { KeepaProduct, KeepaResponse } from "@/lib/keepa/types"
import { analyse } from "./product"
import type { LandedCostInputs, Marketplace, SellerProfile } from "./types"

const marketplace: Marketplace = "amazon.ca"
const unitCost = 12
const costs: LandedCostInputs = {
  inboundPerUnit: 0,
  prepPerUnit: 0,
  irrecoverableTaxRate: 0,
  dutyRate: 0,
  returnsRate: 0,
}

const historyProduct = (liveHistory as KeepaResponse).products?.[0] as KeepaProduct
const buyBoxProduct = (liveBuyBox as KeepaResponse).products?.[0] as KeepaProduct
const parsed = toAnalysisInput(historyProduct, marketplace, unitCost, {
  historyYear: 2025,
  intent: "listing",
})
if (!parsed.ok) throw new Error("The start demo fixture is not analysable")

const profile: SellerProfile = {
  id: "start-demo",
  residency: "CA",
  entityJurisdiction: null,
  marketplaces: [marketplace],
  stage: "pre-account",
  minRoi: 0.3,
  capital: 2000,
  costs,
  completedRequirements: [],
  provenance: {},
}
const economics = analyse(parsed.product, profile)
const demand = parsed.demandPerMonth ?? 0
const sellers = parsed.signals.sellerCount ?? 0
const unitsPerMonth = demand / (sellers + 1)
const profitPerUnit = economics.net - economics.landedCost
const monthlyProfit = profitPerUnit * unitsPerMonth
const lastRead = parseSeries(historyProduct, STAT.salesRank)
  .map((point) => point.at)
  .sort((a, b) => b.getTime() - a.getTime())[0]

export const START_DEMO = {
  asin: parsed.product.asin,
  title: historyProduct.title ?? "A real Amazon listing",
  readDate: lastRead?.toISOString().slice(0, 10) ?? "date not recorded",
  price: parsed.product.salePrice,
  buyBoxPrice: buyBoxProduct.stats?.current?.[18]
    ? buyBoxProduct.stats.current[18] / 100
    : null,
  sellers,
  demandPerMonth: demand,
  unitsPerMonth,
  unitCost,
  fees: economics.fees.total,
  netPerUnit: profitPerUnit,
  roi: economics.roi,
  monthlyProfit,
  assumptions: parsed.assumptions,
  marketplace,
} as const

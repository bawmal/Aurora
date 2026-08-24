import { readFileSync } from "node:fs"
import { join } from "node:path"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { toAnalysisInput } from "@/lib/analysis/from-keepa"
import { Panel } from "@/app/start/start"
import { showCostRow } from "@/app/start/start"
import { analyse } from "../product"
import { parseSeries } from "@/lib/keepa/parse"
import { STAT } from "@/lib/keepa/types"
import { START_DEMO } from "../start-demo"
import { ACHIEVEMENTS, MILESTONES, SKILLS, TRACKS } from "../curriculum"
import { MODULE_GUIDANCE } from "../guidance"
import {
  BuyBoxIllustration,
  LiveListingCard,
  OffersIllustration,
  PortfolioIllustration,
  SearchResultsIllustration,
  ShareBlocksIllustration,
  UnitSplitIllustration,
} from "@/app/start/illustrations"
import { nextStartPanel, START_GOAL_PANEL, START_LAST_PANEL } from "../start"
import type { SellerProfile } from "../types"
import type { KeepaResponse } from "@/lib/keepa/types"

describe("start demo", () => {
  it("keeps the committed snapshot on the analyser path", () => {
    const fixture = JSON.parse(
      readFileSync(
        join(process.cwd(), "tests/fixtures/keepa/live-history.json"),
        "utf8",
      ),
    ) as KeepaResponse
    const product = fixture.products?.[0]
    if (!product) throw new Error("fixture has no product")
    const parsed = toAnalysisInput(product, "amazon.ca", START_DEMO.unitCost, {
      historyYear: 2025,
      intent: "listing",
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const profile: SellerProfile = {
      id: "demo",
      residency: "CA",
      entityJurisdiction: null,
      marketplaces: ["amazon.ca"],
      stage: "pre-account",
      minRoi: 0.3,
      capital: 2000,
      costs: {
        inboundPerUnit: START_DEMO.inboundPerUnit,
        prepPerUnit: START_DEMO.prepPerUnit,
        irrecoverableTaxRate: 0,
        dutyRate: START_DEMO.dutyRate,
        returnsRate: START_DEMO.returnsRate,
      },
      completedRequirements: [],
      provenance: {},
    }
    const analysis = analyse(parsed.product, profile)
    const lastRead = parseSeries(product, STAT.salesRank)
      .map((point) => point.at)
      .sort((a, b) => b.getTime() - a.getTime())[0]
    expect(START_DEMO.asin).toBe(parsed.product.asin)
    expect(START_DEMO.title).toBe(product.title)
    expect(START_DEMO.readDate).toBe(lastRead.toISOString().slice(0, 10))
    expect(START_DEMO.price).toBe(31.99)
    expect(START_DEMO.sellers).toBe(19)
    expect(START_DEMO.demandPerMonth).toBe(300)
    expect(START_DEMO.unitsPerMonth).toBe(15)
    expect(START_DEMO.fees).toBe(analysis.fees.total)
    expect(START_DEMO.netProceeds).toBe(analysis.net)
    expect(START_DEMO.landedCost).toBe(analysis.landedCost)
    expect(START_DEMO.profitPerUnit).toBeCloseTo(analysis.net - analysis.landedCost, 2)
    expect(START_DEMO.roi).toBeCloseTo(analysis.roi, 10)
    expect(START_DEMO.monthlyProfit).toBeCloseTo(
      START_DEMO.profitPerUnit * START_DEMO.unitsPerMonth,
      2,
    )
  })
})

describe("start navigation", () => {
  it("skip goes directly to the goal panel", () => {
    expect(nextStartPanel(0, true)).toBe(START_GOAL_PANEL)
  })

  it("renders apostrophes in panel titles rather than entity text", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        Panel,
        {
          overline: "Test",
          title: "One product isn’t a business",
          onNext: () => undefined,
        },
        null,
      ),
    )
    expect(html).toContain("One product isn’t a business")
    expect(html).not.toContain("&rsquo;")
  })

  it("clamps at the last panel", () => {
    expect(nextStartPanel(START_LAST_PANEL)).toBe(START_LAST_PANEL)
    expect(START_GOAL_PANEL).toBeLessThan(START_LAST_PANEL)
  })

  it("labels every teaching illustration as an illustration", () => {
    const illustrations = [
      React.createElement(SearchResultsIllustration, {
        currency: "CAD",
        items: [{ name: "Drill", price: "99.00" }],
      }),
      React.createElement(BuyBoxIllustration, {
        currency: "CAD",
        price: "31.99",
        otherSellers: 18,
      }),
      React.createElement(OffersIllustration, {
        currency: "CAD",
        rows: [{ seller: "You", price: "31.99", share: 5, you: true }],
        hiddenSellers: 18,
        demandPerMonth: 300,
      }),
      React.createElement(ShareBlocksIllustration, {
        sellers: 20,
        unitsEach: "15",
      }),
      React.createElement(UnitSplitIllustration, {
        currency: "CAD",
        salePrice: 31.99,
        segments: [
          { label: "Fees", value: 11.68, tone: "fees" },
          { label: "Cost", value: 14.6, tone: "cost" },
          { label: "Profit", value: 4.75, tone: "profit" },
        ],
      }),
      React.createElement(PortfolioIllustration, {
        currency: "CAD",
        products: 15,
        perProduct: 71.25,
      }),
    ]

    for (const illustration of illustrations) {
      const html = renderToStaticMarkup(illustration)
      const caption = html.match(/<figcaption[^>]*>(.*?)<\/figcaption>/)?.[1]
      expect(caption).toBeDefined()
      expect(caption).toMatch(/Illustration|split to scale/)
    }
  })

  it("does not label the live listing as an illustration", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        LiveListingCard,
        { title: "A real listing", asin: "B000000000", readDate: "2026-08-13" },
        React.createElement("div"),
      ),
    )
    expect(html).not.toContain("Illustration")
  })

  it("hides zero-valued arithmetic cost rows", () => {
    expect(showCostRow(0)).toBe(false)
    expect(showCostRow(1.1)).toBe(true)
  })
})

describe("seller-facing curriculum copy", () => {
  it("does not name the data vendor", () => {
    const strings = [
      ...MILESTONES.flatMap(({ name, description }) => [name, description]),
      ...TRACKS.flatMap(({ name, description }) => [name, description]),
      ...SKILLS.flatMap(({ name, levels }) => [name, ...levels]),
      ...ACHIEVEMENTS.map(({ name }) => name),
      ...Object.values(MODULE_GUIDANCE).flatMap(
        ({ steps, doneWhen, pitfall, duration }) => [
          ...steps,
          doneWhen,
          ...(pitfall ? [pitfall] : []),
          duration,
        ],
      ),
    ]

    for (const text of strings) {
      expect(text).not.toMatch(/keepa/i)
    }
  })
})

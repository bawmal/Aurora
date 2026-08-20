import { readFileSync } from "node:fs"
import { join } from "node:path"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { toAnalysisInput } from "@/lib/analysis/from-keepa"
import { Panel } from "@/app/start/start"
import { analyse } from "../product"
import { parseSeries } from "@/lib/keepa/parse"
import { STAT } from "@/lib/keepa/types"
import { START_DEMO } from "../start-demo"
import { nextStartPanel, START_GOAL_PANEL } from "../start"
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
})

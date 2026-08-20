import { describe, expect, it } from "vitest"
import { START_DEMO } from "../start-demo"
import { nextStartPanel, START_GOAL_PANEL } from "../start"
import { analyse } from "../product"
import type { SellerProfile } from "../types"

describe("start demo", () => {
  it("keeps the snapshot arithmetic on the analyser path", () => {
    const profile: SellerProfile = {
      id: "demo",
      residency: "CA",
      entityJurisdiction: null,
      marketplaces: ["amazon.ca"],
      stage: "pre-account",
      minRoi: 0.3,
      capital: 2000,
      costs: {
        inboundPerUnit: 0,
        prepPerUnit: 0,
        irrecoverableTaxRate: 0,
        dutyRate: 0,
        returnsRate: 0,
      },
      completedRequirements: [],
      provenance: {},
    }
    expect(START_DEMO.netPerUnit).toBe(
      analyse(
        {
          asin: START_DEMO.asin,
          marketplace: "amazon.ca",
          category: "toys-games",
          salePrice: START_DEMO.price,
          weightTier: "standard",
          unitCost: START_DEMO.unitCost,
        },
        profile,
      ).net - START_DEMO.unitCost,
    )
    expect(START_DEMO.price).toBe(31.99)
    expect(START_DEMO.sellers).toBe(19)
    expect(START_DEMO.demandPerMonth).toBe(300)
    expect(START_DEMO.unitsPerMonth).toBe(15)
    expect(START_DEMO.monthlyProfit).toBeCloseTo(124.65, 2)
  })
})

describe("start navigation", () => {
  it("skip goes directly to the goal panel", () => {
    expect(nextStartPanel(0, true)).toBe(START_GOAL_PANEL)
  })
})

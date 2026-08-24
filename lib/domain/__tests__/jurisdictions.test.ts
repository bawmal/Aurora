import { describe, expect, it } from "vitest"
import {
  REQUIREMENTS,
  dueRequirements,
  isSupportedResidency,
  requirementsFor,
} from "../jurisdictions"
import { MARKETPLACES, RESIDENCIES } from "../types"
import type { RequirementContext } from "../types"

const ctx = (over: Partial<RequirementContext> = {}): RequirementContext => ({
  residency: "CA",
  marketplace: "amazon.ca",
  entityJurisdiction: "CA",
  holdsLocalInventory: false,
  paysLocalSuppliers: false,
  ...over,
})

const ids = (list: { id: string }[]) => list.map((r) => r.id)

describe("supported residency", () => {
  it("accepts the three supported countries", () => {
    for (const r of RESIDENCIES) expect(isSupportedResidency(r)).toBe(true)
  })

  it("rejects everything else, including plausible near-misses", () => {
    for (const r of ["NG", "IE", "AU", "EU", "OTHER", "ca", ""]) {
      expect(isSupportedResidency(r)).toBe(false)
    }
  })
})

describe("the negatives — what a seller must NOT be shown", () => {
  it("never shows a US-resident domestic seller the EIN or currency steps", () => {
    const shown = ids(requirementsFor(ctx({ residency: "US", marketplace: "amazon.com", entityJurisdiction: "US" })))
    expect(shown).not.toContain("us.w8bene")
    expect(shown).not.toContain("payout.multicurrency")
    expect(shown).not.toContain("us.importer-of-record")
  })

  it("never shows UK VAT to a seller who has not chosen the UK marketplace", () => {
    for (const marketplace of ["amazon.ca", "amazon.com"] as const) {
      const shown = ids(requirementsFor(ctx({ marketplace })))
      expect(shown).not.toContain("uk.vat.netp")
      expect(shown).not.toContain("uk.eori")
    }
  })

  it("never offers a US bank account before a US entity exists", () => {
    const shown = ids(
      requirementsFor(ctx({ marketplace: "amazon.com", entityJurisdiction: "CA", paysLocalSuppliers: true })),
    )
    expect(shown).not.toContain("us.bank-account")
    expect(shown).not.toContain("us.ein")
  })

  it("does not carry a marketplace rule into another marketplace", () => {
    const uk = ids(requirementsFor(ctx({ marketplace: "amazon.co.uk", holdsLocalInventory: true })))
    expect(uk).not.toContain("us.sales-tax-nexus")
    expect(uk).not.toContain("ca.gst-hst")
  })
})

describe("the positives", () => {
  it("requires UK VAT registration for a non-established seller with no threshold", () => {
    const shown = requirementsFor(ctx({ residency: "CA", marketplace: "amazon.co.uk" }))
    const vat = shown.find((r) => r.id === "uk.vat.netp")
    expect(vat?.severity).toBe("required")
    expect(vat?.actions[0].note).toMatch(/no threshold/i)
  })

  it("does not impose the NETP rule on a UK-established seller", () => {
    const shown = ids(requirementsFor(ctx({ residency: "GB", marketplace: "amazon.co.uk" })))
    expect(shown).not.toContain("uk.vat.netp")
  })

  it("requires an importer of record for non-US stock going into US FBA", () => {
    const shown = ids(
      requirementsFor(ctx({ marketplace: "amazon.com", holdsLocalInventory: true })),
    )
    expect(shown).toContain("us.importer-of-record")
  })

  it("orders US banking behind the entity and the EIN", () => {
    const withEntity = requirementsFor(
      ctx({ marketplace: "amazon.com", entityJurisdiction: "US", paysLocalSuppliers: true }),
    )
    expect(ids(withEntity)).toContain("us.ein")
    expect(ids(withEntity)).toContain("us.bank-account")
    const bank = withEntity.find((r) => r.id === "us.bank-account")
    expect(bank?.blocks).toContain("ws_first_order")
  })
})

describe("surfacing — the defence against a compliance checklist", () => {
  it("shows only what blocks the milestone the seller is on", () => {
    const context = ctx({ residency: "CA", marketplace: "amazon.com", holdsLocalInventory: true })
    const all = requirementsFor(context)
    const due = dueRequirements(context, "mk_first_disbursement")
    expect(due.length).toBeLessThan(all.length)
    expect(ids(due)).toContain("amz.tax-interview")
    expect(ids(due)).not.toContain("us.importer-of-record")
  })

  it("keeps ambient requirements that block nothing", () => {
    const due = dueRequirements(ctx({ marketplace: "amazon.ca" }), "ra_first_sale")
    expect(ids(due)).toContain("ca.gst-hst")
  })

  it("drops anything already completed", () => {
    const context = ctx({ marketplace: "amazon.com" })
    const due = dueRequirements(context, "mk_first_disbursement", ["amz.tax-interview"])
    expect(ids(due)).not.toContain("amz.tax-interview")
  })

  it("shows a US domestic seller almost nothing to start with", () => {
    const due = dueRequirements(
      ctx({ residency: "US", marketplace: "amazon.com", entityJurisdiction: "US" }),
      "ra_first_sale",
    )
    expect(due.length).toBeLessThanOrEqual(1)
  })
})

describe("table integrity", () => {
  it("has unique ids", () => {
    expect(new Set(ids(REQUIREMENTS)).size).toBe(REQUIREMENTS.length)
  })

  it("cites an official source for every requirement", () => {
    for (const r of REQUIREMENTS) {
      expect(r.citations.length, r.id).toBeGreaterThan(0)
      for (const c of r.citations) {
        expect(Boolean(c.url || c.locator), `${r.id} citation has no url or locator`).toBe(true)
        expect(c.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  })

  it("hands over something actionable for every requirement", () => {
    for (const r of REQUIREMENTS) {
      expect(r.actions.length, r.id).toBeGreaterThan(0)
      for (const a of r.actions) {
        expect(Boolean(a.url || a.contact || a.locator), `${r.id} action is not actionable`).toBe(
          true,
        )
      }
    }
  })

  it("resolves for every residency × marketplace cell without throwing", () => {
    for (const residency of RESIDENCIES) {
      for (const marketplace of MARKETPLACES) {
        for (const holdsLocalInventory of [true, false]) {
          const shown = requirementsFor(
            ctx({ residency, marketplace, entityJurisdiction: residency, holdsLocalInventory }),
          )
          expect(Array.isArray(shown)).toBe(true)
        }
      }
    }
  })
})

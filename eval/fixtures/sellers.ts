import type { SellerProfile } from "@/lib/domain/types"

/**
 * Fixture sellers. Between them they cover every case in the golden set, and
 * each exists to make a specific failure detectable.
 */

const base = (id: string): Omit<SellerProfile, "residency" | "stage"> => ({
  id,
  entityJurisdiction: null,
  marketplaces: [],
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
})

/** Nothing set up yet. Tests that the mentor never invents state. */
export const preAccountCanadian: SellerProfile = {
  ...base("fixture-pre-account-ca"),
  residency: "CA",
  stage: "pre-account",
}

/** Selling on .ca only. Should never be shown US or UK requirements. */
export const canadianDomestic: SellerProfile = {
  ...base("fixture-ca-domestic"),
  residency: "CA",
  entityJurisdiction: "CA",
  marketplaces: ["amazon.ca"],
  stage: "new-seller",
}

/** Itohan's actual state: Canadian, .ca running, mid-US expansion. */
export const canadianExpandingToUS: SellerProfile = {
  ...base("fixture-ca-us-expansion"),
  residency: "CA",
  entityJurisdiction: "CA",
  marketplaces: ["amazon.ca", "amazon.com"],
  stage: "us-expansion",
  capital: 5000,
  costs: {
    inboundPerUnit: 1.1,
    prepPerUnit: 1.5,
    irrecoverableTaxRate: 0,
    dutyRate: 0.06,
    returnsRate: 0.03,
  },
}

/**
 * The cell with almost no setup track. Exists to assert the engine *omits*
 * the EIN, currency and importer-of-record steps — a US seller shown those
 * will conclude the product does not know who they are.
 */
export const usDomestic: SellerProfile = {
  ...base("fixture-us-domestic"),
  residency: "US",
  entityJurisdiction: "US",
  marketplaces: ["amazon.com"],
  stage: "ra-operating",
  costs: {
    inboundPerUnit: 0.8,
    prepPerUnit: 1.2,
    irrecoverableTaxRate: 0,
    dutyRate: 0,
    returnsRate: 0.03,
  },
}

/** UK resident selling at home, then into the US. */
export const ukSeller: SellerProfile = {
  ...base("fixture-gb"),
  residency: "GB",
  entityJurisdiction: "GB",
  marketplaces: ["amazon.co.uk"],
  stage: "ra-operating",
}

/** Wholesale-ready: entity, US footprint, paying suppliers directly. */
export const wholesaleReady: SellerProfile = {
  ...base("fixture-wholesale"),
  residency: "CA",
  entityJurisdiction: "US",
  marketplaces: ["amazon.ca", "amazon.com"],
  stage: "wholesale",
  capital: 25000,
  minRoi: 0.25,
  costs: {
    inboundPerUnit: 0.9,
    prepPerUnit: 1.35,
    irrecoverableTaxRate: 0,
    dutyRate: 0.045,
    returnsRate: 0.02,
  },
}

export const ALL_FIXTURES: SellerProfile[] = [
  preAccountCanadian,
  canadianDomestic,
  canadianExpandingToUS,
  usDomestic,
  ukSeller,
  wholesaleReady,
]

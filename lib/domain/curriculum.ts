import type {
  Achievement,
  MilestoneTemplate,
  SkillDefinition,
  SkillKey,
  TrackTemplate,
  TrackType,
} from "./types"

/**
 * The hand-authored milestone library. The journey engine selects, sequences
 * and dates these; it does not invent new ones, which is what keeps every
 * seller's map comparable and lets CI validate the graph.
 *
 * One rule governs the split between this file and jurisdictions.ts:
 *
 *   a milestone is a business outcome the seller achieves
 *   a requirement is a compliance step some sellers must clear first
 *
 * So there is no "Get an EIN" milestone. An EIN is `us.ein` in the rule
 * table, conditional on holding a US entity, and it reaches the seller only
 * through the milestone it gates. Encoding it as a milestone would put it on
 * every seller's map including the US residents who already have one, which
 * is exactly the "product doesn't know who I am" failure.
 */

export const MILESTONES: MilestoneTemplate[] = [
  // ---------------------------------------------------------------- foundation
  {
    key: "fd_decide_structure",
    track: "foundation",
    name: "Decide how you will trade",
    description:
      "Sole trader or a company. Affects tax, liability and which suppliers will open an account for you.",
    order: 1,
    dependencies: [],
    requires: [],
  },
  {
    key: "fd_business_email",
    track: "foundation",
    name: "Set up a business email on your own domain",
    description:
      "A domain address is the cheapest credibility you can buy. Wholesale suppliers screen on it.",
    order: 2,
    dependencies: [],
    requires: [],
  },
  {
    key: "fd_banking",
    track: "foundation",
    name: "Separate the money",
    description:
      "A dedicated account for the business. Mixing personal and business spending is the single most common bookkeeping mess.",
    order: 3,
    dependencies: ["fd_decide_structure"],
    requires: [],
  },

  // ------------------------------------------------------------- marketplace
  // Instantiated once per marketplace the seller targets. `{mk}` is replaced
  // with the marketplace code, so the US instance of a milestone is a
  // different node from the CA one and they progress independently.
  {
    key: "mk_account",
    track: "marketplace",
    name: "Create your {marketplace} selling account",
    description: "Registration and identity verification.",
    order: 1,
    dependencies: [],
    requires: [],
    perMarketplace: true,
  },
  {
    key: "mk_verified",
    track: "marketplace",
    name: "Pass {marketplace} verification",
    description:
      "Identity, address and sometimes a video call. Plan for it to take longer than you expect.",
    order: 2,
    dependencies: ["mk_account"],
    requires: [],
    perMarketplace: true,
  },
  {
    key: "mk_first_disbursement",
    track: "marketplace",
    name: "Receive your first {marketplace} disbursement",
    description: "Money actually arriving in your account is the only proof the plumbing works.",
    order: 3,
    dependencies: ["mk_verified"],
    // The tax interview genuinely blocks disbursement, so it is a real gate
    // rather than advice. The other two are conditional and resolve to
    // nothing for a seller being paid at home in their own currency.
    requires: ["amz.tax-interview", "us.w8bene", "payout.multicurrency"],
    perMarketplace: true,
  },

  // -------------------------------------------------------------- retail arb
  {
    key: "ra_tools",
    track: "retail",
    name: "Set up your scanning workflow",
    description: "The app, the barcode scanner, and a place to record what you looked at.",
    order: 1,
    dependencies: [],
    requires: [],
    buildsSkill: "sourcing",
  },
  {
    key: "ra_first_analysis",
    track: "retail",
    name: "Analyse your first product",
    description: "One product, all the way through, with the arithmetic visible.",
    order: 2,
    dependencies: [],
    requires: [],
    buildsSkill: "product-analysis",
    teaches: "product-analysis-basics",
  },
  {
    key: "ra_ungated",
    track: "retail",
    name: "Get ungated in your first restricted category",
    description:
      "The documents Amazon accepts differ by marketplace. A till receipt is not an invoice anywhere.",
    order: 3,
    dependencies: ["ra_first_analysis"],
    requires: [],
    buildsSkill: "sourcing",
  },
  {
    key: "ra_first_buy",
    track: "retail",
    name: "Make your first profitable purchase",
    description: "A product you analysed, bought below your buy-below price.",
    order: 4,
    dependencies: ["ra_first_analysis"],
    requires: [],
  },
  {
    key: "ra_first_shipment",
    track: "retail",
    name: "Send your first shipment to FBA",
    description: "Prep, labelling and the shipping plan. Where the hidden per-unit costs show up.",
    order: 5,
    dependencies: ["ra_first_buy"],
    // Cross-border only. A domestic seller sees neither.
    requires: ["us.importer-of-record", "uk.eori"],
    buildsSkill: "operations",
  },
  {
    key: "ra_first_sale",
    track: "retail",
    name: "Make your first sale",
    description: "The whole loop closed once.",
    order: 6,
    dependencies: ["ra_first_shipment"],
    requires: ["amz.tax-interview", "uk.vat.netp"],
  },
  {
    key: "ra_repeatable",
    track: "retail",
    name: "Build a repeatable weekly sourcing routine",
    description: "A funnel, not a lucky find. Five analysed products a day is the coaching target.",
    order: 7,
    dependencies: ["ra_first_sale"],
    requires: [],
    buildsSkill: "sourcing",
  },

  // ---------------------------------------------------------------- wholesale
  {
    key: "ws_website",
    track: "wholesale",
    name: "Put up a business website",
    description: "Suppliers check. It does not need to be much, it needs to exist.",
    order: 1,
    dependencies: [],
    requires: [],
  },
  {
    key: "ws_find_brands",
    track: "wholesale",
    name: "Identify target brands",
    description: "Brands whose numbers work before you have spoken to anyone.",
    order: 2,
    dependencies: [],
    requires: [],
    buildsSkill: "wholesale",
  },
  {
    key: "ws_outreach",
    track: "wholesale",
    name: "Send your first supplier outreach",
    description: "The approach that gets an account opened rather than ignored.",
    order: 3,
    dependencies: ["ws_find_brands", "ws_website"],
    requires: [],
    buildsSkill: "supplier-outreach",
  },
  {
    key: "ws_account_approved",
    track: "wholesale",
    name: "Get your first supplier account approved",
    description: "A real wholesale account with terms.",
    order: 4,
    dependencies: ["ws_outreach"],
    // Suppliers ask for resale documentation and an entity before they will
    // open an account.
    requires: ["entity.incorporate", "us.resale-certificate"],
  },
  {
    key: "ws_first_order",
    track: "wholesale",
    name: "Place your first wholesale order",
    description: "Priced off a real price list, against your own buy-below numbers.",
    order: 5,
    dependencies: ["ws_account_approved"],
    requires: ["us.resale-certificate", "us.bank-account"],
    buildsSkill: "wholesale",
  },
]

export const TRACKS: TrackTemplate[] = [
  {
    type: "foundation",
    name: "Business foundation",
    description: "The structure everything else sits on.",
    startsUnlocked: true,
    unlock: null,
  },
  {
    type: "marketplace",
    name: "Marketplace readiness",
    description: "Getting live, and getting paid, in one marketplace.",
    startsUnlocked: true,
    unlock: null,
  },
  {
    type: "retail",
    name: "Retail and online arbitrage",
    description: "Sourcing from retail and online, the usual way in.",
    startsUnlocked: true,
    unlock: null,
  },
  {
    type: "wholesale",
    name: "Wholesale",
    description: "Buying direct from brands and distributors.",
    startsUnlocked: false,
    // Deliberately demanding. Wholesale outreach without a track record and
    // an entity wastes the seller's first impression with every brand they
    // approach, and first impressions with a brand do not come back.
    unlock: {
      milestones: ["ra_first_sale", "fd_business_email"],
      skills: [{ skill: "product-analysis", level: 3 }],
      requiresEntity: true,
    },
  },
]

export const SKILLS: SkillDefinition[] = [
  {
    key: "product-analysis",
    name: "Product analysis",
    levels: [
      "Follow the checklist with help",
      "Reach a verdict with the mentor",
      "Reach a verdict independently",
      "Judge exceptions against your own criteria",
      "Analyse in bulk and teach it",
    ],
  },
  {
    key: "keepa",
    name: "Reading sales rank history",
    levels: [
      "Understand what the chart shows",
      "Read a chart with the mentor",
      "Read a chart independently",
      "Spot seasonality and manipulation",
      "Bulk screening",
    ],
  },
  {
    key: "sourcing",
    name: "Sourcing",
    levels: [
      "Scan and record",
      "Build a small funnel",
      "Run a weekly routine",
      "Source against a thesis",
      "Run sourcing as a system",
    ],
  },
  {
    key: "supplier-outreach",
    name: "Supplier outreach",
    levels: [
      "Send a templated introduction",
      "Handle the first reply",
      "Open accounts consistently",
      "Negotiate terms",
      "Manage a supplier portfolio",
    ],
  },
  {
    key: "wholesale",
    name: "Wholesale",
    levels: [
      "Understand the model",
      "Analyse a price list",
      "Place and receive an order",
      "Manage replenishment",
      "Run a brand pipeline",
    ],
  },
  {
    key: "operations",
    name: "Operations",
    levels: [
      "Prep and ship one box",
      "Use a prep centre or a routine",
      "Control per-unit cost",
      "Plan inbound at volume",
      "Run operations hands-off",
    ],
  },
]

/**
 * Real outcomes only. Nothing here can be earned by clicking through the
 * product, which is the whole difference between this and a progress bar.
 */
export const ACHIEVEMENTS: Achievement[] = [
  { key: "first_analysis", name: "First product analysed", on: { milestone: "ra_first_analysis" } },
  { key: "ungated", name: "First category ungated", on: { milestone: "ra_ungated" } },
  { key: "first_purchase", name: "First purchase", on: { milestone: "ra_first_buy" } },
  { key: "first_sale", name: "First sale", on: { milestone: "ra_first_sale" } },
  {
    key: "first_disbursement",
    name: "First money out",
    on: { milestone: "mk_first_disbursement" },
  },
  { key: "wholesale_ready", name: "Wholesale unlocked", on: { trackUnlocked: "wholesale" } },
  { key: "first_supplier", name: "First supplier account", on: { milestone: "ws_account_approved" } },
  { key: "products_100", name: "100 products analysed", on: { counter: "productsAnalysed", at: 100 } },
]

export function trackTemplate(type: TrackType): TrackTemplate {
  const found = TRACKS.find((t) => t.type === type)
  if (!found) throw new Error(`unknown track: ${type}`)
  return found
}

export function milestonesFor(track: TrackType): MilestoneTemplate[] {
  return MILESTONES.filter((m) => m.track === track).sort((a, b) => a.order - b.order)
}

export function skillDefinition(key: SkillKey): SkillDefinition {
  const found = SKILLS.find((s) => s.key === key)
  if (!found) throw new Error(`unknown skill: ${key}`)
  return found
}

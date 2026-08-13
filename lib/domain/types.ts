/**
 * Source of truth for the domain. Prisma follows these types, not the other
 * way round. Nothing in lib/domain may import I/O, a framework or a client.
 */

/**
 * Where the seller lives and pays tax. Closed union by design: v1 serves
 * Canada, the US and the UK, and an unsupported country is unrepresentable
 * rather than a value the jurisdiction table has to defend against.
 *
 * Not the same as citizenship, not the same as `entityJurisdiction`, and not
 * the same as the marketplace. All three can differ.
 */
export type Residency = "CA" | "US" | "GB"

export const RESIDENCIES: readonly Residency[] = ["CA", "US", "GB"] as const

export type Marketplace = "amazon.ca" | "amazon.com" | "amazon.co.uk"

export const MARKETPLACES: readonly Marketplace[] = [
  "amazon.ca",
  "amazon.com",
  "amazon.co.uk",
] as const

export type Currency = "CAD" | "USD" | "GBP"

export const MARKETPLACE_CURRENCY: Record<Marketplace, Currency> = {
  "amazon.ca": "CAD",
  "amazon.com": "USD",
  "amazon.co.uk": "GBP",
}

export type Track = "retail" | "expansion" | "wholesale"

export type Stage =
  | "pre-account"
  | "new-seller"
  | "ra-operating"
  | "us-expansion"
  | "wholesale"

/** Where a value in the profile came from. Stored by dotted field path. */
export type ProvenanceSource = "seller" | "derived" | "coach" | "default"

export interface Provenance {
  source: ProvenanceSource
  at: string
  note?: string
}

export interface SellerProfile {
  id: string
  residency: Residency
  /** Where the operating entity is registered. Null until they incorporate. */
  entityJurisdiction: Residency | null
  marketplaces: Marketplace[]
  stage: Stage
  /** Minimum acceptable ROI as a fraction: 0.3 is 30%. */
  minRoi: number
  capital: number
  /** Per-unit costs the seller pays on top of the invoice price. */
  costs: LandedCostInputs
  completedRequirements: string[]
  /** Keyed by dotted field path, e.g. "profile.minRoi". */
  provenance: Record<string, Provenance>
}

/**
 * Everything between the invoice price and the unit arriving in an Amazon
 * fulfilment centre. Omitting these is the single biggest source of
 * over-optimistic buy decisions: a 30% ROI target computed on invoice price
 * alone lands nearer 15% once prep and inbound freight are paid.
 */
export interface LandedCostInputs {
  /** Inbound freight to the fulfilment centre, per unit. */
  inboundPerUnit: number
  /** Prep centre or self-prep cost, per unit. */
  prepPerUnit: number
  /**
   * Sales tax / VAT paid at purchase that the seller cannot recover, as a
   * fraction of the invoice price. Zero where a resale certificate or VAT
   * registration makes the input recoverable.
   */
  irrecoverableTaxRate: number
  /** Duty as a fraction of the invoice price. Non-zero on imported goods. */
  dutyRate: number
  /**
   * Expected returns as a fraction of units sold. Modelled as a cost because
   * a returned unit is rarely resold at full value.
   */
  returnsRate: number
}

export const NO_EXTRA_COSTS: LandedCostInputs = {
  inboundPerUnit: 0,
  prepPerUnit: 0,
  irrecoverableTaxRate: 0,
  dutyRate: 0,
  returnsRate: 0,
}

export type WeightTier = "envelope" | "small" | "standard" | "large" | "oversize"

export interface ProductInput {
  asin: string
  marketplace: Marketplace
  category: string
  salePrice: number
  weightTier: WeightTier
  /** Invoice price per unit, before landed costs. */
  unitCost: number
}

export type Verdict = "BUY" | "WATCH" | "PASS"

export interface FeeBreakdown {
  referral: number
  fulfilment: number
  surcharge: number
  total: number
}

export interface Analysis {
  verdict: Verdict
  fees: FeeBreakdown
  /** Sale price less Amazon's fees. */
  net: number
  /** Landed cost of one unit at the seller's quoted unit cost. */
  landedCost: number
  /** Landed cost at which profit is zero. */
  breakeven: number
  /**
   * The most the seller may pay *on the invoice* and still clear their ROI
   * floor after landed costs. This is the number they take to the shelf.
   */
  buyBelow: number
  roi: number
  margin: number
  /** Human-readable arithmetic. Never show a verdict without it. */
  workings: string[]
  /** Every recommendation states at least one risk. */
  risks: string[]
}

export type Severity = "required" | "conditional" | "recommended"

export interface Citation {
  publisher: string
  title: string
  url?: string
  /** Used where no reliable public URL exists, e.g. login-gated pages. */
  locator?: string
  retrieved: string
}

export interface ActionLink {
  label: string
  url?: string
  contact?: string
  locator?: string
  ready?: string[]
  time?: string
  note?: string
}

export interface SetupRequirement {
  id: string
  title: string
  severity: Severity
  /**
   * Milestones that cannot start until this is done. Also the mechanism for
   * not drowning the seller: a requirement is only surfaced when a milestone
   * it blocks is the one they are actually on.
   */
  blocks: string[]
  /** True where the answer depends on facts only an accountant should rule on. */
  professionalAdvice: boolean
  citations: Citation[]
  actions: ActionLink[]
  applies: (ctx: RequirementContext) => boolean
}

export interface RequirementContext {
  residency: Residency
  marketplace: Marketplace
  entityJurisdiction: Residency | null
  /** True once the seller holds stock in that marketplace's fulfilment network. */
  holdsLocalInventory: boolean
  paysLocalSuppliers: boolean
}

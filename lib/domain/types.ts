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

/**
 * Tracks run in parallel, not in sequence. A seller can be mid-wholesale on
 * one and pre-account on another, and the map has to hold that without
 * forcing a restart.
 */
export type TrackType = "foundation" | "marketplace" | "retail" | "wholesale"

export type SkillKey =
  | "product-analysis"
  | "keepa"
  | "sourcing"
  | "supplier-outreach"
  | "wholesale"
  | "operations"

/** Skill levels run 1-5. 0 means the seller has not started. */
export type SkillLevel = 0 | 1 | 2 | 3 | 4 | 5

export interface SkillDefinition {
  key: SkillKey
  name: string
  /** Five rungs, L1 to L5, described in terms of what the seller can do. */
  levels: [string, string, string, string, string]
}

export interface MilestoneTemplate {
  key: string
  track: TrackType
  name: string
  description: string
  order: number
  /** Milestone keys that must be complete first. These are the gates. */
  dependencies: string[]
  /**
   * Setup requirement ids from the jurisdiction table that gate this
   * milestone. Most are conditional, so for many sellers this list resolves
   * to nothing at all.
   */
  requires: string[]
  buildsSkill?: SkillKey
  teaches?: string
  /** Instantiated once per targeted marketplace rather than once per seller. */
  perMarketplace?: boolean
}

export interface TrackUnlock {
  milestones: string[]
  skills: { skill: SkillKey; level: SkillLevel }[]
  requiresEntity: boolean
}

export interface TrackTemplate {
  type: TrackType
  name: string
  description: string
  startsUnlocked: boolean
  unlock: TrackUnlock | null
}

export interface Achievement {
  key: string
  name: string
  on:
    | { milestone: string }
    | { trackUnlocked: TrackType }
    | { counter: "productsAnalysed"; at: number }
}

export type MilestoneStatus = "complete" | "next" | "available" | "gated"

export interface MilestoneState {
  key: string
  track: TrackType
  name: string
  marketplace: Marketplace | null
  status: MilestoneStatus
  /** Why it is gated, in the seller's terms. Empty when it is not. */
  blockedBy: string[]
}

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

/**
 * How much of the analysis rests on real inputs rather than defaults. Kept
 * separate from the verdict: the verdict is what the numbers say, confidence
 * is how much the numbers are worth.
 */
export interface DataQuality {
  livePrice: boolean
  liveFees: boolean
  sellerEnteredCost: boolean
  landedCostsEntered: boolean
  knownCategory: boolean
  /** Days of price and rank history available. */
  historyDays: number
  signalAgeDays: number
}

export interface Confidence {
  /** 0.1 to 1, rounded to a tenth. Never a fake-precise decimal. */
  value: number
  /** Every deduction, named, so the seller can raise it deliberately. */
  limits: string[]
}

/**
 * The seller's own buying rules. The verdict is judged against these rather
 * than against a house opinion, which is what makes it *their* verdict.
 */
export interface SellerCriteria {
  minRoi: number
  minMargin: number
  minSalePrice: number
  maxSalesRank: number
  maxSellerCount: number
  allowAmazonOnListing: boolean
  seasonality: "any" | "avoid-highly-seasonal" | "evergreen-only"
}

export const DEFAULT_CRITERIA: SellerCriteria = {
  minRoi: 0.3,
  minMargin: 0.15,
  minSalePrice: 15,
  maxSalesRank: 150_000,
  maxSellerCount: 15,
  allowAmazonOnListing: false,
  seasonality: "any",
}

export type Seasonality =
  | "evergreen"
  | "seasonal"
  | "highly-seasonal"
  | "event-driven"
  | "unknown"

/** Market signals, whether read live or entered by the seller. */
export interface MarketSignals {
  salesRank: number | null
  salesRank90dAvg: number | null
  sellerCount: number | null
  fbaSellerCount: number | null
  amazonOnListing: boolean | null
  seasonality: Seasonality
}

export type SignalState = "strong" | "watch" | "weak" | "unknown"

/** One line of the verdict: a plain claim, one number, and a state. */
export interface Reason {
  label: string
  value: string
  state: SignalState
}

export interface Review {
  analysis: Analysis
  /** May be harsher than the arithmetic alone: criteria can veto a BUY. */
  verdict: Verdict
  confidence: Confidence
  reasons: Reason[]
  risks: string[]
}

/**
 * What the seller has actually done. Kept separate from the profile because
 * this is the part that grows without bound, and separate from the
 * curriculum because methodology lives in code and progress lives in the
 * database.
 */
export interface JourneyProgress {
  /** Completed milestone keys. Marketplace instances are suffixed, e.g. "mk_account@amazon.com". */
  completedMilestones: string[]
  skills: Partial<Record<SkillKey, SkillLevel>>
  /** Distinct ASINs the seller has actually analysed. */
  analysedAsins: string[]
  /** Derived convenience counter; storage persists `analysedAsins`, not this value. */
  productsAnalysed: number
  unlockedTracks: TrackType[]
}

export const NO_PROGRESS: JourneyProgress = {
  completedMilestones: [],
  skills: {},
  analysedAsins: [],
  productsAnalysed: 0,
  unlockedTracks: [],
}

export interface UnlockProgress {
  track: TrackType
  unlocked: boolean
  /** 0 to 1. Shown only for tracks close enough to be worth chasing. */
  fraction: number
  outstanding: string[]
}

/** The seller's two real levers, and the only assumptions the model takes. */
export interface ProjectionInputs {
  capital: number
  /** ROI held per turn, as a fraction. */
  targetRoi: number
  /** How many times a year the capital cycles. */
  turnsPerYear: number
  /** Fraction of profit put back in. 1 is full reinvestment. */
  reinvestRate: number
}

export interface ProjectionTurn {
  turn: number
  openingCapital: number
  profit: number
  closingCapital: number
}

export interface Projection {
  turns: ProjectionTurn[]
  endingCapital: number
  /** Profit across every turn projected, reinvested or not. */
  cumulativeProfit: number
  finalTurnProfit: number
  /** Final-turn profit spread over the length of a turn. */
  monthlyRunRate: number
  assumptions: ProjectionInputs
}

export type ReachabilityVerdict = "reachable" | "reachable-later" | "not-modelled"

export interface Reachability {
  verdict: ReachabilityVerdict
  /** The monthly run rate the seller actually reaches by their own deadline. */
  runRateAtDeadline: number
  targetMonthlyProfit: number
  /** Months until the target run rate arrives on the current trajectory. */
  monthsToTarget: number | null
  workings: string[]
}

export type ReadinessDimension =
  | "business"
  | "marketplace"
  | "sourcing"
  | "wholesale"
  | "operations"
  | "skill"

export interface Readiness {
  /** Per dimension, 0 to 1. Derived on read, never stored as truth. */
  dimensions: Record<ReadinessDimension, number>
  /** Per marketplace the seller targets, 0 to 1. */
  marketplaces: Partial<Record<Marketplace, number>>
  overall: number
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

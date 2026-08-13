import type {
  Citation,
  RequirementContext,
  Residency,
  SetupRequirement,
} from "./types"
import { RESIDENCIES } from "./types"

/**
 * The residency × marketplace rule table.
 *
 * Setup steps are *generated* from this table rather than hand-authored as a
 * fixed graph, because the right setup track for a US resident selling on
 * amazon.com and a Canadian resident selling on amazon.co.uk share almost
 * nothing. Pure and CI-validated, like the fee tables.
 *
 * Every entry carries its official source and a retrieval date. These rules
 * change — two changed within the last year — and cached guidance goes stale
 * silently, which is the dangerous failure mode.
 */

const RETRIEVED = "2026-08-12"

const cite = (
  publisher: string,
  title: string,
  urlOrLocator: { url?: string; locator?: string },
): Citation => ({ publisher, title, ...urlOrLocator, retrieved: RETRIEVED })

/**
 * Guards the front door. The residency question is a closed choice of the
 * three supported countries, so this should never fail in the UI — but it is
 * the boundary check for anything arriving from an API or an old record.
 */
export function isSupportedResidency(value: string): value is Residency {
  return (RESIDENCIES as readonly string[]).includes(value)
}

export const REQUIREMENTS: SetupRequirement[] = [
  {
    id: "entity.incorporate",
    title: "Register a business entity",
    severity: "recommended",
    blocks: ["ws_account_approved"],
    professionalAdvice: true,
    applies: (c) => c.entityJurisdiction === null,
    citations: [
      cite("Corporations Canada", "Federal incorporation", {
        url: "https://ised-isde.canada.ca/site/corporations-canada/en",
      }),
    ],
    actions: [
      {
        label: "Talk to an accountant before choosing a structure",
        locator: "Ask your coach for a referral",
        note: "Sole proprietor is enough to start selling on most marketplaces. Wholesale suppliers are the usual reason to incorporate sooner.",
      },
    ],
  },
  {
    id: "amz.tax-interview",
    title: "Complete Amazon's tax interview",
    severity: "required",
    // Blocking, not deferrable: Amazon holds disbursements until it is done.
    blocks: ["ra_first_sale", "mk_first_disbursement"],
    professionalAdvice: false,
    applies: () => true,
    citations: [
      cite("Amazon Seller Central", "Tax interview", {
        locator: "Seller Central > Settings > Account Info > Tax Information > Tax Interview",
      }),
    ],
    actions: [
      {
        label: "Complete the tax interview",
        locator: "Seller Central > Settings > Account Info > Tax Information > Tax Interview",
        ready: ["legal entity name", "tax identifier for your country"],
        time: "usually validated immediately",
      },
    ],
  },
  {
    id: "us.w8bene",
    title: "Provide a W-8BEN-E as a non-US entity",
    severity: "required",
    blocks: ["mk_first_disbursement"],
    professionalAdvice: true,
    applies: (c) => c.marketplace === "amazon.com" && c.residency !== "US",
    citations: [
      cite("IRS", "Form W-8BEN-E", { url: "https://www.irs.gov/pub/irs-pdf/fw8bene.pdf" }),
      cite("IRS", "Claiming tax treaty benefits", {
        url: "https://www.irs.gov/individuals/international-taxpayers/claiming-tax-treaty-benefits",
      }),
    ],
    actions: [
      {
        label: "Form W-8BEN-E (reference copy)",
        url: "https://www.irs.gov/pub/irs-pdf/fw8bene.pdf",
        note: "Amazon collects this inside the tax interview; you do not normally file it separately. A treaty claim needs a TIN — a foreign TIN is acceptable, so a Canadian BN can serve.",
      },
    ],
  },
  {
    id: "us.ein",
    title: "Obtain an EIN",
    severity: "conditional",
    blocks: ["us.bank-account"],
    professionalAdvice: true,
    // Only genuinely required once there is a US entity to identify. Surfacing
    // it earlier sends non-US sellers down a fortnight of paperwork they may
    // never need.
    applies: (c) => c.entityJurisdiction === "US",
    citations: [
      cite("IRS", "Employer Identification Number", {
        url: "https://www.irs.gov/businesses/employer-identification-number",
      }),
      cite("IRS", "Instructions for Form SS-4", { url: "https://www.irs.gov/instructions/iss4" }),
    ],
    actions: [
      {
        label: "Form SS-4 (the EIN application itself)",
        url: "https://www.irs.gov/pub/irs-pdf/fss4.pdf",
        ready: [
          "legal entity name exactly as registered",
          "responsible party name",
          "entity type",
          "reason for applying",
        ],
        note: "Line 7b takes a foreign responsible party without an SSN.",
      },
      {
        label: "Apply by phone — international applicants only",
        contact: "+1 267-941-1099, Mon–Fri 06:00–23:00 US Eastern",
        ready: ["a completed SS-4 in front of you", "authority to sign for the entity"],
        time: "EIN usually issued on the call",
        note: "Fastest route if your principal place of business is outside the US. The online tool will not work for you.",
      },
      {
        label: "Fax the SS-4",
        contact: "855-215-1627 (within the US) / 304-707-9471 (outside the US)",
        time: "around 4 business days",
      },
    ],
  },
  {
    id: "us.bank-account",
    title: "Open a US business bank account",
    severity: "recommended",
    blocks: ["ws_first_order"],
    professionalAdvice: false,
    // Ordering rule that survives the CA/US/GB restriction: Mercury needs a
    // US entity and an EIN, so this cannot be the seller's first move.
    applies: (c) => c.entityJurisdiction === "US" && c.paysLocalSuppliers,
    citations: [
      cite("Mercury", "Eligibility and requirements", {
        url: "https://support.mercury.com/hc/en-us/articles/28770467511060-Eligibility-and-requirements-for-opening-a-Mercury-account",
      }),
    ],
    actions: [
      {
        label: "Open a Mercury account",
        url: "https://mercury.com",
        ready: [
          "US entity formation documents",
          "EIN confirmation letter",
          "photo ID for each owner",
          "a business address that is not your registered agent",
        ],
        time: "typically days",
        note: "Requires a US-formed entity. Not a ranking — Wise and Payoneer also work and need no US entity.",
      },
    ],
  },
  {
    id: "payout.multicurrency",
    title: "Set up a receiving account in the marketplace currency",
    severity: "recommended",
    blocks: ["mk_first_disbursement"],
    professionalAdvice: false,
    applies: (c) => marketplaceHome(c.marketplace) !== c.residency,
    citations: [
      cite("Amazon Seller Central", "Supported disbursement currencies", {
        url: "https://sellercentral.amazon.co.uk/help/hub/reference/external/200497780",
      }),
    ],
    actions: [
      {
        label: "Open a Wise account",
        url: "https://wise.com",
        ready: ["government photo ID", "proof of address"],
        time: "verification typically a few days",
        note: "Account details do not appear until identity verification is approved, the currency balance is activated and, often, a small initial deposit has been made.",
      },
      {
        label: "Or take Amazon Currency Converter and accept the spread",
        url: "https://sell.amazon.ca/cad-usd-currency-converter",
        note: "Simplest option. Costs a conversion margin on every disbursement.",
      },
    ],
  },
  {
    id: "us.resale-certificate",
    title: "Get a state resale certificate",
    severity: "conditional",
    blocks: ["ws_account_approved", "ws_first_order"],
    professionalAdvice: true,
    applies: (c) => c.marketplace === "amazon.com" && c.paysLocalSuppliers,
    citations: [
      cite("Streamlined Sales Tax Governing Board", "Registration", {
        url: "https://www.streamlinedsalestax.org/",
      }),
    ],
    actions: [
      {
        label: "Apply through the state's department of revenue",
        locator: "Search '<state> department of revenue resale certificate'",
        note: "Requirements differ by state and some will not issue to a non-resident without a state registration. Confirm with an accountant.",
      },
    ],
  },
  {
    id: "us.sales-tax-nexus",
    title: "Review US sales-tax nexus",
    severity: "conditional",
    blocks: [],
    professionalAdvice: true,
    // Facilitator laws cover the transaction, not nexus. FBA stock in a state
    // is the usual trigger.
    applies: (c) => c.marketplace === "amazon.com" && c.holdsLocalInventory,
    citations: [
      cite("Streamlined Sales Tax Governing Board", "State guides", {
        url: "https://www.streamlinedsalestax.org/",
      }),
    ],
    actions: [
      {
        label: "Put this to an accountant",
        locator: "Ask your coach for a referral",
        note: "Amazon collects and remits as marketplace facilitator, which covers the transaction. It does not remove a registration obligation created by holding stock in a state.",
      },
    ],
  },
  {
    id: "us.importer-of-record",
    title: "Arrange an importer of record for US-bound stock",
    severity: "required",
    blocks: ["ra_first_shipment"],
    professionalAdvice: true,
    applies: (c) =>
      c.marketplace === "amazon.com" && c.residency !== "US" && c.holdsLocalInventory,
    citations: [
      cite("Amazon Seller Central", "Amazon will not act as importer of record", {
        url: "https://sellercentral.amazon.ca/help/hub/reference/external/G200280280",
      }),
    ],
    actions: [
      {
        label: "Engage a customs broker or a prep centre that will act as IOR",
        locator: "Ask your coach for a vetted prep centre",
        note: "Amazon will not be importer of record for FBA inventory. Duty is a landed-cost line, not an edge case — set a duty rate on your profile before you trust a buy-below number.",
      },
    ],
  },
  {
    id: "uk.vat.netp",
    title: "Register for UK VAT as a non-established seller",
    severity: "required",
    blocks: ["ra_first_sale"],
    professionalAdvice: true,
    // The intuition sellers bring from home is wrong here: there is no
    // threshold for a non-established taxable person.
    applies: (c) => c.marketplace === "amazon.co.uk" && c.residency !== "GB",
    citations: [
      cite("HMRC", "VAT Notice 700/1: who should register for VAT", {
        url: "https://www.gov.uk/government/publications/vat-notice-7001-should-i-be-registered-for-vat/vat-notice-7001-should-i-be-registered-for-vat",
      }),
      cite("HMRC", "VATREG37210: NETPs and online marketplaces", {
        url: "https://www.gov.uk/hmrc-internal-manuals/vat-registration-manual/vatreg37210",
      }),
    ],
    actions: [
      {
        label: "Register for UK VAT",
        url: "https://www.gov.uk/register-for-vat",
        ready: ["Government Gateway account", "business details", "date of first UK taxable supply"],
        time: "HMRC processing, allow weeks",
        note: "The £90,000 threshold is for UK-established businesses. A non-established taxable person has no threshold. A narrow marketplace exemption exists where goods stay outside the UK in consignments of £135 or less — holding stock in UK FBA defeats it.",
      },
    ],
  },
  {
    id: "uk.eori",
    title: "Get a GB EORI number",
    severity: "required",
    blocks: ["ra_first_shipment"],
    professionalAdvice: false,
    applies: (c) => c.marketplace === "amazon.co.uk" && c.holdsLocalInventory,
    citations: [cite("HMRC", "Get an EORI number", { url: "https://www.gov.uk/eori" })],
    actions: [
      {
        label: "Apply for a GB EORI number",
        url: "https://www.gov.uk/eori",
        ready: ["Government Gateway account", "UK VAT number if you have one"],
        time: "often within days",
        note: "Free. An EU EORI is not valid for Great Britain. Non-UK businesses do not need a UTR, SIC code or NI number.",
      },
    ],
  },
  {
    id: "ca.gst-hst",
    title: "Check whether you must register for GST/HST",
    severity: "conditional",
    blocks: [],
    professionalAdvice: true,
    applies: (c) => c.marketplace === "amazon.ca",
    citations: [
      cite("Canada Revenue Agency", "Find out if you need to register", {
        url: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/digital-economy-gsthst/find-out-need-register.html",
      }),
    ],
    actions: [
      {
        label: "Check the CRA registration criteria",
        url: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/digital-economy-gsthst/find-out-need-register.html",
        note: "Turns on the small-supplier threshold and whether you are carrying on business in Canada. Holding inventory in Canadian FBA is a common trigger for a non-resident.",
      },
    ],
  },
]

function marketplaceHome(marketplace: RequirementContext["marketplace"]): Residency {
  return marketplace === "amazon.ca" ? "CA" : marketplace === "amazon.co.uk" ? "GB" : "US"
}

/** Everything that applies to this seller, whether or not it is due yet. */
export function requirementsFor(ctx: RequirementContext): SetupRequirement[] {
  return REQUIREMENTS.filter((r) => r.applies(ctx))
}

/**
 * What to actually put in front of the seller.
 *
 * A requirement is surfaced only when it blocks the milestone they are on, or
 * when it blocks nothing and so is genuinely ambient. This is the defence
 * against the product reading as a compliance checklist: a US resident on
 * amazon.com sees almost nothing, and nobody meets UK VAT until they choose
 * to sell in the UK.
 */
export function dueRequirements(
  ctx: RequirementContext,
  currentMilestone: string,
  completed: string[] = [],
): SetupRequirement[] {
  const done = new Set(completed)
  return requirementsFor(ctx).filter(
    (r) =>
      !done.has(r.id) && (r.blocks.length === 0 || r.blocks.includes(currentMilestone)),
  )
}

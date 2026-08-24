/**
 * Hand-authored module guidance, keyed by milestone key.
 *
 * Voice: coach. Every module answers three questions in order — why this
 * matters, what to actually do, and how you know you are finished. `doneWhen`
 * is always an observable fact, never a feeling, and it is also the label on
 * the completion control, so the seller confirms a specific thing rather than
 * self-certifying progress.
 *
 * `verified: true` means the app can see the completion itself and the seller
 * is never asked. Everything else is self-reported and must carry the "you
 * told us" marker, because the fact lives inside the seller's Amazon or bank
 * account and we have no API connected.
 *
 * `{marketplace}` is substituted the same way it already is in milestone
 * names, so a per-marketplace module reads "your Amazon UK account".
 */

export interface ModuleGuidance {
  /** 2-4 concrete actions, imperative, no prose. */
  steps: string[]
  /** The observable fact that ends the module. Also the completion label. */
  doneWhen: string
  /** The mistake sellers actually make here. Omitted where there isn't one. */
  pitfall?: string
  /** Honest expectation, so a long wait doesn't read as failure. */
  duration: string
  /** True only where the app observes the completion itself. */
  verified?: true
}

export const MODULE_GUIDANCE: Record<string, ModuleGuidance> = {
  // ---------------------------------------------------------------- foundation
  fd_decide_structure: {
    steps: [
      "Decide whether you are trading as yourself or through a company.",
      "Write down why, in one line — you will be asked this by a bank and an accountant.",
      "If you are unsure, start as a sole trader; incorporating later is normal and cheap.",
    ],
    doneWhen: "I have decided how I am trading, and I can say why",
    pitfall:
      "Incorporating first because it sounds more professional. A company you do not need costs you filings, fees and a year of admin before you have sold anything.",
    duration: "an evening of thinking, not a project",
  },
  fd_business_email: {
    steps: [
      "Buy a domain that reads like a business, not a hobby.",
      "Point an email address on it at whatever inbox you already read.",
      "Use that address for every supplier, marketplace and bank signup from here on.",
    ],
    doneWhen: "I have sent and received mail on my own domain",
    pitfall:
      "Registering with a free mailbox and planning to move later. Suppliers screen on this, and you cannot un-send a first impression.",
    duration: "under an hour, about the cost of a coffee a month",
  },
  fd_banking: {
    steps: [
      "Open an account that holds only business money.",
      "Move your starting capital into it and leave your personal money out.",
      "Pay for every unit, every fee and every tool from that account only.",
    ],
    doneWhen: "My first business expense left an account with only business money in it",
    pitfall:
      "Buying your first few units on a personal card 'just to get started'. Untangling mixed spending later is the single most common bookkeeping mess, and you pay someone by the hour to fix it.",
    duration: "days, if the bank wants documents",
  },

  // ------------------------------------------------------------- marketplace
  mk_account: {
    steps: [
      "Register for a selling account on {marketplace} using your business email.",
      "Enter your details exactly as they appear on your ID and your bank statement.",
      "Have your ID, a proof of address and your bank details ready before you start.",
    ],
    doneWhen: "I can sign in to {marketplace} Seller Central",
    pitfall:
      "A name or address that differs by a word from your documents. Amazon matches these literally, and a mismatch turns a same-day signup into a fortnight of appeals.",
    duration: "an hour to apply",
  },
  mk_verified: {
    steps: [
      "Upload the documents {marketplace} asks for, unedited and in full colour.",
      "Book the video call as soon as it is offered rather than when you feel ready.",
      "Keep the account untouched while verification is open.",
    ],
    doneWhen: "{marketplace} shows my account as verified",
    pitfall:
      "Reading the wait as rejection and opening a second account. Duplicate accounts are the fastest way to lose both.",
    duration: "days to a few weeks, and mostly out of your hands",
  },
  mk_first_disbursement: {
    steps: [
      "Complete the tax interview {marketplace} asks for — nothing pays out before it.",
      "Confirm the deposit account is the business account, not a personal one.",
      "Wait out the first settlement period rather than raising a case.",
    ],
    doneWhen: "Money from {marketplace} has landed in my business account",
    pitfall:
      "Assuming a held first payout is a problem. New accounts are routinely held for a full settlement cycle; that is the plumbing working, not failing.",
    duration: "two to four weeks after your first sale",
  },

  // -------------------------------------------------------------- retail arb
  ra_tools: {
    steps: [
      "Install the seller app you will scan with and sign in to it.",
      "Pair a scanner, or decide you are scanning with the camera and accept it is slower.",
      "Create one place — a sheet is fine — to record every product you look at, not just the ones you buy.",
    ],
    doneWhen: "I have scanned one product in a shop and recorded what I found",
    pitfall:
      "Recording only the winners. The rejects are the data that teaches you what a winner looks like, and they are free.",
    duration: "an afternoon",
  },
  ra_first_analysis: {
    steps: [
      "Paste an ASIN into the analyser.",
      "Read the arithmetic, not just the verdict — the fees and the buy-below line are the lesson.",
      "Compare the buy-below price against what you could actually pay for it today.",
    ],
    doneWhen: "I have analysed a product and understood why it came out BUY, WATCH or PASS",
    pitfall:
      "Trusting the verdict and skipping the workings. The verdict is only as good as the assumptions above it, and those are yours.",
    duration: "minutes",
    verified: true,
  },
  ra_ungated: {
    steps: [
      "Find which category or brand is blocking you, in your own {marketplace} account rather than in a forum.",
      "Get a real wholesale invoice: supplier's details, your business details, quantities, and a date inside Amazon's window.",
      "Submit it unedited and wait for the decision before applying again.",
    ],
    doneWhen: "The category is open in my account and I can list in it",
    pitfall:
      "Submitting a till receipt. It is not an invoice in any marketplace, and repeated rejected applications make the next one harder.",
    duration: "days to weeks, depending on the supplier",
  },
  ra_first_buy: {
    steps: [
      "Pick a product you have analysed, not one you have a feeling about.",
      "Buy only at or under its buy-below price.",
      "Keep the invoice — you will need it to get ungated later.",
    ],
    doneWhen: "I have bought units of an analysed product at or under my buy-below price",
    pitfall:
      "Paying slightly over because the deal is nearly good. Buy-below already contains your minimum ROI; going over it does not shave your profit, it removes the margin you set as the floor.",
    duration: "one sourcing trip",
  },
  ra_first_shipment: {
    steps: [
      "Create the shipping plan in Seller Central before you pack anything.",
      "Prep and label to the letter of the plan — polybags, suffocation warnings, expiry dates where they apply.",
      "Record what the prep and the freight actually cost you per unit.",
    ],
    doneWhen: "My units are checked in and sellable at the fulfilment centre",
    pitfall:
      "Treating prep and inbound freight as rounding errors. They are the per-unit costs that quietly turn a 30% ROI buy into a 12% one, and the analyser only knows them if you tell it.",
    duration: "a day to pack, one to two weeks to check in",
  },
  ra_first_sale: {
    steps: [
      "Confirm your listing is live and priced where your analysis assumed.",
      "Let it sell rather than undercutting on the first quiet day.",
      "Compare what you actually netted against what the analyser projected.",
    ],
    doneWhen: "A unit has sold and I have compared the real net against my projection",
    pitfall:
      "Chasing the buy box down. A price war you start costs more than the week you would have waited.",
    duration: "days to weeks after check-in",
  },
  ra_repeatable: {
    steps: [
      "Fix the hours in your week that are for sourcing, and treat them as booked.",
      "Analyse five products a day, buying none of them if none qualify.",
      "Review your rejects weekly and note which criterion killed them.",
    ],
    doneWhen: "I have run four weeks of sourcing without missing a session",
    pitfall:
      "Sourcing only when stock runs low. A funnel you run when it is calm is what stops you buying badly when it is not.",
    duration: "four weeks, by definition",
  },

  // ---------------------------------------------------------------- wholesale
  ws_website: {
    steps: [
      "Put up a single page on the domain you already own: who you are, what you sell, how to reach you.",
      "Use your domain email address on it.",
      "Stop there — this is a credibility check, not a shop.",
    ],
    doneWhen: "My domain loads a page that tells a supplier who I am",
    pitfall:
      "Spending a fortnight on a storefront nobody buys from. Suppliers look for two minutes to confirm you exist.",
    duration: "an evening",
  },
  ws_find_brands: {
    steps: [
      "List brands whose products you already see selling in your categories.",
      "Analyse three of their products at a plausible wholesale cost — roughly half retail — before you contact anyone.",
      "Keep only the brands whose numbers still work, and note why the rest failed.",
    ],
    doneWhen: "I have a shortlist of brands whose numbers work at wholesale cost",
    pitfall:
      "Approaching brands you like rather than brands that clear your ROI. Enthusiasm does not survive the price list.",
    duration: "a few evenings",
  },
  ws_outreach: {
    steps: [
      "Find the named person who handles new accounts, not the generic inbox.",
      "Write four short lines: who you are, where you sell, what you want to stock, what you are asking for.",
      "Ask for a price list and account application, and nothing else.",
    ],
    doneWhen: "I have sent a first approach to a real person at a target brand",
    pitfall:
      "A long email about your ambitions, or asking for a discount before you have an account. Both read as a hobbyist and get filed.",
    duration: "an hour per brand",
  },
  ws_account_approved: {
    steps: [
      "Complete the account application with your entity details and resale documentation.",
      "Answer their questions in a business day, every time.",
      "Get the terms — payment days, minimum order, whether you can sell on Amazon — in writing before you order.",
    ],
    doneWhen: "I have an account number and written terms from a supplier",
    pitfall:
      "Not asking about marketplace permission. Discovering after your first order that the brand forbids Amazon leaves you holding stock you cannot list.",
    duration: "one to four weeks",
  },
  ws_first_order: {
    steps: [
      "Run the price list against your buy-below numbers and keep only the lines that clear them.",
      "Order the smallest quantity the supplier will accept on the first go.",
      "Check the delivered goods and the invoice against what you ordered before you pay.",
    ],
    doneWhen: "I have placed a wholesale order priced against my own numbers",
    pitfall:
      "Buying to the minimum order value across lines that do not qualify. A supplier's minimum is their problem to solve, not a reason to buy stock that loses money.",
    duration: "days to place, weeks to arrive",
  },
}

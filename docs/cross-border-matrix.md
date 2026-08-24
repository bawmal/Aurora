# Cross-border setup: residency × marketplace

**A spec for the guidance layer (feature 14), and a correction to how the journey engine models setup milestones.**

**v1 scope: residents of Canada, the US and the United Kingdom only.** Three residencies × three marketplaces = nine cells, all of which can be stated exhaustively rather than approximated. The assessment surfaces those three as the only options — no "Other", no free-text country — so unsupported sellers self-select out before a profile exists (§1.1).

Everything below needs verification by a qualified professional before it becomes seller-facing copy. Sources are Amazon Seller Central help, GOV.UK/HMRC, IRS, and provider documentation, retrieved August 2026. Rules in this area change; several already changed in the last twelve months.

---

## 1. The modelling error this fixes

The current journey engine has a single linear setup track that implicitly assumes a Canadian seller expanding to the US. That was right for Itohan and wrong as a product.

The real shape is a **matrix**: where the seller is *resident*, crossed with where they want to *sell*. A UK resident selling on .com and a US resident selling on .co.uk are completely different setup paths that share almost no steps — and critically, the *hardest* step is different in each. For the Canadian selling into the US it's the EIN and the resale certificate. For the UK resident it's the same plus a US entity decision. For anyone selling into the UK it's VAT, which starts at the first pound.

### 1.1 Restricting v1 to CA / US / GB

This is the right call and it buys more than it costs.

The cost is small: the nine cells are the overwhelming majority of the coaching practice, and the excluded sellers were never going to be well served by a rule table built on guesswork.

What it buys:

- **The banking hard stop disappears.** Mercury's prohibited-countries list excludes founders resident in Nigeria, Pakistan, the Philippines and others; Wise restricts USD details by residence. For CA/US/GB residents every rail modelled is open, so banking stops being an eligibility question and becomes a cost-and-convenience one. The Hyperwallet fallback path can come out of v1 entirely.
- **The rule table becomes exhaustive rather than best-effort.** Nine cells can each be verified by a professional and tested in CI. Nine cells plus "OTHER" cannot — "OTHER" is where fabricated requirements live.
- **Every remaining seller can complete the journey.** No cell dead-ends.

### 1.2 A three-option picker, and the one risk it carries

Residency is asked as a closed choice of Canada, the US and the UK. No "Other", no free-text, no waitlist. Unsupported sellers never reach a profile, which is the cleanest possible enforcement — the engine only ever sees residencies it can fully serve.

The risk it introduces is worth designing for: **a picker with no escape hatch converts "I can't use this" into a mis-set field.** Someone who doesn't fit will not close the tab; they will tick whichever of the three is closest — the Canadian passport holder in Dubai picks Canada, the Irish seller picks the UK. The product then confidently runs a setup track built on a false premise, which is exactly the failure the restriction was meant to prevent, only now invisible.

Two cheap mitigations:

- **Label the field by what it actually means.** "Where do you live and pay tax?", not "Country". Most mis-selection is misunderstanding, not evasion.
- **Keep the mentor's refusal answer even though the picker exists.** Sellers ask in chat what a form won't let them say. XB-008 asserts the mentor states the three plainly and hands off to the coach rather than telling them to pick one anyway.

Two traps come with the restriction, both now in the golden set:

- **Citizenship is not residency** (XB-022), the case the picker makes *more* likely rather than less. A Canadian passport holder living in Dubai is not a supported CA seller; tax residency and provider eligibility follow where they live.
- **Residency is mutable** (XB-023). Sellers move. Changing `profile.residency` must re-derive the setup requirements without discarding journey progress — which is an argument for the generated rule table below rather than a fixed authored graph.

Keep `Residency` as a closed union with no `OTHER` member, so an unsupported country is unrepresentable in the type rather than a value that flows into the rule table. The picker and the type then say the same thing.

### What this means structurally

Setup milestones must be **generated from a jurisdiction rule table**, not hand-authored as a fixed graph. Proposal:

```ts
// lib/domain/jurisdictions.ts — pure, no I/O, CI-validated like the fee tables

// v1: closed sets. An unsupported residency is unrepresentable, not a value
// the rule table has to defend against.
type Residency   = "CA" | "US" | "GB"
type Marketplace = "amazon.ca" | "amazon.com" | "amazon.co.uk"

interface SetupRequirement {
  id: string                    // "us.ein", "uk.vat", "payout.usd"
  applies: (r: Residency, m: Marketplace, ctx: SellerContext) => boolean
  severity: "required" | "conditional" | "recommended"
  blocks: MilestoneId[]         // what cannot start until this is done
  officialSource: string        // URL — this is time-sensitive, always cite
  professionalAdvice: boolean   // must carry the disclaimer
}
```

The journey engine then computes the setup track as `requirements.filter(r => r.applies(residency, marketplace, ctx))` rather than walking a fixed node list. Same pattern as the milestone library: logic in code, CI-validated, no database dependency.

Two fields need to exist on the profile before any of this works, and I don't think both are there today:

- `profile.residency` — the seller's country of tax residence, which is **not** the same as their marketplace and not the same as their entity's country of registration. All three can differ and the rules key off different ones.
- `profile.entityJurisdiction` — where the operating entity is registered, nullable until they incorporate.

---

## 2. The five dimensions each cell resolves

For any (residency, marketplace) pair the guidance layer must answer:

1. **Entity** — can they sell as an individual, do they need a local entity, and does the marketplace care?
2. **Tax identity** — which tax interview, which form, which identifier, and whether a local one is accepted.
3. **Consumption tax** — GST/HST, US sales tax, or VAT: what the marketplace collects for them versus what they still owe.
4. **Money** — how proceeds reach them. The binding constraint for many sellers.
5. **Goods movement** — importer of record, duty, and customs identifiers when inventory crosses a border.

Plus the ungating documentation question, which as established is marketplace-specific.

---

## 3. Selling on Amazon.com

### 3.1 Canadian resident → .com

The path already encoded in the product, now scoped correctly as one cell of many.

| Dimension | Position |
| --- | --- |
| Entity | Canadian entity can sell on .com. A US entity is optional and is usually driven by banking and supplier access rather than by Amazon. |
| Tax identity | Amazon's tax interview is mandatory. A Canadian entity generally completes **W-8BEN-E**. Treaty benefit claims require a TIN — a **foreign** TIN is acceptable to the IRS, so the Canadian BN can serve; an EIN is not automatically required. An EIN *does* become necessary for a US entity or for most US banking. |
| Consumption tax | Amazon is a marketplace facilitator in all US sales-tax states and collects and remits on .com orders. **This does not eliminate nexus.** FBA inventory stored in a state creates physical nexus, a handful of states require registration regardless, and non-Amazon channels are not covered. |
| Money | Amazon Currency Converter pays a Canadian bank in CAD. A USD receiving account (Wise) or a US business account (Mercury, requires a US entity) avoids the conversion spread and is needed for paying US suppliers and prep centres. |
| Goods movement | **Amazon will not act as importer of record for FBA inventory, ever.** The seller or a designated IOR must file the entry. The US duty-free de minimis exemption has been suspended, so duty is a mandatory landed-cost line on US-bound inventory, not an edge case. |
| Ungating | .com requires an authorised distributor or brand invoice. The Canadian retailer-invoice routes do not transfer. |

### 3.2 UK resident → .com

Same shape, different inputs. W-8BEN-E with the UK entity's local tax number; the UK–US treaty is favourable but the claim still needs a TIN. Banking is straightforward — Wise and Payoneer are open, and Mercury accepts UK-resident founders provided the entity is US-formed. Goods movement is the real divergence from Canada: no land border, so a freight forwarder and a US-side IOR arrangement are effectively mandatory, which usually means a prep centre *before* the first shipment rather than after.

### 3.3 US resident → .com

The only cell with no cross-border dimension at all: domestic entity, EIN they likely already have, state resale certificate, sales-tax nexus, no IOR question, no currency spread. Worth naming explicitly in the journey engine because it is the cell where most of the setup track should be **absent** — a US seller shown an EIN milestone and a currency-conversion milestone will reasonably conclude the product does not know who they are.

### 3.4 Banking as a sequencing rule

Within CA/US/GB the payout rails are all open, so the old hard stop is gone. One ordering rule survives and still matters: **Mercury requires a US-formed entity and an EIN**, so a CA or GB seller cannot open it first. The dependency is entity → EIN → US bank, and the journey must not surface "open a US business account" as an available action before the entity exists.

---

## 4. Selling on Amazon.co.uk

The UK is a materially harder compliance environment for non-established sellers than the US, and the product should say so rather than presenting it as a symmetric expansion.

### 4.1 The VAT position for a non-UK-established seller

**There is no registration threshold.** The £90,000 threshold applies to UK-established businesses. A non-established taxable person (NETP) must register for UK VAT if they make taxable supplies in the UK *of any value*. This is the single most commonly missed fact for US and Canadian sellers expanding to .co.uk, and it is the opposite of the intuition they bring from their home market.

There is a narrow exemption: an overseas seller whose UK sales are *all* made through an online marketplace to non-business customers, with the goods *outside* the UK at point of sale, in consignments of £135 or less, does not need to register — because the marketplace becomes the deemed supplier.

**That exemption does not survive using FBA UK.** The moment stock sits in a UK fulfilment centre, the goods are in the UK at point of sale. Amazon is still deemed supplier for the B2C sale and accounts for the output VAT, but the seller has a registration liability under Schedule 1A (exemption can be requested where the deemed supply is zero-rated). The practical planning assumption for any seller storing stock in the UK should be: **you will need a UK VAT registration.** The precise treatment of the exemption request is exactly the sort of thing to put to an accountant rather than encode as a rule.

### 4.2 GB EORI

Importing into Great Britain requires an EORI number beginning **GB**. An EU EORI is not valid post-Brexit. Storing stock in UK FBA means an import declaration, which means a GB EORI in the seller's own name. A non-established business can obtain one, and it is free. Non-UK businesses do not need a UTR, SIC code or National Insurance number to apply.

### 4.3 US resident → .co.uk

Sells as the US entity; no UK entity required. Needs GB EORI, near-certainly needs UK VAT registration if using FBA UK, and needs a GBP receiving account (Wise handles this cleanly, or Amazon Currency Converter pays the US account in USD with a spread). Cheapest first step is usually to test demand via FBM from the US before creating a UK VAT footprint.

### 4.4 Canadian resident → .co.uk

Same as above with a Canadian entity. Worth stating plainly in the journey: for a Canadian seller, **.com is a lower-friction expansion than .co.uk** — shared language and consumer behaviour, a land border, no automatic VAT registration obligation, and marketplace facilitator coverage that is broader in practice. Unless the seller has a UK-specific reason, the default expansion order should be .ca → .com → .co.uk.

---

## 5. Selling on Amazon.ca as a US or UK resident

Rarely the first move but it completes the matrix. A non-resident can sell on .ca. GST/HST registration rules turn on whether the seller is carrying on business in Canada and on the threshold; marketplace facilitator rules mean Amazon collects on many transactions. Storing inventory in Canadian FBA is the usual trigger for a registration obligation. There is also a **non-resident importer** regime for goods movement. All of this to a professional.

---

## 6. What the guidance layer must never do here

- **Never state a tax position as settled.** Every cell above carries a professional-advice disclaimer, and the mentor must route rather than rule.
- **Never serve an unsupported residency.** The picker prevents it structurally; the mentor must still name the three plainly when asked, and must never suggest picking the nearest one. Do not degrade to generic advice.
- **Never recommend a provider whose prerequisites the seller has not met.** Within v1 this is the entity requirement rather than residency, but the principle is the same: check state before naming a provider.
- **Never present a provider list as a ranking or endorsement.** Categories and eligibility, not "use Mercury."
- **Never carry a rule across marketplaces.** The Canadian ungating routes, the US threshold intuition, and the marketplace-facilitator shield all fail when moved.
- **Always cite the official source and its retrieval date.** These rules changed twice in the last year — de minimis and the enforcement posture on importer of record. Cached guidance goes stale silently, which is the dangerous failure mode.

## 7. Suggested build order

1. Add `profile.residency` and `profile.entityJurisdiction`. Small change, blocks everything else.
2. Make the assessment's residency question a three-option picker labelled by meaning ("where do you live and pay tax?"), before the journey is generated.
3. Build `lib/domain/jurisdictions.ts` with the CA/US/GB residency set and the three marketplaces, as a pure rule table with CI tests. Assert the negatives explicitly — a test that fails if a US-resident profile is ever shown the EIN milestone, or if Mercury is offered before an entity exists, is worth more than a test that checks the happy path.
4. Make the setup track generated rather than authored, and check the ungating milestone gets marketplace-scoped prerequisites at the same time.
5. Only then write seller-facing copy, with the disclaimer and source citation attached at the data layer so it cannot be rendered without them.

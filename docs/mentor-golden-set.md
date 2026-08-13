# Golden set — cover notes

## What this is

156 test cases for feature 05 (AI Mentor). **v1 serves residents of Canada, the US and the UK only** — see "Restricted to CA/US/GB" below.

- `golden-set.json` — machine-readable, drop into `tests/fixtures/`
- `golden-set.md` — review copy
- `cross-border-matrix.md` — the residency × marketplace spec for the guidance layer (feature 14)
- `check-links.py` — link-rot checker for the registries
- `build_golden_set.py` — the generator; the set is built and validated, not hand-maintained

Sources: the Bawo/Itohan WhatsApp coaching log, the training deck, the Itohan Accelerator workbook, and Amazon Seller Central forums, HMRC/GOV.UK, IRS, CRA and provider documentation.

## Every case answers "why" and "do this now"

Two registries, and this is the part that makes it a product rather than a knowledge base:

- **`cite`** — the *authority*. HMRC's NETP guidance, the IRS treaty page, Amazon's importer-of-record page. Answers why the rule is what it is, and lets the seller check you.
- **`act`** — the *means to act*. The SS-4 PDF, the IRS international phone line with its hours, the fax numbers and the Cincinnati mailing address, the Wise signup link with the exact reason account details don't appear yet, the GB EORI apply page. Each carries what to have ready before starting and a realistic timeline.

58 cases must cite; 54 must hand over an action. Two assertions are appended automatically:

> must not: *answering a policy, tax, legal or provider-eligibility question without linking the official source*
> must not: *explaining a setup step without handing over the actual link, form or number to do it*

The generator **fails the build** if a compliance, cross-border, banking, VAT, gating or account-health case has no citation, or a setup case has no action. Exemptions are listed by case ID in `NO_SOURCE_OK` so they stay reviewable rather than drifting.

No link is guessed. Where a canonical public URL couldn't be verified — mostly Seller Central pages behind region and login gating — the entry carries an honest in-app locator instead (`Seller Central > Settings > Account Info > Tax Information > Tax Interview`). All 27 public URLs were HTTP-checked; 0 dead. 23 entries are locator-only and need periodic human re-walking, which `check-links.py` lists out. Run it on a schedule: a dead link the mentor hands a seller is worse than no link, because they trust it and lose an afternoon.

## The state requirement

Every case also lists the profile/journey state the mentor must read. **If it produces a plausible answer without consulting that state, the case fails even if the prose is good.** A general assistant answers "what ROI should I aim for?" fluently and wrongly, because the right answer is *the seller's configured floor and who set it*.

## Ungating — corrected

Marketplace-dependent, and the crux is receipt vs invoice, not retail vs wholesale:

- **.com** rejects retail documentation. Requires an authorised distributor or brand invoice with a minimum unit count, recency window, and exact business-name match.
- **.ca** still clears some retailer-issued **invoices**. A till receipt does not work. Staples issues invoices directly; Canadian Tire via online order with in-store pickup, which works *sometimes*; Shoppers Drug Mart via a cultivated manager relationship for bulk purchases.

Six cases: GATE-002 (route by marketplace), GATE-003 (the distinction, honestly hedged), GATE-003B (which retailers, and the mechanism), GATE-003C (trap — must refuse to carry the .ca route to .com), GATE-003D (cultivating the manager relationship), GATE-004 (checks document type first when diagnosing a rejection).

## Cross-border is a matrix, not a path

Full detail in `cross-border-matrix.md`. The headline: the current journey engine has one linear setup track that implicitly assumes Canada → US. A UK resident on .com and a US resident on .co.uk share almost no steps, and the *hardest* step differs in each.

Three findings worth your attention:

**1. Banking is now a sequencing problem, not an eligibility one.** Restricting to CA/US/GB removes the hard stop — every rail modelled is open to all three. What survives is an ordering dependency: **Mercury requires a US-formed entity and an EIN**, so entity → EIN → US bank, and the journey must not surface "open a US business account" before the entity exists. XB-007 asserts the entity check; XB-009 reframes provider choice as cost and convenience.

**2. The UK is materially harder than the US for non-established sellers, and the intuition is backwards.** There is **no VAT registration threshold** for a non-established taxable person — the £90,000 figure is for UK-established businesses. Any taxable supply triggers registration. There's a narrow exemption for marketplace sales where the goods sit outside the UK in consignments ≤ £135, but holding stock in FBA UK defeats it. Plus a GB EORI is required to import, and an EU EORI is not valid post-Brexit. Practical consequence for the journey engine: for a Canadian seller the default expansion order should be .ca → .com → .co.uk, because .co.uk carries an immediate compliance cost that .com does not.

**3. Structural implication.** Setup milestones should be *generated* from a jurisdiction rule table (`lib/domain/jurisdictions.ts`, pure and CI-validated like the fee tables) rather than hand-authored as a fixed graph. Needs two new profile fields — `profile.residency` and `profile.entityJurisdiction` — which are distinct from each other and from the marketplace. The matrix doc has the proposed type signature and build order.

## Restricted to CA/US/GB

The nine cells (three residencies × three marketplaces) can each be professionally verified and CI-tested; an open-ended set cannot, and "OTHER" is where fabricated requirements live. Three consequences for the build:

- **The picker enforces it structurally.** Residency is a closed choice of the three — no "Other", no free-text, no waitlist — so unsupported sellers never reach a profile. The mentor still needs the refusal answer, because sellers ask in chat what a form won't let them say, and it must not tell them to pick the nearest one. XB-008.
- **Citizenship is not residency — and the picker makes this *more* likely, not less.** With no escape hatch, someone who doesn't fit ticks whichever of the three is closest rather than leaving: the Canadian passport holder in Dubai picks Canada. The setup track then runs confidently on a false premise. Cheapest mitigation is labelling the field by meaning — "where do you live and pay tax?", not "Country". XB-022.
- **Residency is mutable.** Sellers move; changing `profile.residency` must re-derive requirements without discarding journey progress. Another argument for a generated rule table over an authored graph. XB-023.

Keep `Residency` a closed union with no `OTHER` member so an unsupported country is unrepresentable in the type — the picker and the type then say the same thing.

## One product idea from the coaching log

You sent Itohan your Mercury referral link. The action registry should support **coach-scoped overrides**: where a coach has a referral or a vetted provider, the guidance layer hands over *their* link rather than the generic one. Same pattern as coach-scoped rules, and it's a revenue line that costs the seller nothing. I've included `coach.accountant` and `coach.escalate` as actions so routing to a human is a first-class action rather than a dead end.

## Coverage gaps

- **Only 3 seasonality cases.** Hard to write without real detected-peak outputs to assert against; best done after S4.
- **No multi-turn cases.** All single-turn. The hardest mentor failures are contextual ("what's the most I should pay?" three turns after an ASIN was mentioned).
- **EU marketplaces are unmodelled**, now deliberately out of scope. OSS/IOSS is a whole additional axis when you add them.
- **No cases for mis-set residency detected later.** The picker guarantees a valid-looking value, so the failure is silent; worth deciding whether anything downstream (payout country, entity jurisdiction) should flag a contradiction.
- **Phrasing is cleaned up.** Real seller questions are typo-ridden and half-formed; worth taking 20 verbatim from WhatsApp once you have more logs.

## Everything above needs professional verification

Tax, VAT, customs and entity rules change, and several in here changed within the last twelve months — de minimis and the importer-of-record enforcement posture especially. Sources are cited with a `retrieved` date of 2026-08-12 for exactly this reason. Nothing here should become seller-facing copy without an accountant reviewing it, and the mentor's job is to route and hand over forms, never to give the ruling.

## Suggested next step

Wire the JSON into a runner: for each case, execute the mentor against a fixture seller in the right state, grade `must`/`mustnot` with an LLM judge, and assert `cite`/`act` mechanically — those are exact-match checks on URLs and identifiers, not judgement calls, so they're the cheapest and most reliable signal in the suite. Gate at 100% on `mustnot` and on citation/action presence; start the `must` target at 85% and ratchet.

Fixture sellers: pre-account Canadian; new seller with .ca and no US; RA-operating mid-US-expansion (Itohan's actual state); wholesale-ready; UK resident; US resident (the cell with almost no setup track — asserts the engine *omits* the EIN and currency milestones); and one unsupported residency to assert the mentor's refusal in chat. Seven fixtures cover all 156 cases.

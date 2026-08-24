import { describe, expect, it } from "vitest"
import raw from "../../tests/fixtures/golden-set.json"
import { actionNeedles, citationNeedles, gradeCase, mechanicalChecks, summarise } from "../grade"
import type { GoldenCase, GoldenSet, MentorResponse } from "../types"

const set = raw as unknown as GoldenSet

/**
 * These tests validate the fixture and the grader, not the mentor — the
 * mentor does not exist yet. They exist so that when it does, the harness
 * around it is already known-good, and so the fixture cannot silently rot.
 */

const CITE_CATS = new Set([
  "compliance",
  "cross-border",
  "banking",
  "vat",
  "gating",
  "account-health",
])

describe("fixture integrity", () => {
  it("matches its declared count", () => {
    expect(set.items.length).toBe(set.meta.count)
  })

  it("has unique case ids", () => {
    expect(new Set(set.items.map((i) => i.id)).size).toBe(set.items.length)
  })

  it("resolves every citation key against the source registry", () => {
    for (const item of set.items) {
      for (const entry of item.cite) {
        expect(
          set.meta.source_registry[entry.key],
          `${item.id} cites unknown source ${entry.key}`,
        ).toBeTruthy()
      }
    }
  })

  it("resolves every action key against the action registry", () => {
    for (const item of set.items) {
      for (const entry of item.act) {
        expect(
          set.meta.action_registry[entry.key],
          `${item.id} uses unknown action ${entry.key}`,
        ).toBeTruthy()
      }
    }
  })

  it("leaves no case citation without a url or an in-app locator", () => {
    for (const item of set.items) {
      for (const entry of item.cite) {
        expect(
          Boolean(entry.url || entry.locator),
          `${item.id} cites ${entry.key}, which is unverifiable`,
        ).toBe(true)
      }
    }
  })

  it("leaves no source entry without a url or an in-app locator", () => {
    for (const [key, entry] of Object.entries(set.meta.source_registry)) {
      expect(Boolean(entry.url || entry.locator), `source ${key} is unverifiable`).toBe(true)
    }
  })

  it("leaves no action entry the seller cannot act on", () => {
    for (const [key, entry] of Object.entries(set.meta.action_registry)) {
      expect(
        Boolean(entry.url || entry.contact || entry.locator),
        `action ${key} is not actionable`,
      ).toBe(true)
    }
  })

  it("requires a citation on every regulated case", () => {
    const missing = set.items
      .filter((i) => CITE_CATS.has(i.cat) && i.cite.length === 0)
      .map((i) => i.id)
    // A short exemption list is fine; silent drift is not. These are pure
    // judgement or methodology questions with no external authority behind
    // them, so the list is asserted exactly and a new entry has to be a
    // deliberate decision made in review.
    expect(missing).toEqual([
      "GATE-005",
      "GATE-009",
      "GATE-010",
      "GATE-012",
      "GATE-013",
      "GATE-015",
      "GATE-016",
      "SET-013",
      "SET-014",
    ])
  })

  it("gives every case something to assert", () => {
    for (const item of set.items) {
      expect(item.must.length + item.mustnot.length, `${item.id} asserts nothing`).toBeGreaterThan(0)
    }
  })

  it("names the state the mentor must read, except where the answer is stateless", () => {
    const stateless = set.items.filter((i) => i.state.length === 0).map((i) => i.id)
    expect(stateless.length).toBeLessThan(set.items.length * 0.1)
  })
})

describe("scope: CA/US/GB only", () => {
  const scopeCases = set.items.filter((i) => i.cat === "scope")

  it("carries the out-of-scope cases", () => {
    expect(scopeCases.map((i) => i.id)).toContain("XB-008")
  })

  it("routes an unsupported residency to a human rather than answering", () => {
    const unsupported = set.items.find((i) => i.id === "XB-008")!
    expect(unsupported.route).toBe("human-coach")
    expect(unsupported.mustnot.join(" ")).toMatch(/generating a setup journey/)
  })

  it("treats citizenship-as-residency as a trap that must not run the CA track", () => {
    const trap = set.items.find((i) => i.id === "XB-022")!
    expect(trap.adv).toBe(true)
    expect(trap.mustnot.join(" ")).toMatch(/citizenship as residency/i)
  })
})

describe("grader", () => {
  const withCitation = set.items.find((i) => i.cite.length > 0 && i.act.length > 0)!

  const answerContaining = (needles: string[]): MentorResponse => ({
    text: `Here is what to do. ${needles.join(" ")}`,
    stateRead: withCitation.state,
    route: withCitation.route,
  })

  const allNeedles = (item: GoldenCase) => [
    ...item.cite.flatMap(citationNeedles),
    ...item.act.flatMap(actionNeedles),
  ]

  it("passes an answer that cites, hands over and reads state", () => {
    const checks = mechanicalChecks(withCitation, answerContaining(allNeedles(withCitation)))
    expect(checks.every((c) => c.passed)).toBe(true)
  })

  it("fails a fluent answer that cites nothing", () => {
    const response: MentorResponse = {
      text: "You'll need to register for that. It's fairly straightforward.",
      stateRead: withCitation.state,
      route: withCitation.route,
    }
    const checks = mechanicalChecks(withCitation, response)
    expect(checks.some((c) => !c.passed)).toBe(true)
  })

  it("fails an answer that never consulted seller state, however good the prose", () => {
    const stateful = set.items.find((i) => i.state.length > 0)!
    const response: MentorResponse = {
      text: allNeedles(stateful).join(" "),
      stateRead: [],
      route: stateful.route,
    }
    const checks = mechanicalChecks(stateful, response)
    const stateCheck = checks.find((c) => c.name === "consulted state")
    expect(stateCheck?.passed).toBe(false)
  })

  it("fails a mis-routed answer", () => {
    const routed = set.items.find((i) => i.route === "human-coach")!
    const response: MentorResponse = {
      text: allNeedles(routed).join(" "),
      stateRead: routed.state,
      route: "none",
    }
    expect(mechanicalChecks(routed, response).find((c) => c.name === "route")?.passed).toBe(false)
  })

  it("tolerates typographic differences in an action, so an en dash in a phone number still counts", async () => {
    const phone = set.items.find((i) => i.act.some((a) => a.key === "ein.phone.intl"))
    expect(phone, "the EIN phone action should be on at least one case").toBeTruthy()
    const entry = phone!.act.find((a) => a.key === "ein.phone.intl")!
    const text = (entry.contact ?? "").replace(/-/g, "\u2013")
    const result = await gradeCase(
      { ...phone!, cite: [], act: [entry], state: [] },
      { text, stateRead: [], route: phone!.route },
    )
    expect(result.checks.find((c) => c.name === "act:ein.phone.intl")?.passed).toBe(true)
  })

  it("separates adversarial failures in the summary", () => {
    const summary = summarise([
      { id: "A", adversarial: true, checks: [], passed: false },
      { id: "B", adversarial: false, checks: [], passed: false },
      { id: "C", adversarial: false, checks: [], passed: true },
    ])
    expect(summary).toEqual({
      total: 3,
      passed: 1,
      failed: ["A", "B"],
      adversarialFailed: ["A"],
    })
  })
})

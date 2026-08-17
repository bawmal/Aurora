import { describe, expect, it } from "vitest"
import {
  ACHIEVEMENTS,
  MILESTONES,
  SKILLS,
  TRACKS,
  milestonesFor,
} from "../curriculum"
import {
  baseKey,
  completeMilestone,
  instanceKey,
  isTrackOpen,
  milestoneStates,
  nextMove,
  readiness,
  recordAnalysis,
  resolveGate,
  resolveGuidance,
  unlockProgress,
} from "../journey"
import type { JourneyProgress, SellerProfile } from "../types"
import { NO_EXTRA_COSTS, NO_PROGRESS } from "../types"

const seller = (over: Partial<SellerProfile> = {}): SellerProfile => ({
  id: "t",
  residency: "CA",
  entityJurisdiction: null,
  marketplaces: ["amazon.ca"],
  stage: "pre-account",
  minRoi: 0.3,
  capital: 2000,
  costs: NO_EXTRA_COSTS,
  completedRequirements: [],
  provenance: {},
  ...over,
})

const progress = (over: Partial<JourneyProgress> = {}): JourneyProgress => ({
  ...NO_PROGRESS,
  ...over,
})

describe("curriculum integrity", () => {
  it("has unique milestone, track, skill and achievement keys", () => {
    const unique = (keys: string[]) => expect(new Set(keys).size).toBe(keys.length)
    unique(MILESTONES.map((m) => m.key))
    unique(TRACKS.map((t) => t.type))
    unique(SKILLS.map((s) => s.key))
    unique(ACHIEVEMENTS.map((a) => a.key))
  })

  it("has exactly one guidance module for every milestone", async () => {
    const { MODULE_GUIDANCE } = await import("../guidance")
    expect(Object.keys(MODULE_GUIDANCE).sort()).toEqual(
      MILESTONES.map((milestone) => milestone.key).sort(),
    )
  })

  it("resolves marketplace guidance from an instance key", () => {
    const guidance = resolveGuidance("mk_account@amazon.co.uk", "amazon.co.uk")
    expect(guidance?.steps[0]).toContain("amazon.co.uk")
    expect(guidance?.doneWhen).toContain("amazon.co.uk")
    expect(resolveGuidance("missing")).toBeNull()
  })

  it("has no dependency pointing at a milestone that does not exist", () => {
    const keys = new Set(MILESTONES.map((m) => m.key))
    for (const milestone of MILESTONES) {
      for (const dependency of milestone.dependencies) {
        expect(keys.has(dependency), `${milestone.key} depends on ${dependency}`).toBe(true)
      }
    }
  })

  it("keeps dependencies inside their own track, so tracks stay parallel", () => {
    const track = new Map(MILESTONES.map((m) => [m.key, m.track]))
    for (const milestone of MILESTONES) {
      for (const dependency of milestone.dependencies) {
        expect(track.get(dependency)).toBe(milestone.track)
      }
    }
  })

  it("has no cycles", () => {
    const byKey = new Map(MILESTONES.map((m) => [m.key, m]))
    const walk = (key: string, seen: string[]): void => {
      expect(seen.includes(key), `cycle through ${key}`).toBe(false)
      for (const dep of byKey.get(key)?.dependencies ?? []) walk(dep, [...seen, key])
    }
    for (const milestone of MILESTONES) walk(milestone.key, [])
  })

  it("never duplicates a compliance step as a milestone", () => {
    // Compliance belongs in the rule table, where it is conditional. A
    // milestone called "Get an EIN" would appear on every seller's map.
    const names = MILESTONES.map((m) => m.name.toLowerCase())
    for (const banned of ["ein", "vat", "eori", "w-8", "tax interview"]) {
      expect(names.some((n) => n.includes(banned))).toBe(false)
    }
  })

  it("only references requirement ids the jurisdiction table defines", async () => {
    const { REQUIREMENTS } = await import("../jurisdictions")
    const ids = new Set(REQUIREMENTS.map((r) => r.id))
    for (const milestone of MILESTONES) {
      for (const requirement of milestone.requires) {
        expect(ids.has(requirement), `${milestone.key} requires ${requirement}`).toBe(true)
      }
    }
  })

  it("every requirement blocks a milestone or another requirement that exists", async () => {
    // The two tables share one vocabulary. Without this, a requirement can
    // silently block nothing and never reach a seller. A requirement may
    // also gate another requirement: an EIN really does come before a US
    // bank account.
    const { REQUIREMENTS } = await import("../jurisdictions")
    const known = new Set([...MILESTONES.map((m) => m.key), ...REQUIREMENTS.map((r) => r.id)])
    for (const requirement of REQUIREMENTS) {
      for (const blocked of requirement.blocks) {
        expect(known.has(blocked), `${requirement.id} blocks ${blocked}`).toBe(true)
      }
    }
  })

  it("every gate is reachable from the milestone it gates", async () => {
    // A requirement listed on a milestone must also name that milestone in
    // its own `blocks`, or `dueRequirements` will never surface it.
    const { REQUIREMENTS } = await import("../jurisdictions")
    for (const milestone of MILESTONES) {
      for (const id of milestone.requires) {
        const requirement = REQUIREMENTS.find((r) => r.id === id)
        expect(requirement?.blocks, `${id} on ${milestone.key}`).toContain(milestone.key)
      }
    }
  })

  it("achievements only fire on things that exist", () => {
    const keys = new Set(MILESTONES.map((m) => m.key))
    const tracks = new Set(TRACKS.map((t) => t.type))
    for (const achievement of ACHIEVEMENTS) {
      if ("milestone" in achievement.on) expect(keys.has(achievement.on.milestone)).toBe(true)
      if ("trackUnlocked" in achievement.on) expect(tracks.has(achievement.on.trackUnlocked)).toBe(true)
    }
  })

  it("gives every skill five rungs", () => {
    for (const skill of SKILLS) expect(skill.levels).toHaveLength(5)
  })
})

describe("milestone states", () => {
  it("raises a milestone's coached skill once and caps it at five", () => {
    const first = completeMilestone(progress(), "ra_first_analysis")
    expect(first.skills["product-analysis"]).toBe(1)
    expect(completeMilestone(first, "ra_first_analysis")).toBe(first)

    const capped = completeMilestone(
      progress({ skills: { "product-analysis": 5 } }),
      "ra_first_analysis",
    )
    expect(capped.skills["product-analysis"]).toBe(5)
  })

  it("records distinct analyses and completes the first-analysis outcome", () => {
    const first = recordAnalysis(progress(), "b071cp6x88")
    expect(first.analysedAsins).toEqual(["B071CP6X88"])
    expect(first.productsAnalysed).toBe(1)
    expect(first.completedMilestones).toContain("ra_first_analysis")
    expect(first.skills["product-analysis"]).toBe(1)

    const repeated = recordAnalysis(first, "B071CP6X88")
    expect(repeated.analysedAsins).toEqual(["B071CP6X88"])
    expect(repeated.productsAnalysed).toBe(1)

    const manual = recordAnalysis(progress(), "")
    expect(manual.completedMilestones).toContain("ra_first_analysis")
    expect(manual.analysedAsins).toEqual([])
    expect(manual.productsAnalysed).toBe(0)
  })

  it("resolves dependency and compliance gates with their domain records", () => {
    expect(resolveGate("ra_first_buy")).toEqual({
      kind: "milestone",
      milestone: expect.objectContaining({ key: "ra_first_buy" }),
    })
    expect(resolveGate("amz.tax-interview")).toEqual({
      kind: "requirement",
      requirement: expect.objectContaining({
        id: "amz.tax-interview",
        title: "Complete Amazon's tax interview",
        professionalAdvice: false,
      }),
    })
    expect(resolveGate("missing")).toBeNull()
  })

  it("shows exactly one next move", () => {
    const states = milestoneStates(seller(), progress())
    expect(states.filter((s) => s.status === "next")).toHaveLength(1)
    expect(nextMove(seller(), progress())).not.toBeNull()
  })

  it("instantiates marketplace milestones once per marketplace", () => {
    const states = milestoneStates(
      seller({ marketplaces: ["amazon.ca", "amazon.com"] }),
      progress(),
    )
    const accounts = states.filter((s) => baseKey(s.key) === "mk_account")
    expect(accounts.map((s) => s.marketplace).sort()).toEqual(["amazon.ca", "amazon.com"])
  })

  it("progresses one marketplace without touching the other", () => {
    const states = milestoneStates(
      seller({ marketplaces: ["amazon.ca", "amazon.com"] }),
      progress({ completedMilestones: [instanceKey("mk_account", "amazon.ca")] }),
    )
    const ca = states.find((s) => s.key === instanceKey("mk_verified", "amazon.ca"))
    const us = states.find((s) => s.key === instanceKey("mk_verified", "amazon.com"))
    expect(ca?.status).not.toBe("gated")
    expect(us?.status).toBe("gated")
  })

  it("gates a milestone on its unfinished dependencies and names them", () => {
    const shipment = milestoneStates(seller(), progress()).find(
      (s) => s.key === "ra_first_shipment",
    )
    expect(shipment?.status).toBe("gated")
    expect(shipment?.blockedBy).toContain("ra_first_buy")
  })

  it("opens a milestone once its dependencies clear", () => {
    const states = milestoneStates(
      seller(),
      progress({ completedMilestones: ["ra_first_analysis", "ra_first_buy"] }),
    )
    expect(states.find((s) => s.key === "ra_first_shipment")?.status).not.toBe("gated")
  })

  it("hides a locked track entirely rather than teasing it", () => {
    const keys = milestoneStates(seller(), progress()).map((s) => s.key)
    for (const milestone of milestonesFor("wholesale")) {
      expect(keys).not.toContain(milestone.key)
    }
  })

  it("lets a seller analyse products before any account exists", () => {
    // The first analysis milestone must never be gated behind setup, or the
    // fastest useful thing in the product sits behind the slowest.
    const first = milestoneStates(seller(), progress()).find((s) => s.key === "ra_first_analysis")
    expect(first?.blockedBy).toEqual([])
  })
})

describe("compliance gates reach the map only where they apply", () => {
  it("blocks a first disbursement on the tax interview", () => {
    const state = milestoneStates(
      seller({ marketplaces: ["amazon.ca"] }),
      progress({
        completedMilestones: [
          instanceKey("mk_account", "amazon.ca"),
          instanceKey("mk_verified", "amazon.ca"),
        ],
      }),
    ).find((s) => baseKey(s.key) === "mk_first_disbursement")
    expect(state?.blockedBy).toContain("amz.tax-interview")
  })

  it("drops the gate once the seller has done it", () => {
    const state = milestoneStates(
      seller({ marketplaces: ["amazon.ca"], completedRequirements: ["amz.tax-interview"] }),
      progress({
        completedMilestones: [
          instanceKey("mk_account", "amazon.ca"),
          instanceKey("mk_verified", "amazon.ca"),
        ],
      }),
    ).find((s) => baseKey(s.key) === "mk_first_disbursement")
    expect(state?.blockedBy).not.toContain("amz.tax-interview")
  })

  it("does not show a Canadian domestic seller a US payout gate", () => {
    const states = milestoneStates(seller({ marketplaces: ["amazon.ca"] }), progress())
    const gates = states.flatMap((s) => s.blockedBy)
    expect(gates).not.toContain("us.ein")
    expect(gates).not.toContain("us.w8bene")
  })
})

describe("unlocks", () => {
  it("keeps wholesale shut for a seller who has never sold", () => {
    const u = unlockProgress("wholesale", seller(), progress())
    expect(u.unlocked).toBe(false)
    expect(u.fraction).toBeLessThan(1)
    expect(isTrackOpen("wholesale", seller(), progress())).toBe(false)
  })

  it("names exactly what is outstanding rather than showing a bare percentage", () => {
    const u = unlockProgress("wholesale", seller(), progress())
    expect(u.outstanding.length).toBeGreaterThan(0)
    expect(u.outstanding.join(" ")).toContain("registered business")
    expect(u.outstanding.join(" ")).toContain("Product analysis at level 3")
  })

  it("opens wholesale when every requirement is met", () => {
    const ready = seller({ entityJurisdiction: "CA" })
    const done = progress({
      completedMilestones: ["ra_first_sale", "fd_business_email"],
      skills: { "product-analysis": 3 },
    })
    const u = unlockProgress("wholesale", ready, done)
    expect(u.unlocked).toBe(true)
    expect(u.fraction).toBe(1)
    expect(isTrackOpen("wholesale", ready, done)).toBe(true)
    expect(milestoneStates(ready, done).some((s) => s.key === "ws_website")).toBe(true)
  })

  it("does not open wholesale on skill alone", () => {
    const u = unlockProgress(
      "wholesale",
      seller({ entityJurisdiction: "CA" }),
      progress({ skills: { "product-analysis": 5 } }),
    )
    expect(u.unlocked).toBe(false)
  })
})

describe("readiness", () => {
  it("is zero across the board for a seller who has done nothing", () => {
    const r = readiness(seller(), progress())
    expect(r.overall).toBe(0)
    expect(r.dimensions.business).toBe(0)
  })

  it("reports each marketplace separately rather than averaging them away", () => {
    const r = readiness(
      seller({ marketplaces: ["amazon.ca", "amazon.com"] }),
      progress({
        completedMilestones: [
          instanceKey("mk_account", "amazon.ca"),
          instanceKey("mk_verified", "amazon.ca"),
          instanceKey("mk_first_disbursement", "amazon.ca"),
        ],
      }),
    )
    expect(r.marketplaces["amazon.ca"]).toBe(1)
    expect(r.marketplaces["amazon.com"]).toBe(0)
  })

  it("does not hold a retail seller down for an untouched wholesale track", () => {
    const retailOnly = readiness(
      seller(),
      progress({ completedMilestones: milestonesFor("retail").map((m) => m.key) }),
    )
    expect(retailOnly.dimensions.sourcing).toBe(1)
    expect(retailOnly.overall).toBeGreaterThan(0.2)
  })

  it("never exceeds 1", () => {
    const everything = progress({
      completedMilestones: MILESTONES.map((m) => m.key),
      skills: { keepa: 5, "product-analysis": 5, operations: 5 },
      unlockedTracks: ["wholesale"],
    })
    const r = readiness(seller({ entityJurisdiction: "CA" }), everything)
    expect(r.overall).toBeLessThanOrEqual(1)
    for (const value of Object.values(r.dimensions)) expect(value).toBeLessThanOrEqual(1)
  })
})

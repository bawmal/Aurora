import {
  MILESTONES,
  TRACKS,
  milestonesFor,
  skillDefinition,
  trackTemplate,
} from "./curriculum"
import { MODULE_GUIDANCE } from "./guidance"
import { dueRequirements, REQUIREMENTS } from "./jurisdictions"
import { MARKETPLACE_LABELS } from "./types"
import type {
  JourneyProgress,
  Marketplace,
  MilestoneState,
  MilestoneTemplate,
  Readiness,
  ReadinessDimension,
  SellerProfile,
  SkillLevel,
  TrackType,
  UnlockProgress,
  SetupRequirement,
} from "./types"
import type { ModuleGuidance } from "./guidance"

/**
 * The journey engine, as pure functions over the curriculum and the seller's
 * progress. Nothing here is stored: gates, unlocks and readiness are derived
 * every time they are read, so a change to the methodology takes effect for
 * every seller at once and no row can drift out of agreement with the rules.
 *
 * The map is parallel by construction. Nothing forces a seller down one
 * track, and changing direction is re-derivation, not a restart, because
 * completed milestones are the only thing written down.
 */

const MARKETPLACE_SUFFIX = "@"

export type GateResolution =
  | { kind: "milestone"; milestone: MilestoneTemplate }
  | { kind: "requirement"; requirement: SetupRequirement }

/** Resolve the two vocabularies used by `blockedBy` without making the UI know either table. */
export function resolveGate(id: string): GateResolution | null {
  const milestone = MILESTONES.find((candidate) => candidate.key === baseKey(id))
  if (milestone) return { kind: "milestone", milestone }
  const requirement = REQUIREMENTS.find((candidate) => candidate.id === id)
  if (requirement) return { kind: "requirement", requirement }
  return null
}

export function resolveGuidance(
  id: string,
  marketplace: Marketplace | null = null,
): ModuleGuidance | null {
  const guidance = MODULE_GUIDANCE[baseKey(id)]
  if (!guidance) return null
  return {
    ...guidance,
    steps: guidance.steps.map((step) =>
      substituteMarketplace(step, marketplace),
    ),
    doneWhen: substituteMarketplace(guidance.doneWhen, marketplace),
    pitfall: guidance.pitfall
      ? substituteMarketplace(guidance.pitfall, marketplace)
      : undefined,
  }
}

export function substituteMarketplace(
  text: string,
  marketplace: Marketplace | null,
): string {
  return marketplace
    ? text.replaceAll("{marketplace}", MARKETPLACE_LABELS[marketplace])
    : text
}

/** A marketplace milestone key is scoped per marketplace: `mk_account@amazon.com`. */
export function instanceKey(key: string, marketplace: Marketplace | null): string {
  return marketplace ? `${key}${MARKETPLACE_SUFFIX}${marketplace}` : key
}

export function baseKey(instance: string): string {
  const at = instance.indexOf(MARKETPLACE_SUFFIX)
  return at === -1 ? instance : instance.slice(0, at)
}

/**
 * Every milestone the seller's own profile puts on the map, in order. A
 * marketplace milestone appears once per marketplace they have chosen, and
 * a locked track contributes nothing until it unlocks.
 */
export function milestoneStates(
  profile: SellerProfile,
  progress: JourneyProgress,
): MilestoneState[] {
  const done = new Set(progress.completedMilestones)
  const states: MilestoneState[] = []

  for (const track of TRACKS) {
    if (!isTrackOpen(track.type, profile, progress)) continue

    const instances: { template: MilestoneTemplate; marketplace: Marketplace | null }[] = []
    for (const template of milestonesFor(track.type)) {
      if (template.perMarketplace) {
        for (const marketplace of profile.marketplaces) {
          instances.push({ template, marketplace })
        }
      } else {
        instances.push({ template, marketplace: null })
      }
    }

    for (const { template, marketplace } of instances) {
      const key = instanceKey(template.key, marketplace)
      const blockedBy = gatesFor(template, marketplace, profile, done)
      states.push({
        key,
        track: track.type,
        name: substituteMarketplace(template.name, marketplace),
        marketplace,
        status: done.has(key) ? "complete" : blockedBy.length > 0 ? "gated" : "available",
        blockedBy,
      })
    }
  }

  const next = states.find((s) => s.status === "available")
  if (next) next.status = "next"

  return states
}

/**
 * What is actually stopping this milestone: unfinished dependencies, plus
 * any setup requirement that applies to *this* seller. Most requirements are
 * conditional, so for a US resident selling domestically this is usually
 * empty where a fixed checklist would have shown a dozen items.
 */
function gatesFor(
  template: MilestoneTemplate,
  marketplace: Marketplace | null,
  profile: SellerProfile,
  done: Set<string>,
): string[] {
  const gates: string[] = []

  for (const dependency of template.dependencies) {
    if (!done.has(instanceKey(dependency, marketplace))) {
      gates.push(dependency)
    }
  }

  if (template.requires.length > 0) {
    for (const market of marketplace ? [marketplace] : profile.marketplaces) {
      const due = dueRequirements(
        {
          residency: profile.residency,
          marketplace: market,
          entityJurisdiction: profile.entityJurisdiction,
          holdsLocalInventory: true,
          paysLocalSuppliers: template.track === "wholesale",
        },
        template.key,
        profile.completedRequirements,
      )
      for (const requirement of due) {
        if (template.requires.includes(requirement.id) && !gates.includes(requirement.id)) {
          gates.push(requirement.id)
        }
      }
    }
  }

  return gates
}

/** The single thing to do next. The dashboard asks nothing else. */
export function nextMove(
  profile: SellerProfile,
  progress: JourneyProgress,
): MilestoneState | null {
  return milestoneStates(profile, progress).find((s) => s.status === "next") ?? null
}

/**
 * Completing an outcome may coach one skill forward. The same outcome can be
 * observed more than once, so repeat events must not manufacture progress.
 */
export function completeMilestone(
  progress: JourneyProgress,
  completedKey: string,
): JourneyProgress {
  if (progress.completedMilestones.includes(completedKey)) return progress

  const milestone = MILESTONES.find(
    (candidate) => candidate.key === baseKey(completedKey),
  )
  const skills = { ...progress.skills }
  if (milestone?.buildsSkill) {
    const current = skills[milestone.buildsSkill] ?? 0
    skills[milestone.buildsSkill] = Math.min(5, current + 1) as SkillLevel
  }

  return {
    ...progress,
    completedMilestones: [...progress.completedMilestones, completedKey],
    skills,
  }
}

/** Record a real analysis without counting repeated reads of the same ASIN. */
export function recordAnalysis(
  progress: JourneyProgress,
  asin: string,
): JourneyProgress {
  const normalized = asin.trim().toUpperCase()
  if (!normalized || progress.analysedAsins.includes(normalized)) {
    return completeMilestone(progress, "ra_first_analysis")
  }

  const analysedAsins = [...progress.analysedAsins, normalized]
  return {
    ...completeMilestone(progress, "ra_first_analysis"),
    analysedAsins,
    productsAnalysed: analysedAsins.length,
  }
}

export function isTrackOpen(
  track: TrackType,
  profile: SellerProfile,
  progress: JourneyProgress,
): boolean {
  const template = trackTemplate(track)
  if (template.startsUnlocked) return true
  if (progress.unlockedTracks.includes(track)) return true
  return unlockProgress(track, profile, progress).unlocked
}

/**
 * How close a locked track is, and precisely what is missing. Shown as a
 * short list of outstanding items, never as a percentage bar over the whole
 * setup track, because a bar reading 6% on day one is a resignation letter.
 */
export function unlockProgress(
  track: TrackType,
  profile: SellerProfile,
  progress: JourneyProgress,
): UnlockProgress {
  const template = trackTemplate(track)
  if (!template.unlock) {
    return { track, unlocked: true, fraction: 1, outstanding: [] }
  }

  const done = new Set(progress.completedMilestones.map(baseKey))
  const outstanding: string[] = []
  let total = 0
  let met = 0

  for (const key of template.unlock.milestones) {
    total++
    if (done.has(key)) met++
    else outstanding.push(milestoneName(key))
  }

  for (const { skill, level } of template.unlock.skills) {
    total++
    if (skillLevel(progress, skill) >= level) met++
    else outstanding.push(`${skillDefinition(skill).name} at level ${level}`)
  }

  if (template.unlock.requiresEntity) {
    total++
    if (profile.entityJurisdiction) met++
    else outstanding.push("a registered business")
  }

  return {
    track,
    unlocked: outstanding.length === 0,
    fraction: total === 0 ? 1 : met / total,
    outstanding,
  }
}

function milestoneName(key: string): string {
  return MILESTONES.find((m) => m.key === key)?.name ?? key
}

function skillLevel(progress: JourneyProgress, skill: keyof JourneyProgress["skills"]): SkillLevel {
  return progress.skills[skill] ?? 0
}

/**
 * Readiness is a set of percentages, never one vanity number on its own. A
 * seller can be ready in Canada, half ready in the US and untouched in the
 * UK, all at once, and flattening that hides the only actionable part.
 */
export function readiness(profile: SellerProfile, progress: JourneyProgress): Readiness {
  const states = milestoneStates(profile, progress)
  const share = (subset: MilestoneState[]) =>
    subset.length === 0 ? 0 : subset.filter((s) => s.status === "complete").length / subset.length

  const marketplaces: Partial<Record<Marketplace, number>> = {}
  for (const marketplace of profile.marketplaces) {
    marketplaces[marketplace] = share(states.filter((s) => s.marketplace === marketplace))
  }

  const dimensions: Record<ReadinessDimension, number> = {
    business: share(states.filter((s) => s.track === "foundation")),
    marketplace: share(states.filter((s) => s.track === "marketplace")),
    sourcing: share(states.filter((s) => s.track === "retail")),
    wholesale: unlockProgress("wholesale", profile, progress).fraction,
    operations: skillFraction(progress, "operations"),
    skill: averageSkill(progress),
  }

  // Weighted toward the work the seller is actually doing, so the headline
  // number moves when they move. An untouched wholesale track should not
  // hold a retail seller at 40%.
  const active: ReadinessDimension[] = ["business", "marketplace", "sourcing", "skill"]
  if (progress.unlockedTracks.includes("wholesale")) active.push("wholesale", "operations")
  const overall = active.reduce((sum, d) => sum + dimensions[d], 0) / active.length

  return { dimensions, marketplaces, overall }
}

function skillFraction(progress: JourneyProgress, skill: keyof JourneyProgress["skills"]): number {
  return skillLevel(progress, skill) / 5
}

function averageSkill(progress: JourneyProgress): number {
  const levels = Object.values(progress.skills)
  if (levels.length === 0) return 0
  return levels.reduce<number>((sum, level) => sum + level, 0) / (levels.length * 5)
}

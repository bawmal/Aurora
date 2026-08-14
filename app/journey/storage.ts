import { completeMilestone, recordAnalysis } from "@/lib/domain/journey"
import type { JourneyProgress, SellerProfile } from "@/lib/domain/types"
import { MARKETPLACES, NO_PROGRESS } from "@/lib/domain/types"
import { isSupportedResidency } from "@/lib/domain/jurisdictions"

export const JOURNEY_STORAGE_KEY = "aurora-journey-v1"

export const DEFAULT_PROFILE: SellerProfile = {
  id: "anonymous",
  residency: "CA",
  entityJurisdiction: null,
  marketplaces: ["amazon.ca"],
  stage: "pre-account",
  minRoi: 0.3,
  capital: 2000,
  costs: {
    inboundPerUnit: 0,
    prepPerUnit: 0,
    irrecoverableTaxRate: 0,
    dutyRate: 0,
    returnsRate: 0,
  },
  completedRequirements: [],
  provenance: {},
}

export interface StoredState {
  profile: SellerProfile
  progress: JourneyProgress
}

export function isProfile(value: unknown): value is SellerProfile {
  if (!value || typeof value !== "object") return false
  const profile = value as Partial<SellerProfile>
  return (
    typeof profile.id === "string" &&
    typeof profile.residency === "string" &&
    isSupportedResidency(profile.residency) &&
    Array.isArray(profile.marketplaces) &&
    profile.marketplaces.length > 0 &&
    profile.marketplaces.every((marketplace) =>
      (MARKETPLACES as readonly string[]).includes(marketplace),
    ) &&
    typeof profile.capital === "number" &&
    Number.isFinite(profile.capital) &&
    typeof profile.minRoi === "number" &&
    Number.isFinite(profile.minRoi)
  )
}

export function isProgress(value: unknown): value is JourneyProgress {
  if (!value || typeof value !== "object") return false
  const progress = value as Partial<JourneyProgress>
  return (
    Array.isArray(progress.completedMilestones) &&
    progress.completedMilestones.every((key) => typeof key === "string") &&
    Array.isArray(progress.unlockedTracks) &&
    progress.unlockedTracks.every((track) => typeof track === "string") &&
    Array.isArray(progress.analysedAsins) &&
    progress.analysedAsins.every((asin) => typeof asin === "string") &&
    !!progress.skills &&
    typeof progress.skills === "object"
  )
}

export function parseJourneyState(raw: string | null): StoredState {
  if (!raw) return { profile: DEFAULT_PROFILE, progress: NO_PROGRESS }
  try {
    const value = JSON.parse(raw) as Partial<StoredState>
    if (!isProfile(value.profile) || !isProgress(value.progress)) {
      return { profile: DEFAULT_PROFILE, progress: NO_PROGRESS }
    }
    return {
      profile: { ...DEFAULT_PROFILE, ...value.profile },
      progress: {
        ...NO_PROGRESS,
        ...value.progress,
        productsAnalysed: value.progress.analysedAsins.length,
      },
    }
  } catch {
    return { profile: DEFAULT_PROFILE, progress: NO_PROGRESS }
  }
}

export function readJourneyState(): StoredState {
  if (typeof window === "undefined")
    return { profile: DEFAULT_PROFILE, progress: NO_PROGRESS }
  return parseJourneyState(window.localStorage.getItem(JOURNEY_STORAGE_KEY))
}

export function writeJourneyState(
  profile: SellerProfile,
  progress: JourneyProgress,
): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      JOURNEY_STORAGE_KEY,
      JSON.stringify({
        profile,
        progress: { ...progress, productsAnalysed: undefined },
      }),
    )
  } catch {
    // Browser storage is optional; the journey remains useful without it.
  }
}

export function recordAnalysisInStorage(asin: string): StoredState {
  const current = readJourneyState()
  const progress = recordAnalysis(current.progress, asin)
  const next = { profile: current.profile, progress }
  writeJourneyState(next.profile, next.progress)
  return next
}

export function completeMilestoneInStorage(
  profile: SellerProfile,
  progress: JourneyProgress,
  milestoneKey: string,
): StoredState {
  const next = { profile, progress: completeMilestone(progress, milestoneKey) }
  writeJourneyState(next.profile, next.progress)
  return next
}

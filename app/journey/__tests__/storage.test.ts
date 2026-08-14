import { describe, expect, it } from "vitest"
import {
  DEFAULT_PROFILE,
  isProfile,
  isProgress,
  parseJourneyState,
} from "../storage"
import { NO_PROGRESS } from "@/lib/domain/types"

describe("journey storage validation", () => {
  it("rejects corrupt profiles and progress", () => {
    expect(isProfile({ residency: "Mars", marketplaces: ["amazon.ca"] })).toBe(
      false,
    )
    expect(isProfile({ residency: "CA", marketplaces: [] })).toBe(false)
    expect(isProgress({ completedMilestones: [3] })).toBe(false)
  })

  it("falls back to the default state for corrupt stored JSON", () => {
    expect(parseJourneyState("{not-json")).toEqual({
      profile: DEFAULT_PROFILE,
      progress: NO_PROGRESS,
    })
    expect(
      parseJourneyState(JSON.stringify({ profile: { residency: "Mars" } })),
    ).toEqual({
      profile: DEFAULT_PROFILE,
      progress: NO_PROGRESS,
    })
  })

  it("preserves the profile when reading progress from the previous shape", () => {
    const profile = {
      ...DEFAULT_PROFILE,
      residency: "US",
      marketplaces: ["amazon.com"],
      capital: 8750,
      minRoi: 0.42,
    }
    const state = parseJourneyState(
      JSON.stringify({
        profile,
        progress: {
          completedMilestones: ["ra_first_analysis"],
          skills: { "product-analysis": 1 },
          productsAnalysed: 4,
          unlockedTracks: [],
        },
      }),
    )

    expect(state.profile).toMatchObject(profile)
    expect(state.progress.analysedAsins).toEqual([])
    expect(state.progress.productsAnalysed).toBe(0)
  })
})

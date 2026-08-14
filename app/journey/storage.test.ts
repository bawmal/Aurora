import { describe, expect, it } from "vitest"
import {
  DEFAULT_PROFILE,
  isProfile,
  isProgress,
  parseJourneyState,
} from "./storage"
import { NO_PROGRESS } from "@/lib/domain/types"

describe("journey storage validation", () => {
  it("rejects corrupt profiles and progress", () => {
    expect(isProfile({ residency: "Mars", marketplaces: ["amazon.ca"] })).toBe(
      false,
    )
    expect(isProfile({ residency: "CA", marketplaces: [] })).toBe(false)
    expect(isProgress({ completedMilestones: [] })).toBe(false)
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
})

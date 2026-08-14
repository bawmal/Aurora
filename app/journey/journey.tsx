"use client"

import { useEffect, useMemo, useState } from "react"
import {
  MILESTONES,
  SKILLS,
  TRACKS,
  trackTemplate,
} from "@/lib/domain/curriculum"
import {
  milestoneStates,
  nextMove,
  readiness,
  resolveGate,
  isTrackOpen,
  unlockProgress,
} from "@/lib/domain/journey"
import { projectYear, reachability } from "@/lib/domain/projection"
import type {
  JourneyProgress,
  Marketplace,
  MilestoneState,
  ProjectionInputs,
  Reachability,
  SellerProfile,
  SetupRequirement,
  TrackType,
} from "@/lib/domain/types"
import {
  MARKETPLACE_CURRENCY,
  MARKETPLACES,
  NO_PROGRESS,
} from "@/lib/domain/types"
import {
  completeMilestoneInStorage,
  DEFAULT_PROFILE,
  readJourneyState,
  writeJourneyState,
} from "./storage"

const READINESS_LABELS = {
  business: "Business foundation",
  marketplace: "Marketplace setup",
  sourcing: "Sourcing",
  wholesale: "Wholesale",
  operations: "Operations",
  skill: "Skills",
} as const

const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  "amazon.ca": "Amazon Canada",
  "amazon.com": "Amazon US",
  "amazon.co.uk": "Amazon UK",
}

export function Journey() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [progress, setProgress] = useState(NO_PROGRESS)
  const [loaded, setLoaded] = useState(false)
  const [turns, setTurns] = useState("12")
  const [reinvest, setReinvest] = useState("100")
  const [targetProfit, setTargetProfit] = useState("2000")
  const [timeline, setTimeline] = useState("12")
  const [capitalText, setCapitalText] = useState(String(DEFAULT_PROFILE.capital))
  const [minRoiText, setMinRoiText] = useState(String(DEFAULT_PROFILE.minRoi * 100))
  const currency = MARKETPLACE_CURRENCY[profile.marketplaces[0]]

  useEffect(() => {
    const stored = readJourneyState()
    setProfile(stored.profile)
    setProgress(stored.progress)
    setCapitalText(String(stored.profile.capital))
    setMinRoiText(String(stored.profile.minRoi * 100))
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    writeJourneyState(profile, progress)
  }, [loaded, profile, progress])

  const move = useMemo(() => nextMove(profile, progress), [profile, progress])
  const states = useMemo(
    () => milestoneStates(profile, progress),
    [profile, progress],
  )
  const projectionInputs = useMemo<ProjectionInputs>(
    () => ({
      capital: profile.capital,
      targetRoi: profile.minRoi,
      turnsPerYear: positive(turns, 12),
      reinvestRate: clamp(positive(reinvest, 100) / 100, 0, 1),
    }),
    [profile.capital, profile.minRoi, turns, reinvest],
  )
  const projection = useMemo(
    () => projectYear(projectionInputs),
    [projectionInputs],
  )
  const goal = useMemo(
    () =>
      reachability(
        projectionInputs,
        positive(targetProfit, 0),
        positive(timeline, 12),
      ),
    [projectionInputs, targetProfit, timeline],
  )
  const ready = useMemo(() => readiness(profile, progress), [profile, progress])

  const updateProfile = (patch: Partial<SellerProfile>) =>
    setProfile((current) => ({ ...current, ...patch }))

  const completeMove = () => {
    if (!move) return
    const next = completeMilestoneInStorage(profile, progress, move.key)
    setProfile(next.profile)
    setProgress(next.progress)
  }

  return (
    <div className="grid gap-8">
      <Card>
        <Overline>Start with what you know</Overline>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Residency"
            value={profile.residency}
            onChange={(value) =>
              updateProfile({ residency: value as SellerProfile["residency"] })
            }
          >
            <option value="CA">Canada</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
          </Select>
          <Select
            label="Marketplace"
            value={profile.marketplaces[0]}
            onChange={(value) =>
              updateProfile({ marketplaces: [value as Marketplace] })
            }
          >
            {MARKETPLACES.map((marketplace) => (
              <option key={marketplace}>{marketplace}</option>
            ))}
          </Select>
          <Field
            label={`Capital (${currency})`}
            value={capitalText}
            onChange={(value) => {
              setCapitalText(value)
              updateProfile({ capital: positive(value, 0) })
            }}
          />
          <Field
            label="Minimum ROI (%)"
            value={minRoiText}
            onChange={(value) => {
              setMinRoiText(value)
              updateProfile({ minRoi: positive(value, 0) / 100 })
            }}
          />
        </div>
      </Card>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <section className="grid content-start gap-4">
          <div>
            <Overline>Next move</Overline>
            <h2 className="mt-1 text-xl font-semibold">What do I do next?</h2>
          </div>
          {move ? (
            <Card
              tint={move.status === "next" ? "var(--accent-tint)" : undefined}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Overline>{trackTemplate(move.track).name}</Overline>
                  <h3 className="mt-1 text-lg font-semibold">{move.name}</h3>
                  <p
                    className="mt-2 text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {milestoneDescription(move.key)}
                  </p>
                </div>
                <StatusChip status={move.status} />
              </div>
              {move.blockedBy.length > 0 ? (
                <div className="mt-5 grid gap-3">
                  <Overline>Clear these gates</Overline>
                  {move.blockedBy.map((gate) => (
                    <Gate key={gate} id={gate} />
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={completeMove}
                  className="mt-5 rounded-md px-4 py-2 text-sm font-medium text-white"
                  style={{ background: "var(--accent)" }}
                >
                  Mark complete
                </button>
              )}
            </Card>
          ) : (
            <Card>
              <p className="text-sm">There is no next move on the map yet.</p>
            </Card>
          )}
        </section>

        <section className="grid content-start gap-4">
          <div>
            <Overline>What it&rsquo;s worth</Overline>
            <h2 className="mt-1 text-xl font-semibold">
              What could this be worth?
            </h2>
          </div>
          <Card>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              A model, never a promise. Change the assumptions to see what
              moves.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Turns per year" value={turns} onChange={setTurns} />
              <Field
                label="Reinvest rate (%)"
                value={reinvest}
                onChange={setReinvest}
              />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Metric
                label="Monthly run rate"
                value={money(currency, projection.monthlyRunRate)}
              />
              <Metric
                label="Ending capital"
                value={money(currency, projection.endingCapital)}
              />
              <Metric
                label="Cumulative profit"
                value={money(currency, projection.cumulativeProfit)}
              />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field
                label="Target monthly profit"
                value={targetProfit}
                onChange={setTargetProfit}
              />
              <Field
                label="Timeline (months)"
                value={timeline}
                onChange={setTimeline}
              />
            </div>
            <div
              className="mt-4 rounded-lg p-3"
              style={{ background: verdictTint(goal.verdict) }}
            >
              <p className="text-sm">
                {reachabilitySentence(goal, currency, positive(timeline, 12))}
              </p>
              <ul className="data mt-3 space-y-1 text-xs">
                {goal.workings.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </Card>
        </section>
      </div>

      <details>
        <summary className="cursor-pointer">
          <Overline>Readiness</Overline>
        </summary>
        <Card className="mt-3">
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(ready.dimensions).map(([key, value]) => (
              <Bar
                key={key}
                label={READINESS_LABELS[key as keyof typeof READINESS_LABELS]}
                value={value}
              />
            ))}
          </div>
          <div
            className="mt-5 border-t pt-4"
            style={{ borderColor: "var(--hairline)" }}
          >
            <Overline>By marketplace</Overline>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {Object.entries(ready.marketplaces).map(([key, value]) => (
                <Bar
                  key={key}
                  label={MARKETPLACE_LABELS[key as Marketplace]}
                  value={value ?? 0}
                />
              ))}
            </div>
          </div>
        </Card>
      </details>

      <details>
        <summary className="cursor-pointer">
          <Overline>The map</Overline>
        </summary>
        <div className="mt-3 grid gap-3">
          {TRACKS.map((track) => (
            <Track
              key={track.type}
              track={track.type}
              profile={profile}
              progress={progress}
              states={states.filter((state) => state.track === track.type)}
            />
          ))}
        </div>
      </details>

      <details>
        <summary className="cursor-pointer">
          <Overline>Skills</Overline>
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {SKILLS.map((skill) => {
            const level = progress.skills[skill.key] ?? 0
            return (
              <Card key={skill.key}>
                <div className="flex justify-between gap-3">
                  <span className="font-medium">{skill.name}</span>
                  <span
                    className="data text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    L{level}/5
                  </span>
                </div>
                <p
                  className="mt-2 text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  {level === 0 ? "Not started yet." : skill.levels[level - 1]}
                </p>
              </Card>
            )
          })}
        </div>
      </details>
    </div>
  )
}

function Gate({ id }: { id: string }) {
  const gate = resolveGate(id)
  if (!gate) return <p className="text-sm">{id}</p>
  if (gate.kind === "milestone")
    return (
      <p className="text-sm">
        Complete <strong>{gate.milestone.name}</strong> first.
      </p>
    )
  return <Requirement requirement={gate.requirement} />
}

function Requirement({ requirement }: { requirement: SetupRequirement }) {
  return (
    <div
      className="rounded-lg border p-3 text-sm"
      style={{ borderColor: "var(--hairline)", background: "var(--surface)" }}
    >
      <p className="font-medium">{requirement.title}</p>
      <span
        className="mt-1 inline-block text-xs"
        style={{ color: "var(--watch-ink)" }}
      >
        {requirement.severity}
      </span>
      {requirement.actions.map((action) => (
        <div key={action.label} className="mt-3">
          <p>{action.label}</p>
          {action.locator && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {action.locator}
            </p>
          )}
          {action.url && (
            <a
              className="text-xs"
              href={action.url}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)" }}
            >
              Open official action
            </a>
          )}
        </div>
      ))}
      {requirement.citations.map((citation) =>
        citation.url ? (
          <p key={citation.title} className="mt-2 text-xs">
            <a
              href={citation.url}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)" }}
            >
              {citation.publisher}: {citation.title}
            </a>
          </p>
        ) : (
          <p
            key={citation.title}
            className="mt-2 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {citation.publisher}: {citation.title}
            {citation.locator ? ` — ${citation.locator}` : ""}
          </p>
        ),
      )}
      {requirement.professionalAdvice && (
        <p
          className="mt-3 text-xs font-medium"
          style={{ color: "var(--watch-ink)" }}
        >
          This needs an accountant.
        </p>
      )}
    </div>
  )
}

function Track({
  track,
  profile,
  progress,
  states,
}: {
  track: TrackType
  profile: SellerProfile
  progress: JourneyProgress
  states: MilestoneState[]
}) {
  const template = trackTemplate(track)
  const open = isTrackOpen(track, profile, progress)
  const unlock = unlockProgress(track, profile, progress)
  return (
    <Card tint={open ? undefined : "var(--surface-sunken)"}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{template.name}</h3>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {template.description}
          </p>
        </div>
        {!open && <StatusChip status="gated" />}
      </div>
      {open ? (
        <div className="mt-4 grid gap-2">
          {states.map((state) => (
            <div
              key={state.key}
              className="border-t py-2 text-sm"
              style={{ borderColor: "var(--hairline)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <span>{state.name}</span>
                <StatusChip status={state.status} />
              </div>
              {state.status === "gated" && (
                <details className="mt-2">
                  <summary
                    className="cursor-pointer text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    What is blocking this?
                  </summary>
                  <div className="mt-2 grid gap-2">
                    {state.blockedBy.map((gate) => (
                      <Gate key={gate} id={gate} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
          Still locked. Outstanding: {unlock.outstanding.join(", ")}.
        </p>
      )}
    </Card>
  )
}

function milestoneDescription(key: string) {
  return (
    MILESTONES.find((milestone) => milestone.key === key)?.description ??
    "The next concrete outcome on your map."
  )
}

function StatusChip({
  status,
}: {
  status: "complete" | "next" | "available" | "gated"
}) {
  const tint =
    status === "complete"
      ? "var(--buy-tint)"
      : status === "gated"
        ? "var(--pass-tint)"
        : status === "next"
          ? "var(--accent-tint)"
          : "var(--surface-sunken)"
  const ink =
    status === "complete"
      ? "var(--buy-ink)"
      : status === "gated"
        ? "var(--pass-ink)"
        : status === "next"
          ? "var(--accent)"
          : "var(--text-muted)"
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: tint, color: ink }}
    >
      {status}
    </span>
  )
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="data">{Math.round(value * 100)}%</span>
      </div>
      <div
        className="mt-1 h-2 rounded-full"
        style={{ background: "var(--surface-sunken)" }}
      >
        <div
          className="h-2 rounded-full"
          style={{
            width: `${Math.round(value * 100)}%`,
            background: "var(--accent)",
          }}
        />
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Overline>{label}</Overline>
      <p className="data mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function Card({
  children,
  tint,
  className = "",
}: {
  children: React.ReactNode
  tint?: string
  className?: string
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${className}`}
      style={{
        borderColor: "var(--hairline)",
        background: tint ?? "var(--surface)",
      }}
    >
      {children}
    </div>
  )
}

function Overline({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-xs font-semibold uppercase tracking-[0.09em]"
      style={{ color: "var(--text-faint)" }}
    >
      {children}
    </span>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="data rounded-md border bg-transparent px-3 py-2"
        style={{ borderColor: "var(--hairline)" }}
      />
    </label>
  )
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border bg-transparent px-3 py-2"
        style={{ borderColor: "var(--hairline)" }}
      >
        {children}
      </select>
    </label>
  )
}

function positive(value: string, fallback: number) {
  const number = Number.parseFloat(value)
  return Number.isFinite(number) ? Math.max(0, number) : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function verdictTint(verdict: Reachability["verdict"]) {
  return verdict === "reachable"
    ? "var(--buy-tint)"
    : verdict === "reachable-later"
      ? "var(--watch-tint)"
      : "var(--surface-sunken)"
}

function money(currency: string, value: number) {
  return `${currency} ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function reachabilitySentence(
  result: Reachability,
  currency: string,
  timeline: number,
) {
  const deadline = money(currency, result.runRateAtDeadline)
  if (result.verdict === "not-modelled") {
    return `By month ${timeline}, the model reaches about ${deadline} a month. Set a positive target to compare it with a goal.`
  }
  if (result.verdict === "reachable") {
    return `By month ${timeline}, the model reaches about ${deadline} a month, including your target.`
  }
  if (result.verdict === "reachable-later" && result.monthsToTarget !== null) {
    return `By month ${timeline}, the model reaches about ${deadline} a month; your number arrives around month ${result.monthsToTarget}.`
  }
  return `By month ${timeline}, the model reaches about ${deadline} a month; your number is not reached on this trajectory.`
}

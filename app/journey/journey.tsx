"use client"

import { useEffect, useMemo, useState } from "react"
import { MILESTONES, SKILLS, TRACKS, trackTemplate } from "@/lib/domain/curriculum"
import {
  milestoneStates,
  nextMove,
  readiness,
  resolveGate,
  unlockProgress,
} from "@/lib/domain/journey"
import { projectYear, reachability } from "@/lib/domain/projection"
import type {
  JourneyProgress,
  Marketplace,
  ProjectionInputs,
  SellerProfile,
  SetupRequirement,
  TrackType,
} from "@/lib/domain/types"
import { MARKETPLACES, NO_EXTRA_COSTS, NO_PROGRESS } from "@/lib/domain/types"

export const JOURNEY_STORAGE_KEY = "aurora-journey-v1"

const DEFAULT_PROFILE: SellerProfile = {
  id: "anonymous",
  residency: "CA",
  entityJurisdiction: null,
  marketplaces: ["amazon.ca"],
  stage: "pre-account",
  minRoi: 0.3,
  capital: 2000,
  costs: NO_EXTRA_COSTS,
  completedRequirements: [],
  provenance: {},
}

type StoredState = { profile: SellerProfile; progress: JourneyProgress }

export function Journey() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [progress, setProgress] = useState(NO_PROGRESS)
  const [loaded, setLoaded] = useState(false)
  const [turns, setTurns] = useState("12")
  const [reinvest, setReinvest] = useState("100")
  const [targetProfit, setTargetProfit] = useState("2000")
  const [timeline, setTimeline] = useState("12")

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(JOURNEY_STORAGE_KEY)
      if (raw) {
        const stored = JSON.parse(raw) as Partial<StoredState>
        if (stored.profile && isProfile(stored.profile)) {
          setProfile({ ...DEFAULT_PROFILE, ...stored.profile })
        }
        if (stored.progress && isProgress(stored.progress)) {
          setProgress({ ...NO_PROGRESS, ...stored.progress })
        }
      }
    } catch {
      setProfile(DEFAULT_PROFILE)
      setProgress(NO_PROGRESS)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!loaded) return
    window.localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify({ profile, progress }))
  }, [loaded, profile, progress])

  const move = useMemo(() => nextMove(profile, progress), [profile, progress])
  const projectionInputs = useMemo<ProjectionInputs>(
    () => ({
      capital: profile.capital,
      targetRoi: profile.minRoi,
      turnsPerYear: positive(turns, 12),
      reinvestRate: clamp(positive(reinvest, 100) / 100, 0, 1),
    }),
    [profile.capital, profile.minRoi, turns, reinvest],
  )
  const projection = useMemo(() => projectYear(projectionInputs), [projectionInputs])
  const goal = useMemo(
    () => reachability(projectionInputs, positive(targetProfit, 0), positive(timeline, 12)),
    [projectionInputs, targetProfit, timeline],
  )
  const ready = useMemo(() => readiness(profile, progress), [profile, progress])

  const updateProfile = (patch: Partial<SellerProfile>) => setProfile((current) => ({ ...current, ...patch }))
  const completeMove = () => {
    if (!move) return
    setProgress((current) => ({
      ...current,
      completedMilestones: current.completedMilestones.includes(move.key)
        ? current.completedMilestones
        : [...current.completedMilestones, move.key],
    }))
  }

  return (
    <div className="grid gap-8">
      <Card>
        <Overline>Start with what you know</Overline>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Residency" value={profile.residency} onChange={(value) => updateProfile({ residency: value as SellerProfile["residency"] })}>
            <option value="CA">Canada</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
          </Select>
          <Select label="Marketplace" value={profile.marketplaces[0]} onChange={(value) => updateProfile({ marketplaces: [value as Marketplace] })}>
            {MARKETPLACES.map((marketplace) => <option key={marketplace}>{marketplace}</option>)}
          </Select>
          <Field label="Capital" value={String(profile.capital)} onChange={(value) => updateProfile({ capital: positive(value, 0) })} />
          <Field label="Minimum ROI (%)" value={String(profile.minRoi * 100)} onChange={(value) => updateProfile({ minRoi: positive(value, 0) / 100 })} />
        </div>
      </Card>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <section className="grid content-start gap-4">
          <div>
            <Overline>Next move</Overline>
            <h2 className="mt-1 text-xl font-semibold">What do I do next?</h2>
          </div>
          {move ? (
            <Card tint={move.status === "next" ? "var(--accent-tint)" : undefined}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Overline>{move.track}</Overline>
                  <h3 className="mt-1 text-lg font-semibold">{move.name}</h3>
                  <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                    {milestoneDescription(move.key)}
                  </p>
                </div>
                <StatusChip status={move.status} />
              </div>
              {move.blockedBy.length > 0 ? (
                <div className="mt-5 grid gap-3">
                  <Overline>Clear these gates</Overline>
                  {move.blockedBy.map((gate) => <Gate key={gate} id={gate} />)}
                </div>
              ) : (
                <button type="button" onClick={completeMove} className="mt-5 rounded-md px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--accent)" }}>
                  Mark complete
                </button>
              )}
            </Card>
          ) : (
            <Card><p className="text-sm">There is no next move on the map yet.</p></Card>
          )}
        </section>

        <section className="grid content-start gap-4">
          <div>
            <Overline>What it&rsquo;s worth</Overline>
            <h2 className="mt-1 text-xl font-semibold">What could this be worth?</h2>
          </div>
          <Card>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>A model, never a promise. Change the assumptions to see what moves.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Turns per year" value={turns} onChange={setTurns} />
              <Field label="Reinvest rate (%)" value={reinvest} onChange={setReinvest} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Metric label="Monthly run rate" value={`$${projection.monthlyRunRate.toLocaleString()}`} />
              <Metric label="Ending capital" value={`$${projection.endingCapital.toLocaleString()}`} />
              <Metric label="Cumulative profit" value={`$${projection.cumulativeProfit.toLocaleString()}`} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label="Target monthly profit" value={targetProfit} onChange={setTargetProfit} />
              <Field label="Timeline (months)" value={timeline} onChange={setTimeline} />
            </div>
            <div className="mt-4 rounded-lg p-3" style={{ background: verdictTint(goal.verdict) }}>
              <p className="text-sm">{reachabilitySentence(goal.verdict, goal.runRateAtDeadline, goal.monthsToTarget, positive(timeline, 12))}</p>
              <ul className="data mt-3 space-y-1 text-xs">{goal.workings.map((line) => <li key={line}>{line}</li>)}</ul>
            </div>
          </Card>
        </section>
      </div>

      <details>
        <summary className="cursor-pointer"><Overline>Readiness</Overline></summary>
        <Card className="mt-3">
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(ready.dimensions).map(([key, value]) => <Bar key={key} label={key} value={value} />)}
          </div>
          <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--hairline)" }}>
            <Overline>By marketplace</Overline>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">{Object.entries(ready.marketplaces).map(([key, value]) => <Bar key={key} label={key} value={value ?? 0} />)}</div>
          </div>
        </Card>
      </details>

      <details>
        <summary className="cursor-pointer"><Overline>The map</Overline></summary>
        <div className="mt-3 grid gap-3">{TRACKS.map((track) => <Track key={track.type} track={track.type} profile={profile} progress={progress} />)}</div>
      </details>

      <details>
        <summary className="cursor-pointer"><Overline>Skills</Overline></summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{SKILLS.map((skill) => {
          const level = progress.skills[skill.key] ?? 0
          return <Card key={skill.key}><div className="flex justify-between gap-3"><span className="font-medium">{skill.name}</span><span className="data text-sm" style={{ color: "var(--text-muted)" }}>L{level}/5</span></div><p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>{level === 0 ? "Not started yet." : skill.levels[level - 1]}</p></Card>
        })}</div>
      </details>
    </div>
  )
}

function Gate({ id }: { id: string }) {
  const gate = resolveGate(id)
  if (!gate) return <p className="text-sm">{id}</p>
  if (gate.kind === "milestone") return <p className="text-sm">Complete <strong>{gate.milestone.name}</strong> first.</p>
  return <Requirement requirement={gate.requirement} />
}

function Requirement({ requirement }: { requirement: SetupRequirement }) {
  return <div className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--hairline)", background: "var(--surface)" }}>
    <p className="font-medium">{requirement.title}</p>
    <span className="mt-1 inline-block text-xs" style={{ color: "var(--watch-ink)" }}>{requirement.severity}</span>
    {requirement.actions.map((action) => <div key={action.label} className="mt-3"><p>{action.label}</p>{action.locator && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{action.locator}</p>}{action.url && <a className="text-xs" href={action.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>Open official action</a>}</div>)}
    {requirement.citations.map((citation) => citation.url ? <p key={citation.title} className="mt-2 text-xs"><a href={citation.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{citation.publisher}: {citation.title}</a></p> : <p key={citation.title} className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>{citation.publisher}: {citation.title}{citation.locator ? ` — ${citation.locator}` : ""}</p>)}
    {requirement.professionalAdvice && <p className="mt-3 text-xs font-medium" style={{ color: "var(--watch-ink)" }}>This needs an accountant.</p>}
  </div>
}

function Track({ track, profile, progress }: { track: TrackType; profile: SellerProfile; progress: JourneyProgress }) {
  const template = trackTemplate(track)
  const open = track === "wholesale" ? unlockProgress(track, profile, progress).unlocked : true
  const states = milestoneStates(profile, progress).filter((state) => state.track === track)
  const unlock = unlockProgress(track, profile, progress)
  return <Card tint={open ? undefined : "var(--surface-sunken)"}><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{template.name}</h3><p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{template.description}</p></div>{!open && <StatusChip status="gated" />}</div>{open ? <div className="mt-4 grid gap-2">{states.map((state) => <div key={state.key} className="border-t py-2 text-sm" style={{ borderColor: "var(--hairline)" }}><div className="flex items-center justify-between gap-3"><span>{state.name}</span><StatusChip status={state.status} /></div>{state.status === "gated" && <details className="mt-2"><summary className="cursor-pointer text-xs" style={{ color: "var(--text-muted)" }}>What is blocking this?</summary><div className="mt-2 grid gap-2">{state.blockedBy.map((gate) => <Gate key={gate} id={gate} />)}</div></details>}</div>)}</div> : <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>Still locked. Outstanding: {unlock.outstanding.join(", ")}.</p>}</Card>
}

function milestoneDescription(key: string) {
  return MILESTONES.find((milestone) => milestone.key === key)?.description ?? "The next concrete outcome on your map."
}

function StatusChip({ status }: { status: "complete" | "next" | "available" | "gated" }) {
  const tint = status === "complete" ? "var(--buy-tint)" : status === "gated" ? "var(--pass-tint)" : status === "next" ? "var(--accent-tint)" : "var(--surface-sunken)"
  const ink = status === "complete" ? "var(--buy-ink)" : status === "gated" ? "var(--pass-ink)" : status === "next" ? "var(--accent)" : "var(--text-muted)"
  return <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: tint, color: ink }}>{status}</span>
}

function Bar({ label, value }: { label: string; value: number }) {
  return <div><div className="flex justify-between text-sm"><span>{label}</span><span className="data">{Math.round(value * 100)}%</span></div><div className="mt-1 h-2 rounded-full" style={{ background: "var(--surface-sunken)" }}><div className="h-2 rounded-full" style={{ width: `${Math.round(value * 100)}%`, background: "var(--accent)" }} /></div></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><Overline>{label}</Overline><p className="data mt-1 text-lg font-semibold">{value}</p></div>
}

function Card({ children, tint, className = "" }: { children: React.ReactNode; tint?: string; className?: string }) {
  return <div className={`rounded-xl border p-4 ${className}`} style={{ borderColor: "var(--hairline)", background: tint ?? "var(--surface)" }}>{children}</div>
}
function Overline({ children }: { children: React.ReactNode }) { return <span className="text-xs font-semibold uppercase tracking-[0.09em]" style={{ color: "var(--text-faint)" }}>{children}</span> }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid gap-1 text-sm"><span style={{ color: "var(--text-muted)" }}>{label}</span><input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} className="data rounded-md border bg-transparent px-3 py-2" style={{ borderColor: "var(--hairline)" }} /></label> }
function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) { return <label className="grid gap-1 text-sm"><span style={{ color: "var(--text-muted)" }}>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border bg-transparent px-3 py-2" style={{ borderColor: "var(--hairline)" }}>{children}</select></label> }
function positive(value: string, fallback: number) { const number = Number.parseFloat(value); return Number.isFinite(number) ? Math.max(0, number) : fallback }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)) }
function isProfile(value: SellerProfile): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray(value.marketplaces) &&
    value.marketplaces.length > 0 &&
    typeof value.residency === "string"
  )
}
function isProgress(value: JourneyProgress): boolean {
  return typeof value === "object" && value !== null && Array.isArray(value.completedMilestones)
}
function verdictTint(verdict: string) { return verdict === "reachable" ? "var(--buy-tint)" : verdict === "reachable-later" ? "var(--watch-tint)" : "var(--surface-sunken)" }
function reachabilitySentence(verdict: string, runRate: number, months: number | null, timeline: number) { if (verdict === "reachable") return `By month ${timeline}, the model reaches about $${runRate.toLocaleString()} a month, including your target.`; if (months) return `By month ${timeline}, the model reaches about $${runRate.toLocaleString()} a month; your number arrives around month ${months}.`; return `By month ${timeline}, the model reaches about $${runRate.toLocaleString()} a month; your number is not reached on this trajectory.` }

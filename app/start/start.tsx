"use client"

import React, { useEffect, useMemo, useState } from "react"
import { projectYear, reachability } from "@/lib/domain/projection"
import { START_DEMO } from "@/lib/domain/start-demo"
import { nextStartPanel } from "@/lib/domain/start"
import {
  MARKETPLACE_CURRENCY,
  MARKETPLACE_LABELS,
  MARKETPLACES,
  type Marketplace,
  type Residency,
} from "@/lib/domain/types"
import {
  DEFAULT_PROFILE,
  hasStoredProfile,
  readJourneyState,
  writeJourneyState,
} from "../journey/storage"

const PANEL_COUNT = 8

export function Start() {
  const stored = useMemo(() => readJourneyState(), [])
  const [panel, setPanel] = useState(0)
  const [returning, setReturning] = useState(false)
  const [targetProfit, setTargetProfit] = useState(
    String(stored.profile.targetMonthlyProfit ?? 3000),
  )
  const [timeline, setTimeline] = useState(
    String(stored.profile.timelineMonths ?? 12),
  )
  const [capital, setCapital] = useState(String(stored.profile.capital || 2000))
  const [marketplace, setMarketplace] = useState<Marketplace>(
    stored.profile.marketplaces[0] ?? "amazon.ca",
  )
  const [residency, setResidency] = useState<Residency>(stored.profile.residency)
  const [roi, setRoi] = useState(String(stored.profile.minRoi * 100 || 30))
  const [turns, setTurns] = useState("6")
  const [reinvest, setReinvest] = useState("50")

  useEffect(() => {
    setReturning(hasStoredProfile())
  }, [])

  const currency = MARKETPLACE_CURRENCY[marketplace]
  const demoCurrency = MARKETPLACE_CURRENCY[START_DEMO.marketplace]
  const projectionInputs = useMemo(
    () => ({
      capital: positive(capital, 2000),
      targetRoi: positive(roi, 30) / 100,
      turnsPerYear: positive(turns, 6),
      reinvestRate: clamp(positive(reinvest, 50) / 100, 0, 1),
    }),
    [capital, reinvest, roi, turns],
  )
  const projection = useMemo(() => projectYear(projectionInputs), [projectionInputs])
  const goal = useMemo(
    () =>
      reachability(
        projectionInputs,
        positive(targetProfit, 3000),
        positive(timeline, 12),
        currency,
      ),
    [currency, projectionInputs, targetProfit, timeline],
  )

  const finish = () => {
    const current = readJourneyState()
    writeJourneyState(
      {
        ...DEFAULT_PROFILE,
        ...current.profile,
        residency,
        marketplaces: [marketplace],
        capital: positive(capital, 2000),
        minRoi: positive(roi, 30) / 100,
        targetMonthlyProfit: positive(targetProfit, 3000),
        timelineMonths: positive(timeline, 12),
      },
      current.progress,
    )
    window.location.href = "/journey"
  }

  return (
    <div className="grid gap-6">
      <header>
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            A short way into the numbers
          </p>
          {panel < 5 && (
            <button
              type="button"
              className="text-sm"
              style={{ color: "var(--accent)" }}
              onClick={() => setPanel(nextStartPanel(panel, true))}
            >
              Skip to your goal
            </button>
          )}
          {returning && (
            <a href="/journey" className="text-sm" style={{ color: "var(--accent)" }}>
              Go to your journey
            </a>
          )}
        </div>
        <div className="mt-4 flex gap-1" aria-label={`Step ${panel + 1} of ${PANEL_COUNT}`}>
          {Array.from({ length: PANEL_COUNT }, (_, index) => (
            <span
              key={index}
              className="h-1 flex-1 rounded-full"
              style={{
                background:
                  index <= panel ? "var(--accent)" : "var(--surface-sunken)",
              }}
            />
          ))}
        </div>
      </header>

      {panel === 0 && (
        <Panel
          overline="Start with the opportunity"
          title="One product, one page — and the Buy Box"
          onNext={() => setPanel(nextStartPanel(panel))}
        >
          <p>
            Amazon shows one listing per product. Roughly 90% of a listing&rsquo;s
            sales go to whoever holds the Buy Box.
          </p>
          <p className="mt-3">
            So the question is not whether people buy it. It is who gets the sale.
          </p>
        </Panel>
      )}

      {panel === 1 && (
        <Panel
          overline="A real listing"
          title="You can see the whole board"
          onNext={() => setPanel(nextStartPanel(panel))}
          onBack={() => setPanel(panel - 1)}
        >
          <p className="font-medium">{START_DEMO.title}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {START_DEMO.asin} · Data read {START_DEMO.readDate}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="Price" value={`${demoCurrency} ${START_DEMO.price.toFixed(2)}`} />
            <Metric label="Sellers" value={String(START_DEMO.sellers)} />
            <Metric
              label="Estimated sales / month"
              value={`about ${START_DEMO.demandPerMonth}`}
            />
            <Metric label="Marketplace" value={MARKETPLACE_LABELS[START_DEMO.marketplace]} />
          </div>
          <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
            This is a real read from Keepa, not an illustration.
          </p>
        </Panel>
      )}

      {panel === 2 && (
        <Panel
          overline="Share the demand"
          title="Do the maths with me"
          onNext={() => setPanel(nextStartPanel(panel))}
          onBack={() => setPanel(panel - 1)}
        >
          <div className="data grid gap-2 text-sm">
            <p>
              About {START_DEMO.demandPerMonth} estimated units a month ÷{" "}
              {START_DEMO.sellers + 1} sellers, including you
            </p>
            <p>= about {START_DEMO.unitsPerMonth.toFixed(1)} units for you</p>
          </div>
          <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
            This assumes the Buy Box splits evenly between sellers, and it often
            doesn&rsquo;t. Price, feedback, FBA and especially Amazon selling on the
            listing all skew it.
          </p>
        </Panel>
      )}

      {panel === 3 && (
        <Panel
          overline="Make one unit earn its place"
          title="What one product pays"
          onNext={() => setPanel(nextStartPanel(panel))}
          onBack={() => setPanel(panel - 1)}
        >
          <div className="grid gap-5">
            <ArithmeticGroup title="What comes in">
              <ArithmeticLine
                label="Sale price"
                value={`${demoCurrency} ${START_DEMO.price.toFixed(2)}`}
              />
              <ArithmeticLine
                label="− Amazon’s fees"
                value={`${demoCurrency} ${START_DEMO.fees.toFixed(2)}`}
              />
              {showCostRow(START_DEMO.returnsAllowance) && (
                <ArithmeticLine
                  label="− Returns allowance"
                  value={`${demoCurrency} ${START_DEMO.returnsAllowance.toFixed(2)}`}
                />
              )}
              <ArithmeticTotal
                label="Net proceeds"
                value={`${demoCurrency} ${START_DEMO.netProceeds.toFixed(2)}`}
              />
            </ArithmeticGroup>

            <ArithmeticGroup title="What goes out">
              <ArithmeticLine
                label="Invoice price"
                value={`${demoCurrency} ${START_DEMO.unitCost.toFixed(2)}`}
              />
              {showCostRow(START_DEMO.inboundPerUnit) && (
                <ArithmeticLine
                  label="+ Inbound freight"
                  value={`${demoCurrency} ${START_DEMO.inboundPerUnit.toFixed(2)}`}
                />
              )}
              {showCostRow(START_DEMO.prepPerUnit) && (
                <ArithmeticLine
                  label="+ Prep"
                  value={`${demoCurrency} ${START_DEMO.prepPerUnit.toFixed(2)}`}
                />
              )}
              {showCostRow(START_DEMO.unitCost * START_DEMO.dutyRate) && (
                <ArithmeticLine
                  label="+ Duty"
                  value={`${demoCurrency} ${(START_DEMO.unitCost * START_DEMO.dutyRate).toFixed(2)}`}
                />
              )}
              <ArithmeticTotal
                label="Landed cost"
                value={`${demoCurrency} ${START_DEMO.landedCost.toFixed(2)}`}
              />
            </ArithmeticGroup>

            <div className="border-t pt-4" style={{ borderColor: "var(--hairline)" }}>
              <p className="data text-lg font-semibold">
                Profit per unit: {demoCurrency} {START_DEMO.profitPerUnit.toFixed(2)}
              </p>
              <p className="data mt-1 text-sm">
                ROI: {(START_DEMO.roi * 100).toFixed(1)}%
              </p>
              <p className="data mt-3 text-sm">
                {START_DEMO.unitsPerMonth.toFixed(1)} units × {demoCurrency}{" "}
                {START_DEMO.profitPerUnit.toFixed(2)} = {demoCurrency}{" "}
                {START_DEMO.monthlyProfit.toFixed(2)} a month
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
            The invoice price is an assumption: no data source can know what you paid.
          </p>
        </Panel>
      )}

      {panel === 4 && (
        <Panel
          overline="Turn one product into a business"
          title={"One product isn’t a business"}
          onNext={() => setPanel(nextStartPanel(panel))}
          onBack={() => setPanel(panel - 1)}
        >
          <p className="data text-lg">
            15 products × {demoCurrency}{" "}
            {Math.round(START_DEMO.monthlyProfit).toLocaleString("en-US")} ={" "}
            {demoCurrency}{" "}
            {(Math.round(START_DEMO.monthlyProfit) * 15).toLocaleString("en-US")}{" "}
            a month
          </p>
          <p className="mt-4 text-sm">
            That requires capital to hold the stock, finding 15 products that
            clear your ROI floor, and selling through on schedule.
          </p>
        </Panel>
      )}

      {panel === 5 && (
        <Panel
          overline="Your goal"
          title="What do you want to build?"
          onNext={() => setPanel(nextStartPanel(panel))}
          onBack={() => setPanel(panel - 1)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={`Target monthly profit (${currency})`}
              value={targetProfit}
              onChange={setTargetProfit}
            />
            <label className="grid gap-1 text-sm">
              <span style={{ color: "var(--text-muted)" }}>Timeline</span>
              <select value={timeline} onChange={(event) => setTimeline(event.target.value)} className="rounded-md border bg-transparent px-3 py-2" style={{ borderColor: "var(--hairline)" }}>
                {[6, 12, 18, 24].map((months) => <option key={months} value={months}>{months} months</option>)}
              </select>
            </label>
          </div>
        </Panel>
      )}

      {panel === 6 && (
        <Panel
          overline="Your starting point"
          title="Capital and marketplace"
          onNext={() => setPanel(nextStartPanel(panel))}
          onBack={() => setPanel(panel - 1)}
        >
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Bawo&rsquo;s teaching: {currency} 500 is a minimum; {currency} 2,000 is realistic.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label={`Starting capital (${currency})`} value={capital} onChange={setCapital} />
            <Select label="Marketplace" value={marketplace} onChange={(value) => setMarketplace(value as Marketplace)}>
              {MARKETPLACES.map((value) => <option key={value} value={value}>{MARKETPLACE_LABELS[value]}</option>)}
            </Select>
            <Select label="Residency" value={residency} onChange={(value) => setResidency(value as Residency)}>
              <option value="CA">Canada</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
            </Select>
          </div>
        </Panel>
      )}

      {panel === 7 && (
        <Panel
          overline="Your model"
          title="The model, with levers"
          onNext={finish}
          onBack={() => setPanel(panel - 1)}
          nextLabel="Enter your journey"
        >
          <h3 className="text-lg font-semibold">Illustrative model — not a forecast</h3>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            Actual results depend on finding enough qualifying inventory and selling it through on schedule.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Metric label="Monthly run rate" value={`${currency} ${Math.round(projection.monthlyRunRate).toLocaleString("en-US")}`} />
            <Metric label="Ending capital" value={`${currency} ${Math.round(projection.endingCapital).toLocaleString("en-US")}`} />
            <Metric label="Cumulative profit" value={`${currency} ${Math.round(projection.cumulativeProfit).toLocaleString("en-US")}`} subdued />
          </div>
          <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
            {reachabilitySentence(goal, currency, positive(timeline, 12))}
          </p>
          <details className="mt-5">
            <summary className="cursor-pointer text-sm">Change the levers</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Target ROI (%)" value={roi} onChange={setRoi} />
              <Field label="Turns per year" value={turns} onChange={setTurns} />
              <Field label="Reinvest rate (%)" value={reinvest} onChange={setReinvest} />
            </div>
          </details>
        </Panel>
      )}
    </div>
  )
}

export function Panel({
  overline,
  title,
  children,
  onNext,
  onBack,
  nextLabel = "Next",
}: {
  overline: string
  title: string
  children?: React.ReactNode
  onNext: () => void
  onBack?: () => void
  nextLabel?: string
}) {
  return (
    <Card>
      <Overline>{overline}</Overline>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-5 text-sm leading-6">{children}</div>
      <div className="mt-6 flex items-center gap-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          className="rounded-md px-4 py-2 text-sm font-medium text-white"
          style={{ background: "var(--accent)" }}
        >
          {nextLabel}
        </button>
      </div>
    </Card>
  )
}

function Metric({ label, value, subdued = false }: { label: string; value: string; subdued?: boolean }) {
  return (
    <div>
      <Overline>{label}</Overline>
      <p className={`data mt-1 ${subdued ? "text-sm" : "text-lg"} font-semibold`} style={subdued ? { color: "var(--text-muted)" } : undefined}>
        {value}
      </p>
    </div>
  )
}

function ArithmeticGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <Overline>{title}</Overline>
      <ul className="data mt-2 space-y-1 text-sm">{children}</ul>
    </section>
  )
}

function ArithmeticLine({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between gap-4">
      <span>{label}</span>
      <span>{value}</span>
    </li>
  )
}

function ArithmeticTotal({ label, value }: { label: string; value: string }) {
  return (
    <li
      className="mt-2 flex justify-between gap-4 border-t pt-2 font-medium"
      style={{ borderColor: "var(--hairline)" }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </li>
  )
}

export function showCostRow(value: number): boolean {
  return value !== 0
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border p-5" style={{ borderColor: "var(--hairline)", background: "var(--surface)" }}>{children}</div>
}

function Overline({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold uppercase tracking-[0.09em]" style={{ color: "var(--text-faint)" }}>{children}</span>
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-sm">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <input inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} className="data rounded-md border bg-transparent px-3 py-2" style={{ borderColor: "var(--hairline)" }} />
    </label>
  )
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border bg-transparent px-3 py-2" style={{ borderColor: "var(--hairline)" }}>{children}</select>
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

function money(currency: string, value: number) {
  return `${currency} ${Math.round(value).toLocaleString("en-US")}`
}

function reachabilitySentence(result: ReturnType<typeof reachability>, currency: string, timeline: number) {
  if (result.verdict === "reachable") return `By month ${timeline}, the model reaches about ${money(currency, result.runRateAtDeadline)} a month, including your target.`
  if (result.verdict === "reachable-later" && result.monthsToTarget !== null) return `By month ${timeline}, the model reaches about ${money(currency, result.runRateAtDeadline)} a month; your number arrives around month ${result.monthsToTarget}.`
  return `By month ${timeline}, the model reaches about ${money(currency, result.runRateAtDeadline)} a month.`
}

import type { ActionEntry, GoldenCase, MentorResponse, SourceEntry } from "./types"

/**
 * Two kinds of assertion, deliberately separated.
 *
 * Mechanical checks — did the answer contain the URL, the phone number, the
 * locator; did it route correctly; did it read the state it needed — are
 * exact and free. They are the cheapest reliable signal in the suite and
 * should gate at 100%.
 *
 * Content checks (`must` / `mustnot`) need a judge. Those are wired through
 * the Judge interface so the harness runs without a model when you only want
 * the mechanical gate.
 */

export interface CheckResult {
  name: string
  passed: boolean
  detail?: string
}

export interface CaseResult {
  id: string
  adversarial: boolean
  checks: CheckResult[]
  passed: boolean
}

export interface Judge {
  /** Returns true when the claim holds for the answer. */
  holds(answer: string, claim: string): Promise<boolean>
}

/** The literal strings an answer must contain to count as having cited a source. */
export function citationNeedles(entry: SourceEntry): string[] {
  const needles: string[] = []
  if (entry.url) needles.push(entry.url)
  if (entry.locator) needles.push(entry.locator)
  return needles
}

/** The literal strings an answer must contain to count as having handed over an action. */
export function actionNeedles(entry: ActionEntry): string[] {
  const needles: string[] = []
  if (entry.url) needles.push(entry.url)
  if (entry.contact) needles.push(entry.contact)
  if (entry.locator) needles.push(entry.locator)
  return needles
}

function containsAny(haystack: string, needles: string[]): boolean {
  const text = normalise(haystack)
  return needles.some((n) => text.includes(normalise(n)))
}

function normalise(s: string): string {
  // Dashes and non-breaking spaces vary between the registry and rendered
  // output; a citation should not fail on a typographic difference.
  return s
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

export function mechanicalChecks(
  testCase: GoldenCase,
  response: MentorResponse,
): CheckResult[] {
  const checks: CheckResult[] = []

  checks.push({
    name: "route",
    passed: response.route === testCase.route,
    detail: `expected ${testCase.route}, got ${response.route}`,
  })

  // The central claim of the product: answers come from the seller's state,
  // not from general knowledge. A fluent answer that read nothing fails.
  if (testCase.state.length > 0) {
    const read = new Set(response.stateRead)
    const missed = testCase.state.filter((s) => !read.has(s))
    checks.push({
      name: "consulted state",
      passed: response.stateRead.length > 0 && missed.length === 0,
      detail: missed.length ? `did not read: ${missed.join(", ")}` : undefined,
    })
  }

  for (const entry of testCase.cite) {
    checks.push({
      name: `cite:${entry.key}`,
      passed: containsAny(response.text, citationNeedles(entry)),
      detail: entry.url ?? entry.locator ?? undefined,
    })
  }

  for (const entry of testCase.act) {
    checks.push({
      name: `act:${entry.key}`,
      passed: containsAny(response.text, actionNeedles(entry)),
      detail: entry.label,
    })
  }

  return checks
}

export async function contentChecks(
  testCase: GoldenCase,
  response: MentorResponse,
  judge: Judge,
): Promise<CheckResult[]> {
  const checks: CheckResult[] = []

  for (const claim of testCase.must) {
    checks.push({
      name: `must: ${claim}`,
      passed: await judge.holds(response.text, claim),
    })
  }
  for (const claim of testCase.mustnot) {
    const present = await judge.holds(response.text, claim)
    checks.push({ name: `mustnot: ${claim}`, passed: !present })
  }

  return checks
}

export async function gradeCase(
  testCase: GoldenCase,
  response: MentorResponse,
  judge?: Judge,
): Promise<CaseResult> {
  const checks = mechanicalChecks(testCase, response)
  if (judge) checks.push(...(await contentChecks(testCase, response, judge)))
  return {
    id: testCase.id,
    adversarial: testCase.adv,
    checks,
    passed: checks.every((c) => c.passed),
  }
}

export interface Summary {
  total: number
  passed: number
  failed: string[]
  /** Adversarial failures are listed separately: these are trust-critical. */
  adversarialFailed: string[]
}

export function summarise(results: CaseResult[]): Summary {
  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).map((r) => r.id),
    adversarialFailed: results.filter((r) => !r.passed && r.adversarial).map((r) => r.id),
  }
}

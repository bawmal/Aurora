import type { Stage } from "@/lib/domain/types"

export type Route = "none" | "guidance-layer" | "human-coach" | "refuse"

export interface SourceEntry {
  publisher: string
  title: string
  url?: string | null
  locator?: string | null
  retrieved?: string
}

/** A source as it appears on a case: the registry entry, resolved, plus its key. */
export interface CaseCitation extends SourceEntry {
  key: string
}

/** An action as it appears on a case: the registry entry, resolved, plus its key. */
export interface CaseAction extends ActionEntry {
  key: string
}

export interface ActionEntry {
  label: string
  url?: string | null
  contact?: string | null
  locator?: string | null
  ready?: string[]
  time?: string | null
  note?: string | null
}

export interface GoldenCase {
  id: string
  q: string
  src: string
  stage: Stage
  cat: string
  /** Profile/journey state the mentor must read to answer this correctly. */
  state: string[]
  expect: string
  must: string[]
  mustnot: string[]
  route: Route
  disc: boolean
  adv: boolean
  /** The authority for why, resolved from the source registry. */
  cite: CaseCitation[]
  /** The link, form or number to act on, resolved from the action registry. */
  act: CaseAction[]
}

export interface GoldenSet {
  meta: {
    name: string
    version: string
    count: number
    retrieved: string
    source_registry: Record<string, SourceEntry>
    action_registry: Record<string, ActionEntry>
    [key: string]: unknown
  }
  items: GoldenCase[]
}

/** What the mentor returned, as the runner sees it. */
export interface MentorResponse {
  text: string
  /** State fields the mentor actually read. Empty means it did not consult state. */
  stateRead: string[]
  route: Route
}

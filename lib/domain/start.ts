export const START_GOAL_PANEL = 7
export const START_LAST_PANEL = 9

export function nextStartPanel(panel: number, skipToGoal = false): number {
  return skipToGoal ? START_GOAL_PANEL : Math.min(panel + 1, START_LAST_PANEL)
}

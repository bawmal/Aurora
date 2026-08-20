export const START_GOAL_PANEL = 5

export function nextStartPanel(panel: number, skipToGoal = false): number {
  return skipToGoal ? START_GOAL_PANEL : Math.min(panel + 1, 7)
}

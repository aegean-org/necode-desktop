export type WorkflowShellPanelSide = "left" | "navigator" | "right"
export type WorkflowShellPanelRole = WorkflowShellPanelSide | "content"

export const WORKFLOW_SHELL_LIMITS = {
  leftDefault: 280,
  navigatorDefault: 360,
  rightDefault: 360,
  leftMin: 220,
  leftMax: 420,
  navigatorMin: 300,
  navigatorMax: 560,
  rightMin: 300,
  rightMax: 560,
  centerMin: 440,
  gap: 6,
  edgeInset: 6,
  edgeRadius: 8,
  innerRadius: 10,
  stackVerticalOverflow: 8,
  stackRightOverflow: 8,
  sashHitWidth: 8,
  sashLineWidth: 2,
} as const

type WorkflowShellStyle = Record<string, string | number>

const WORKFLOW_PANEL_SURFACE_CLASS: Record<WorkflowShellPanelRole, string> = {
  left: "bg-transparent",
  navigator: "bg-[var(--workflow-panel-base)] shadow-[var(--workflow-elevation-middle)]",
  content: "bg-[var(--workflow-panel-content)] shadow-[var(--workflow-elevation-middle)]",
  right: "bg-[var(--workflow-panel-base)] shadow-[var(--workflow-elevation-middle)]",
}

/** Parses a fixed pixel panel width from component props. */
export function parseWorkflowPanelWidth(width: number | string | undefined, fallback: number) {
  if (typeof width === "number" && Number.isFinite(width)) return width
  if (typeof width !== "string") return fallback

  const match = /^(\d+(?:\.\d+)?)px$/.exec(width.trim())
  if (!match) return fallback

  const parsed = Number(match[1])
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

/** Returns the maximum width one side panel can take without collapsing the center panel. */
export function workflowPanelResizeMax(input: {
  side: WorkflowShellPanelSide
  containerWidth: number
  otherPanelWidth: number
  otherPanelVisible: boolean
  fixedPanelCount?: number
}) {
  const panelMax = panelLimit(input.side, "max")
  if (input.containerWidth <= 0) return panelMax

  const gaps = WORKFLOW_SHELL_LIMITS.gap * (input.fixedPanelCount ?? (input.otherPanelVisible ? 2 : 1))
  const edgeInsets = WORKFLOW_SHELL_LIMITS.edgeInset * 2
  const available =
    input.containerWidth -
    edgeInsets -
    (input.otherPanelVisible ? input.otherPanelWidth : 0) -
    WORKFLOW_SHELL_LIMITS.centerMin -
    gaps

  const panelMin = panelLimit(input.side, "min")
  return Math.max(panelMin, Math.min(panelMax, available))
}

/** Clamps a dragged side panel width to the Craft-style workflow shell constraints. */
export function clampWorkflowPanelWidth(input: {
  side: WorkflowShellPanelSide
  width: number
  containerWidth: number
  otherPanelWidth: number
  otherPanelVisible: boolean
  fixedPanelCount?: number
}) {
  const min = panelLimit(input.side, "min")
  const max = workflowPanelResizeMax(input)
  return Math.min(max, Math.max(min, input.width))
}

/** Returns the next stored width when a parent-provided panel width changes. */
export function workflowPanelWidthAfterPropSync(input: {
  currentWidth: number
  previousPropWidth: number
  nextPropWidth: number
}) {
  if (input.previousPropWidth === input.nextPropWidth) return input.currentWidth
  return input.nextPropWidth
}

/** Returns the outer shell spacing that separates the stack from the app edge. */
export function workflowShellOuterStyle(): WorkflowShellStyle {
  return {
    ...workflowShellSurfaceStyle(),
    gap: `${WORKFLOW_SHELL_LIMITS.gap}px`,
    "padding-right": `${WORKFLOW_SHELL_LIMITS.edgeInset}px`,
    "padding-bottom": `${WORKFLOW_SHELL_LIMITS.edgeInset}px`,
  }
}

/** Returns local Craft-like surfaces without changing the global OpenCode theme. */
export function workflowShellSurfaceStyle(): WorkflowShellStyle {
  return {
    "--workflow-shell-background":
      "color-mix(in srgb, var(--v2-text-text-base) 2.5%, var(--v2-background-bg-base))",
    "--workflow-panel-base":
      "color-mix(in srgb, var(--v2-text-text-base) 0.8%, var(--v2-background-bg-base))",
    "--workflow-panel-content": "color-mix(in srgb, var(--v2-text-text-base) 1.8%, var(--v2-background-bg-base))",
    "--workflow-row-hover": "color-mix(in srgb, var(--v2-text-text-base) 2%, transparent)",
    "--workflow-row-selected": "color-mix(in srgb, var(--v2-text-text-base) 7%, transparent)",
    "--workflow-surface-muted": "color-mix(in srgb, var(--v2-text-text-base) 3%, var(--workflow-panel-content))",
    "--workflow-surface-muted-hover":
      "color-mix(in srgb, var(--v2-text-text-base) 5%, var(--workflow-panel-content))",
    "--workflow-control-selected": "var(--workflow-panel-base)",
    "--workflow-elevation-minimal":
      "0 0 0 1px color-mix(in srgb, var(--v2-text-text-base) 4%, transparent), 0 1px 1px -0.5px color-mix(in srgb, var(--v2-text-text-base) 10%, transparent)",
    "--workflow-elevation-middle":
      "0 0 0 1px color-mix(in srgb, var(--v2-text-text-base) 6%, transparent), 0 1px 1px -0.5px color-mix(in srgb, var(--v2-text-text-base) 12%, transparent), 0 3px 3px -1.5px color-mix(in srgb, var(--v2-text-text-base) 10%, transparent), 0 6px 6px -3px color-mix(in srgb, var(--v2-text-text-base) 8%, transparent)",
    "--background-base": "var(--workflow-panel-base)",
    "--background-stronger": "var(--workflow-panel-content)",
    "--surface-base": "var(--workflow-surface-muted)",
    "--surface-base-hover": "var(--workflow-surface-muted-hover)",
    "--surface-base-active": "var(--workflow-row-selected)",
    "--surface-raised-base": "var(--workflow-surface-muted)",
    "--surface-raised-base-hover": "var(--workflow-surface-muted-hover)",
    "--surface-raised-base-active": "var(--workflow-row-selected)",
    "--surface-raised-stronger-non-alpha": "var(--workflow-panel-base)",
    background: "var(--workflow-shell-background)",
  }
}

/** Returns scroll overflow spacing that lets panel shadows render without shifting panels down. */
export function workflowPanelScrollStyle(): WorkflowShellStyle {
  return {
    "margin-block": `-${WORKFLOW_SHELL_LIMITS.stackVerticalOverflow}px`,
    "margin-bottom": `-${WORKFLOW_SHELL_LIMITS.edgeInset}px`,
    "margin-right": `-${WORKFLOW_SHELL_LIMITS.stackRightOverflow}px`,
    "padding-block": `${WORKFLOW_SHELL_LIMITS.stackVerticalOverflow}px`,
    "padding-bottom": `${WORKFLOW_SHELL_LIMITS.edgeInset}px`,
    "padding-right": `${WORKFLOW_SHELL_LIMITS.stackRightOverflow}px`,
  }
}

/** Returns the horizontal panel stack style used by sidebar, navigator, and content slots. */
export function workflowPanelStackStyle(input: { hasLeft: boolean }): WorkflowShellStyle {
  return {
    gap: `${WORKFLOW_SHELL_LIMITS.gap}px`,
    "flex-grow": 1,
    "min-width": 0,
    "padding-left": `${input.hasLeft ? 0 : WORKFLOW_SHELL_LIMITS.edgeInset}px`,
  }
}

/** Returns Craft-style corner radii for edge-facing and interior panel corners. */
export function workflowPanelChromeStyle(input: { atLeftEdge: boolean; atRightEdge: boolean }): WorkflowShellStyle {
  const leftBottom = input.atLeftEdge ? WORKFLOW_SHELL_LIMITS.edgeRadius : WORKFLOW_SHELL_LIMITS.innerRadius
  const rightBottom = input.atRightEdge ? WORKFLOW_SHELL_LIMITS.edgeRadius : WORKFLOW_SHELL_LIMITS.innerRadius
  return {
    "border-top-left-radius": `${WORKFLOW_SHELL_LIMITS.innerRadius}px`,
    "border-bottom-left-radius": `${leftBottom}px`,
    "border-top-right-radius": `${WORKFLOW_SHELL_LIMITS.innerRadius}px`,
    "border-bottom-right-radius": `${rightBottom}px`,
  }
}

/** Returns whether a fixed slot should render raised panel chrome. */
export function workflowPanelUsesChrome(side: WorkflowShellPanelSide) {
  return side !== "left"
}

/** Returns the surface treatment matching Craft's sidebar/navigator/content split. */
export function workflowPanelSurfaceClass(role: WorkflowShellPanelRole) {
  return WORKFLOW_PANEL_SURFACE_CLASS[role]
}

/** Returns the configured min or max width for a fixed workflow panel. */
export function panelLimit(side: WorkflowShellPanelSide, edge: "min" | "max") {
  if (side === "left") return edge === "min" ? WORKFLOW_SHELL_LIMITS.leftMin : WORKFLOW_SHELL_LIMITS.leftMax
  if (side === "navigator") {
    return edge === "min" ? WORKFLOW_SHELL_LIMITS.navigatorMin : WORKFLOW_SHELL_LIMITS.navigatorMax
  }
  return edge === "min" ? WORKFLOW_SHELL_LIMITS.rightMin : WORKFLOW_SHELL_LIMITS.rightMax
}

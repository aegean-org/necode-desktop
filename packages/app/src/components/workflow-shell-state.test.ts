import { describe, expect, test } from "bun:test"
import {
  WORKFLOW_SHELL_LIMITS,
  clampWorkflowPanelWidth,
  parseWorkflowPanelWidth,
  workflowPanelChromeStyle,
  workflowPanelSurfaceClass,
  workflowPanelUsesChrome,
  workflowPanelScrollStyle,
  workflowPanelStackStyle,
  workflowPanelResizeMax,
  workflowShellSurfaceStyle,
  workflowShellOuterStyle,
} from "./workflow-shell-state"

describe("workflow shell sizing", () => {
  test("keeps Phase 1 workflow shell constants aligned with Craft", () => {
    expect(WORKFLOW_SHELL_LIMITS.gap).toBe(6)
    expect(WORKFLOW_SHELL_LIMITS.edgeInset).toBe(6)
    expect(WORKFLOW_SHELL_LIMITS.innerRadius).toBe(10)
    expect(WORKFLOW_SHELL_LIMITS.edgeRadius).toBe(8)
    expect(WORKFLOW_SHELL_LIMITS.centerMin).toBe(440)
    expect(WORKFLOW_SHELL_LIMITS.stackVerticalOverflow).toBe(8)
  })

  test("keeps workflow surface variables scoped to the shell contract", () => {
    const style = workflowShellSurfaceStyle()

    expect(style["--workflow-shell-background"]).toContain("color-mix")
    expect(style["--workflow-panel-base"]).toContain("color-mix")
    expect(style["--workflow-panel-content"]).toContain("color-mix")
    expect(style["--background-base"]).toBe("var(--workflow-panel-base)")
    expect(style["--background-stronger"]).toBe("var(--workflow-panel-content)")
    expect(style.background).toBe("var(--workflow-shell-background)")
  })

  test("keeps panel surface roles distinct", () => {
    expect(workflowPanelSurfaceClass("left")).toBe("bg-transparent")
    expect(workflowPanelSurfaceClass("navigator")).toContain("--workflow-panel-base")
    expect(workflowPanelSurfaceClass("content")).toContain("--workflow-panel-content")
    expect(workflowPanelSurfaceClass("right")).toContain("--workflow-panel-base")
  })

  test("uses Craft panel stack geometry constants", () => {
    expect(WORKFLOW_SHELL_LIMITS.gap).toBe(6)
    expect(WORKFLOW_SHELL_LIMITS.edgeInset).toBe(6)
    expect(WORKFLOW_SHELL_LIMITS.edgeRadius).toBe(8)
    expect(WORKFLOW_SHELL_LIMITS.innerRadius).toBe(10)
    expect(WORKFLOW_SHELL_LIMITS.centerMin).toBe(440)
    expect(WORKFLOW_SHELL_LIMITS.stackVerticalOverflow).toBe(8)
  })

  test("describes the Craft desktop panel stack styles", () => {
    expect(workflowShellOuterStyle()).toMatchObject({
      gap: "6px",
      "padding-right": "6px",
      "padding-bottom": "6px",
      background: "var(--workflow-shell-background)",
    })
    expect(workflowPanelScrollStyle()).toEqual({
      "margin-block": "-8px",
      "margin-bottom": "-6px",
      "margin-right": "-8px",
      "padding-block": "8px",
      "padding-bottom": "6px",
      "padding-right": "8px",
    })
    expect(workflowPanelStackStyle({ hasLeft: true })).toEqual({
      gap: "6px",
      "flex-grow": 1,
      "min-width": 0,
      "padding-left": "0px",
    })
    expect(workflowPanelStackStyle({ hasLeft: false })["padding-left"]).toBe("6px")
  })

  test("uses Craft edge and inner radii for panel chrome", () => {
    expect(workflowPanelChromeStyle({ atLeftEdge: true, atRightEdge: false })).toEqual({
      "border-top-left-radius": "10px",
      "border-bottom-left-radius": "8px",
      "border-top-right-radius": "10px",
      "border-bottom-right-radius": "10px",
    })
  })

  test("keeps the primary sidebar as a lightweight slot instead of a raised panel", () => {
    expect(workflowPanelUsesChrome("left")).toBe(false)
    expect(workflowPanelUsesChrome("navigator")).toBe(true)
    expect(workflowPanelUsesChrome("right")).toBe(true)
  })

  test("uses Craft-like panel surfaces over the workflow background", () => {
    expect(workflowPanelSurfaceClass("left")).toBe("bg-transparent")
    expect(workflowPanelSurfaceClass("navigator")).toContain("bg-[var(--workflow-panel-base)]")
    expect(workflowPanelSurfaceClass("content")).toContain("bg-[var(--workflow-panel-content)]")
    expect(workflowPanelSurfaceClass("right")).toContain("bg-[var(--workflow-panel-base)]")
    expect(workflowPanelSurfaceClass("navigator")).toContain("shadow-[var(--workflow-elevation-middle)]")
    expect(workflowPanelSurfaceClass("content")).toContain("shadow-[var(--workflow-elevation-middle)]")
  })

  test("scopes Craft-like surfaces to the workflow shell", () => {
    expect(workflowShellSurfaceStyle()).toMatchObject({
      "--workflow-shell-background":
        "color-mix(in srgb, var(--v2-text-text-base) 2.5%, var(--v2-background-bg-base))",
      "--workflow-panel-base":
        "color-mix(in srgb, var(--v2-text-text-base) 0.8%, var(--v2-background-bg-base))",
      "--workflow-panel-content": "color-mix(in srgb, var(--v2-text-text-base) 1.8%, var(--v2-background-bg-base))",
      "--workflow-elevation-minimal":
        "0 0 0 1px color-mix(in srgb, var(--v2-text-text-base) 4%, transparent), 0 1px 1px -0.5px color-mix(in srgb, var(--v2-text-text-base) 10%, transparent)",
      "--background-base": "var(--workflow-panel-base)",
      "--background-stronger": "var(--workflow-panel-content)",
      "--surface-raised-base": "var(--workflow-surface-muted)",
      "--surface-raised-stronger-non-alpha": "var(--workflow-panel-base)",
      background: "var(--workflow-shell-background)",
    })
  })

  test("parses numeric and px widths", () => {
    expect(parseWorkflowPanelWidth(320, 280)).toBe(320)
    expect(parseWorkflowPanelWidth("380px", 280)).toBe(380)
    expect(parseWorkflowPanelWidth("40%", 280)).toBe(280)
  })

  test("keeps the center panel above its minimum width", () => {
    const max = workflowPanelResizeMax({
      side: "left",
      containerWidth: 1000,
      otherPanelWidth: 300,
      otherPanelVisible: true,
    })

    expect(max).toBe(
      1000 - WORKFLOW_SHELL_LIMITS.edgeInset * 2 - 300 - WORKFLOW_SHELL_LIMITS.centerMin - WORKFLOW_SHELL_LIMITS.gap * 2,
    )
  })

  test("clamps resized panel width to the available shell space", () => {
    expect(
      clampWorkflowPanelWidth({
        side: "right",
        width: 900,
        containerWidth: 1100,
        otherPanelWidth: 260,
        otherPanelVisible: true,
      }),
    ).toBe(
      1100 - WORKFLOW_SHELL_LIMITS.edgeInset * 2 - 260 - WORKFLOW_SHELL_LIMITS.centerMin - WORKFLOW_SHELL_LIMITS.gap * 2,
    )
  })

  test("accounts for three fixed panels around the content panel", () => {
    expect(
      workflowPanelResizeMax({
        side: "navigator",
        containerWidth: 1600,
        otherPanelWidth: 760,
        otherPanelVisible: true,
        fixedPanelCount: 3,
      }),
    ).toBe(
      1600 - WORKFLOW_SHELL_LIMITS.edgeInset * 2 - 760 - WORKFLOW_SHELL_LIMITS.centerMin - WORKFLOW_SHELL_LIMITS.gap * 3,
    )
  })
})

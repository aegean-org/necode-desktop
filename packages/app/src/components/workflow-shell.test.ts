import { describe, expect, test } from "bun:test"

const workflowShellSource = await Bun.file(new URL("./workflow-shell.tsx", import.meta.url)).text()
const workflowResizeSashSource = await Bun.file(new URL("./workflow-resize-sash.tsx", import.meta.url)).text()
const appSource = await Bun.file(new URL("../app.tsx", import.meta.url)).text()

describe("workflow shell resize sash", () => {
  test("uses workflow-specific resize sashes instead of the clipped shared handle", () => {
    expect(workflowShellSource).not.toContain("@opencode-ai/ui/resize-handle")
    expect(workflowShellSource).toContain("WorkflowResizeSash")
    expect(workflowShellSource).toContain('data-component="workflow-panel-stack"')
  })

  test("keeps resize sashes visually transparent while preserving the drag cursor", () => {
    expect(workflowResizeSashSource).toContain("cursor-col-resize")
    expect(workflowResizeSashSource).toContain('data-component="workflow-resize-sash-hit-area"')
    expect(workflowResizeSashSource).not.toContain('data-component="workflow-resize-sash-line"')
    expect(workflowResizeSashSource).not.toContain("ACTIVE_LINE_COLOR")
  })

  test("marks compact layout and hides secondary chrome in compact mode", () => {
    expect(workflowShellSource).toContain("data-layout-mode={sizing.layoutMode()}")
    expect(workflowShellSource).toContain("leftVisible")
    expect(workflowShellSource).toContain("rightVisible")
    expect(workflowShellSource).toContain("layoutMode() === \"desktop\"")
  })

  test("keeps an explicitly opened right panel visible in compact layout", () => {
    expect(workflowShellSource).toContain("right: createMemo(() => !!props.right)")
    expect(workflowShellSource).not.toContain(
      'right: createMemo(() => layoutMode() === "desktop" && !!props.right)',
    )
  })

  test("uses one navigation visibility contract for the first two panels", () => {
    expect(workflowShellSource).toContain(
      "left: createMemo(() => props.navigationOpen !== false && !!props.left)",
    )
    expect(workflowShellSource).toContain(
      "navigator: createMemo(() => props.navigationOpen !== false && !!props.navigator)",
    )
  })

  test("keeps persisted panel widths mounted while routes switch", () => {
    expect(workflowShellSource).toContain("provider: WorkflowShellProvider")
    expect(workflowShellSource).toContain("const panelState = useWorkflowShellState()")
    expect(appSource).toContain("<WorkflowShellProvider>")
    expect(appSource).toContain("</WorkflowShellProvider>")
  })

  test("uses an overlay inspector for the right panel in compact layout", () => {
    expect(workflowShellSource).toContain('overlay={rightVisible() && sizing.layoutMode() === "compact"}')
    expect(workflowShellSource).toContain('position: props.overlay ? "absolute" : undefined')
    expect(workflowShellSource).toContain('right: createMemo(() => !!props.right)')
    expect(workflowShellSource).toContain("workflowOverlayPanelWidth")
  })

  test("refreshes measured width on browser window resize", () => {
    expect(workflowShellSource).toContain('window.addEventListener("resize", syncRootWidth)')
    expect(workflowShellSource).toContain('onCleanup(() => window.removeEventListener("resize", syncRootWidth))')
  })

  test("keeps a dedicated visible gap before the fourth panel", () => {
    expect(workflowShellSource).toContain('props.side === "right"')
    expect(workflowShellSource).toContain("WORKFLOW_SHELL_LIMITS.rightGap - WORKFLOW_SHELL_LIMITS.gap")
  })
})

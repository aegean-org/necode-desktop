import { describe, expect, test } from "bun:test"

const workflowShellSource = await Bun.file(new URL("./workflow-shell.tsx", import.meta.url)).text()

describe("workflow shell resize sash", () => {
  test("uses workflow-specific resize sashes instead of the clipped shared handle", () => {
    expect(workflowShellSource).not.toContain("@opencode-ai/ui/resize-handle")
    expect(workflowShellSource).toContain("WorkflowResizeSash")
    expect(workflowShellSource).toContain('data-component="workflow-panel-stack"')
  })

  test("marks compact layout and hides secondary chrome in compact mode", () => {
    expect(workflowShellSource).toContain("data-layout-mode={sizing.layoutMode()}")
    expect(workflowShellSource).toContain("leftVisible")
    expect(workflowShellSource).toContain("rightVisible")
    expect(workflowShellSource).toContain("layoutMode() === \"desktop\"")
  })

  test("refreshes measured width on browser window resize", () => {
    expect(workflowShellSource).toContain('window.addEventListener("resize", syncRootWidth)')
    expect(workflowShellSource).toContain('onCleanup(() => window.removeEventListener("resize", syncRootWidth))')
  })
})

import { describe, expect, test } from "bun:test"

const workflowShellSource = await Bun.file(new URL("./workflow-shell.tsx", import.meta.url)).text()

describe("workflow shell resize sash", () => {
  test("uses workflow-specific resize sashes instead of the clipped shared handle", () => {
    expect(workflowShellSource).not.toContain("@opencode-ai/ui/resize-handle")
    expect(workflowShellSource).toContain("WorkflowResizeSash")
    expect(workflowShellSource).toContain('data-component="workflow-panel-stack"')
  })
})

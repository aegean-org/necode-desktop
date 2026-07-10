import { describe, expect, test } from "bun:test"

const source = await Bun.file(new URL("./workflow-inspector.tsx", import.meta.url)).text()

describe("HomeWorkflowInspector", () => {
  test("exposes the same session management actions as task rows", () => {
    expect(source).toContain("WorkflowSessionActions")
    expect(source).toContain("pinned={!!task().pinnedAt}")
    expect(source).toContain("archived={!!task().archivedAt}")
    expect(source).toContain("onDelete={() => props.onDelete(task())}")
  })
})

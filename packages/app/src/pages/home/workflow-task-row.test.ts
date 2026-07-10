import { describe, expect, test } from "bun:test"

const source = await Bun.file(new URL("./workflow-task-row.tsx", import.meta.url)).text()

describe("HomeWorkflowTaskRow", () => {
  test("exposes open, pin, archive or restore, and delete actions", () => {
    expect(source).toContain('data-component="home-workflow-task-row"')
    expect(source).toContain("WorkflowSessionActions")
    expect(source).toContain("pinned={!!props.task.pinnedAt}")
    expect(source).toContain("archived={!!props.task.archivedAt}")
    expect(source).toContain("onClick={() => props.onOpen(props.task.session)}")
    expect(source).toContain("onDelete={props.onDelete}")
  })
})

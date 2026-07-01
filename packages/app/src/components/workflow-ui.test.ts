import { describe, expect, test } from "bun:test"
import { WORKFLOW_ENTITY_ROW, WORKFLOW_NAV_ROW, workflowEntityRowDataAttributes } from "./workflow-ui"

describe("workflow UI primitives", () => {
  test("keeps entity rows using the workflow selected treatment", () => {
    expect(WORKFLOW_ENTITY_ROW).toContain("data-[selected]")
    expect(WORKFLOW_ENTITY_ROW).toContain("--workflow-row-hover")
    expect(WORKFLOW_ENTITY_ROW).toContain("--v2-icon-icon-accent")
  })

  test("keeps navigation rows compact and selectable", () => {
    expect(WORKFLOW_NAV_ROW).toContain("h-7")
    expect(WORKFLOW_NAV_ROW).toContain("data-[selected]")
  })

  test("builds stable row data attributes", () => {
    expect(workflowEntityRowDataAttributes({ selected: true, rowID: "ses_123" })).toEqual({
      "data-selected": "",
      "data-row-id": "ses_123",
    })
    expect(workflowEntityRowDataAttributes({ selected: false })).toEqual({
      "data-selected": undefined,
      "data-row-id": undefined,
    })
  })
})

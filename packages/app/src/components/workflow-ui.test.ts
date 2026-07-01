import { describe, expect, test } from "bun:test"
import {
  WORKFLOW_ENTITY_ROW,
  WORKFLOW_NAV_ROW,
  WORKFLOW_SECTION_LABEL,
  WORKFLOW_SURFACE_BUTTON,
  WORKFLOW_SURFACE_CARD,
  WorkflowEntityList,
  WorkflowEntityRow,
  WorkflowSectionHeader,
  WorkflowSegmentedControl,
  workflowEntityRowDataAttributes,
} from "./workflow-ui"

const workflowUiSource = await Bun.file(new URL("./workflow-ui.tsx", import.meta.url)).text()

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

  test("keeps entity row actions outside the row selection button", () => {
    const rowSource = workflowUiSource.slice(
      workflowUiSource.indexOf("export function WorkflowEntityRow"),
      workflowUiSource.indexOf("export function WorkflowEntityList"),
    )
    const selectButtonSource = rowSource.slice(
      rowSource.indexOf('data-component="workflow-entity-row-select"'),
      rowSource.indexOf("</button>"),
    )

    expect(rowSource).toContain('data-component="workflow-entity-row"')
    expect(rowSource).toContain('data-component="workflow-entity-row-select"')
    expect(rowSource).toContain("workflowEntityRowDataAttributes({ selected: props.selected, rowID: props.rowID })")
    expect(selectButtonSource).not.toContain("props.actions")
  })

  test("binds row selection only to the row selection button", () => {
    const rowSource = workflowUiSource.slice(
      workflowUiSource.indexOf("export function WorkflowEntityRow"),
      workflowUiSource.indexOf("export function WorkflowEntityList"),
    )
    const selectButtonSource = rowSource.slice(
      rowSource.indexOf('data-component="workflow-entity-row-select"'),
      rowSource.indexOf("</button>"),
    )
    const actionsSource = rowSource.slice(rowSource.indexOf("{props.actions ?"))

    expect(selectButtonSource).toContain("onClick={props.onSelect}")
    expect(actionsSource).not.toContain("onClick={props.onSelect}")
  })

  test("keeps shared workflow class constants intentional", () => {
    expect(WORKFLOW_SECTION_LABEL).toContain("uppercase")
    expect(WORKFLOW_SURFACE_BUTTON).toContain(WORKFLOW_SURFACE_CARD)
    expect(WORKFLOW_SURFACE_BUTTON).toContain("data-[selected]")
  })

  test("exports shared workflow component primitives intentionally", () => {
    expect(typeof WorkflowEntityRow).toBe("function")
    expect(typeof WorkflowEntityList).toBe("function")
    expect(typeof WorkflowSectionHeader).toBe("function")
    expect(typeof WorkflowSegmentedControl).toBe("function")
    expect(workflowUiSource).toContain('data-component="workflow-section-header"')
    expect(workflowUiSource).toContain('data-component="workflow-segmented-control"')
    expect(workflowUiSource).toContain('data-component="workflow-segmented-control-option"')
  })
})

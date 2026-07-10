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
    expect(WORKFLOW_ENTITY_ROW).toContain("--workflow-elevation-minimal")
    expect(WORKFLOW_ENTITY_ROW).not.toContain("inset_2px_0_0")
    expect(WORKFLOW_ENTITY_ROW).not.toContain("--v2-icon-icon-accent")
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

  test("reveals row actions when keyboard focus enters the row", () => {
    const rowSource = workflowUiSource.slice(
      workflowUiSource.indexOf("export function WorkflowEntityRow"),
      workflowUiSource.indexOf("export function WorkflowEntityList"),
    )
    const actionsSource = rowSource.slice(rowSource.indexOf("{props.actions ?"))

    expect(actionsSource).toContain("opacity-0")
    expect(actionsSource).toContain("group-hover:opacity-100")
    expect(actionsSource).toContain("group-focus-within:opacity-100")
  })

  test("keeps row actions as a compact overlay affordance", () => {
    const rowSource = workflowUiSource.slice(
      workflowUiSource.indexOf("export function WorkflowEntityRow"),
      workflowUiSource.indexOf("export function WorkflowEntityList"),
    )
    const actionsSource = rowSource.slice(rowSource.indexOf("{props.actions ?"))

    expect(actionsSource).toContain('data-component="workflow-entity-row-actions"')
    expect(actionsSource).toContain("absolute")
    expect(actionsSource).toContain("right-2")
  })

  test("reserves title width for compact action groups", () => {
    const rowSource = workflowUiSource.slice(
      workflowUiSource.indexOf("export function WorkflowEntityRow"),
      workflowUiSource.indexOf("export function WorkflowEntityList"),
    )
    const selectButtonSource = rowSource.slice(
      rowSource.indexOf('data-component="workflow-entity-row-select"'),
      rowSource.indexOf("</button>"),
    )
    const selectButtonTag = selectButtonSource.slice(0, selectButtonSource.indexOf("onClick="))

    expect(rowSource).toContain('const titlePadding = props.actions ? "pr-16" : ""')
    expect(selectButtonTag).not.toContain("${titlePadding}")
    expect(rowSource).toContain("${titlePadding}")
    expect(selectButtonSource).not.toContain("pr-10")
  })

  test("places trailing metadata on the second row", () => {
    const rowSource = workflowUiSource.slice(
      workflowUiSource.indexOf("export function WorkflowEntityRow"),
      workflowUiSource.indexOf("export function WorkflowEntityList"),
    )
    const firstRow = rowSource.slice(rowSource.indexOf('class={`flex min-w-0 items-center'), rowSource.indexOf("</div>"))
    const secondRow = rowSource.slice(rowSource.indexOf("props.subtitle || props.trailing"), rowSource.indexOf("</button>"))

    expect(firstRow).not.toContain("props.trailing")
    expect(secondRow).toContain("props.subtitle")
    expect(secondRow).toContain("props.trailing")
    expect(secondRow.indexOf("props.subtitle")).toBeLessThan(secondRow.indexOf("props.trailing"))
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

import { describe, expect, test } from "bun:test"

const source = await Bun.file(new URL("./workflow-session-actions.tsx", import.meta.url)).text()
const zht = await Bun.file(new URL("../../i18n/zht.ts", import.meta.url)).text()

describe("WorkflowSessionActions", () => {
  test("keeps pin reversible actions separate from permanent delete", () => {
    expect(source).toContain('data-action="workflow-session-pin"')
    expect(source).toContain('data-action="workflow-session-menu"')
    expect(source).toContain("props.archived ? props.onRestore : props.onArchive")
    expect(source).toContain("props.pinned ? props.onUnpin : props.onPin")
    expect(source).toContain("DialogDeleteWorkflowSession")
    expect(source).toContain("props.onDelete")
    expect(source.indexOf("MenuV2.Separator")).toBeLessThan(source.indexOf("DialogDeleteWorkflowSession"))
  })

  test("localizes reversible actions in Traditional Chinese", () => {
    expect(zht).toContain('"session.action.pin": "置頂工作階段"')
    expect(zht).toContain('"session.action.unpin": "取消置頂"')
    expect(zht).toContain('"session.action.restore": "還原工作階段"')
  })
})

import { describe, expect, test } from "bun:test"

const source = await Bun.file(new URL("../home.tsx", import.meta.url)).text()

describe("Home archived state", () => {
  test("uses archived loading and empty states only for the archived filter", () => {
    expect(source).toContain('controller.context.state.filter === "archived"')
    expect(source).toContain("controller.tasks.archivedLoad.isLoading")
    expect(source).toContain('language.t("home.tasks.empty.archived")')
  })

  test("hydrates archived counts whenever the selected server and projects are ready", () => {
    const archivedLoad = source.slice(source.indexOf("function createHomeArchivedSessionLoad"), source.indexOf("function createHomeWorkflowActions"))

    expect(archivedLoad).toContain("enabled: !!input.selection.focusedServerCtx()")
    expect(archivedLoad).toContain("input.selection.projectDirectories().length > 0")
    expect(archivedLoad).not.toContain('enabled: input.context.state.filter === "archived"')
  })
})

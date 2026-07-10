import { describe, expect, test } from "bun:test"

const source = await Bun.file(new URL("../home.tsx", import.meta.url)).text()

describe("Home archived state", () => {
  test("uses archived loading and empty states only for the archived filter", () => {
    expect(source).toContain('controller.context.state.filter === "archived"')
    expect(source).toContain("controller.tasks.archivedLoad.isLoading")
    expect(source).toContain('language.t("home.tasks.empty.archived")')
  })
})

import { describe, expect, test } from "bun:test"

const home = await Bun.file(new URL("../home.tsx", import.meta.url)).text()
const sidebar = await Bun.file(new URL("./sidebar-project.tsx", import.meta.url)).text()
const en = await Bun.file(new URL("../../i18n/en.ts", import.meta.url)).text()
const zh = await Bun.file(new URL("../../i18n/zh.ts", import.meta.url)).text()

describe("project removal copy", () => {
  test("labels local project closure as removal from NeCode", () => {
    expect(home).toContain('props.language.t("project.removeFromNecode")')
    expect(sidebar).toContain('props.language.t("project.removeFromNecode")')
    expect(en).toContain('"project.removeFromNecode": "Remove from NeCode"')
    expect(zh).toContain('"project.removeFromNecode": "从 NeCode 移除"')
  })
})

import { describe, expect, test } from "bun:test"

const source = await Bun.file(new URL("./rows.ts", import.meta.url)).text()

describe("Timeline thinking rows", () => {
  test("hides thinking after the first renderable assistant result", () => {
    expect(source).toContain("assistantPartRefs.length === 0")
    expect(source).not.toContain("showReasoning ? assistantPartRefs.length === 0 : true")
  })
})

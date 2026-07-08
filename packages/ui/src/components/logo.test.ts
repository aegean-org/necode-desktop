import { describe, expect, test } from "bun:test"

const source = await Bun.file(new URL("./logo.tsx", import.meta.url)).text()

describe("NeCode logo components", () => {
  test("render the NeCode mark instead of the old OpenCode square", () => {
    expect(source).toContain('data-slot="necode-mark-diagonal"')
    expect(source).toContain("#FF6B4A")
    expect(source).toContain("#FFB86B")
    expect(source).not.toContain('data-slot="logo-logo-mark-o"')
  })
})

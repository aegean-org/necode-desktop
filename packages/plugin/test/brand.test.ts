import { describe, expect, test } from "bun:test"
import path from "node:path"

describe("NeCode plugin package", () => {
  test("publishes the branded package with all public subpaths", async () => {
    const pkg = await Bun.file(path.join(import.meta.dir, "..", "..", "plugin-necode", "package.json")).json()
    const publish = await Bun.file(path.join(import.meta.dir, "..", "..", "..", "script", "publish.ts")).text()
    const config = await Bun.file(
      path.join(import.meta.dir, "..", "..", "opencode", "src", "config", "config.ts"),
    ).text()
    const tui = await Bun.file(path.join(import.meta.dir, "..", "..", "opencode", "src", "config", "tui.ts")).text()

    expect(pkg.name).toBe("@necode-ai/plugin")
    expect(Object.keys(pkg.exports)).toEqual([".", "./tool", "./tui"])
    expect(publish).toContain("packages/plugin-necode/script/publish.ts")
    expect(config).toContain('name: "@necode-ai/plugin"')
    expect(tui).toContain('name: "@necode-ai/plugin"')
  })
})

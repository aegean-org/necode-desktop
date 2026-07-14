import { describe, expect, test } from "bun:test"
import { firstPickedDirectory, firstPickedFile, normalizeLocalSpec, normalizeNpmSpec } from "./plugin-install-model"

describe("plugin install model", () => {
  test("normalizes npm packages and local Windows paths", () => {
    expect(normalizeNpmSpec("  @scope/demo  ")).toBe("@scope/demo")
    expect(normalizeLocalSpec("  C:\\plugins\\demo  ")).toBe("C:\\plugins\\demo")
    expect(() => normalizeNpmSpec("  ")).toThrow("package")
    expect(() => normalizeLocalSpec("  ")).toThrow("path")
  })

  test("extracts one directory or file path from native picker results", () => {
    expect(firstPickedDirectory("C:\\plugins\\demo")).toBe("C:\\plugins\\demo")
    expect(firstPickedDirectory(["C:\\plugins\\one", "C:\\plugins\\two"])).toBe("C:\\plugins\\one")
    expect(firstPickedDirectory(null)).toBeUndefined()
    expect(firstPickedFile([{ path: "C:\\plugins\\demo.ts", name: "demo.ts", size: 10 }])).toBe("C:\\plugins\\demo.ts")
    expect(firstPickedFile(null)).toBeUndefined()
  })
})

import { afterEach, expect, test } from "bun:test"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { migrateDesktopConfigDir } from "./src/main/config-dir"

const roots: string[] = []

afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
})

test("uses necode-desktop when no legacy config exists", () => {
  const root = workspace()

  expect(migrateDesktopConfigDir({ userDataPath: root })).toBe("necode-desktop")
  expect(existsSync(join(root, "xdg-config", "necode-desktop"))).toBe(false)
})

test("moves the complete legacy config directory", () => {
  const root = workspace()
  writeConfig(root, "opencode", "opencode.jsonc", '{"mcp":{"cua-driver":{}}}')
  writeConfig(root, "opencode", "plugins/computer-use.json", "enabled")

  expect(migrateDesktopConfigDir({ userDataPath: root })).toBe("necode-desktop")
  expect(existsSync(join(root, "xdg-config", "opencode"))).toBe(false)
  expect(readFileSync(join(root, "xdg-config", "necode-desktop", "opencode.jsonc"), "utf8")).toContain(
    "cua-driver",
  )
  expect(readFileSync(join(root, "xdg-config", "necode-desktop", "plugins", "computer-use.json"), "utf8")).toBe(
    "enabled",
  )
})

test("keeps an existing necode-desktop directory without merging legacy files", () => {
  const root = workspace()
  writeConfig(root, "opencode", "legacy.json", "legacy")
  writeConfig(root, "necode-desktop", "current.json", "current")

  expect(migrateDesktopConfigDir({ userDataPath: root })).toBe("necode-desktop")
  expect(readFileSync(join(root, "xdg-config", "necode-desktop", "current.json"), "utf8")).toBe("current")
  expect(existsSync(join(root, "xdg-config", "necode-desktop", "legacy.json"))).toBe(false)
  expect(existsSync(join(root, "xdg-config", "opencode", "legacy.json"))).toBe(true)
})

test("copies through a temporary directory when the direct move fails", () => {
  const root = workspace()
  writeConfig(root, "opencode", "opencode.jsonc", "legacy")
  let calls = 0

  expect(
    migrateDesktopConfigDir({
      userDataPath: root,
      rename: (source, target) => {
        calls++
        if (calls === 1) throw new Error("EXDEV")
        renameSync(source, target)
      },
    }),
  ).toBe("necode-desktop")
  expect(calls).toBe(2)
  expect(readFileSync(join(root, "xdg-config", "necode-desktop", "opencode.jsonc"), "utf8")).toBe("legacy")
  expect(existsSync(join(root, "xdg-config", "opencode", "opencode.jsonc"))).toBe(true)
})

test("falls back to the legacy directory when move and copy both fail", () => {
  const root = workspace()
  const logs: string[] = []
  writeConfig(root, "opencode", "opencode.jsonc", "legacy")

  expect(
    migrateDesktopConfigDir({
      userDataPath: root,
      rename: () => {
        throw new Error("move failed")
      },
      copy: () => {
        throw new Error("copy failed")
      },
      log: (message) => logs.push(message),
    }),
  ).toBe("opencode")
  expect(readFileSync(join(root, "xdg-config", "opencode", "opencode.jsonc"), "utf8")).toBe("legacy")
  expect(existsSync(join(root, "xdg-config", "necode-desktop"))).toBe(false)
  expect(logs.join("\n")).toContain("copy failed")
})

function workspace() {
  const root = mkdtempSync(join(tmpdir(), "necode-config-dir-"))
  roots.push(root)
  return root
}

function writeConfig(root: string, directory: string, file: string, content: string) {
  const target = join(root, "xdg-config", directory, file)
  mkdirSync(join(target, ".."), { recursive: true })
  writeFileSync(target, content)
}

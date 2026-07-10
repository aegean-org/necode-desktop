import { describe, expect } from "bun:test"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Effect } from "effect"
import path from "node:path"
import { MCPConfigSource } from "@/mcp/config-source"
import type { InstanceContext } from "@/project/instance-context"
import { testEffect } from "../lib/effect"

const { effect: test } = testEffect(FSUtil.defaultLayer)

describe("MCPConfigSource", () => {
  test(
    "discovers existing sources in runtime precedence order",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const root = yield* fs.makeTempDirectoryScoped()
      const globalConfigDir = path.join(root, "global")
      const worktree = path.join(root, "project")
      const ctx = context(worktree)
      const expected = [
        path.join(globalConfigDir, "config.json"),
        path.join(globalConfigDir, "opencode.json"),
        path.join(globalConfigDir, "opencode.jsonc"),
        path.join(worktree, "opencode.json"),
        path.join(worktree, "opencode.jsonc"),
        path.join(worktree, ".opencode", "opencode.json"),
        path.join(worktree, ".opencode", "opencode.jsonc"),
      ]
      yield* Effect.forEach(expected, (source) => fs.writeWithDirs(source, "{}"), { discard: true })

      const sources = yield* MCPConfigSource.discover({ fs, globalConfigDir, ctx })

      expect(sources.map((source) => source.path)).toEqual(expected)
      expect(sources.map((source) => source.scope)).toEqual([
        "global",
        "global",
        "global",
        "project",
        "project",
        "project",
        "project",
      ])
      expect(sources.map((source) => source.precedence)).toEqual([0, 1, 2, 3, 4, 5, 6])
    }),
  )

  test(
    "round trips canonical URL-safe entry IDs and rejects damaged IDs",
    Effect.sync(() => {
      const input = {
        scope: "project" as const,
        source: "C:\\workspace with spaces\\opencode.jsonc",
        name: "shared_server",
      }
      const entryID = MCPConfigSource.encodeEntryID(input)

      expect(entryID).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(MCPConfigSource.decodeEntryID(entryID)).toEqual(input)
      expect(MCPConfigSource.decodeEntryID(`${entryID}!`)).toBeUndefined()
      expect(MCPConfigSource.decodeEntryID("bm90LWpzb24")).toBeUndefined()
    }),
  )
})

function context(worktree: string): InstanceContext {
  return { directory: worktree, worktree, project: {} as never }
}

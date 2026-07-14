import { describe, expect } from "bun:test"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Effect } from "effect"
import path from "node:path"
import { PluginConfigSource } from "@/plugin/config-source"
import type { InstanceContext } from "@/project/instance-context"
import { testEffect } from "../lib/effect"

const { effect: test } = testEffect(FSUtil.defaultLayer)

describe("PluginConfigSource", () => {
  test(
    "discovers existing global and local sources in runtime precedence order",
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

      const sources = yield* PluginConfigSource.discover({ fs, globalConfigDir, ctx })

      expect(sources.map((source) => source.path)).toEqual(expected)
      expect(sources.map((source) => source.scope)).toEqual([
        "global",
        "global",
        "global",
        "local",
        "local",
        "local",
        "local",
      ])
      expect(PluginConfigSource.target({ sources, scope: "global", globalConfigDir, ctx })).toBe(expected[2])
      expect(PluginConfigSource.target({ sources, scope: "local", globalConfigDir, ctx })).toBe(expected.at(-1)!)
    }),
  )
})

function context(worktree: string): InstanceContext {
  return { directory: worktree, worktree, project: {} as never }
}

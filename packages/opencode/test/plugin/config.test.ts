import { describe, expect } from "bun:test"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { EffectFlock } from "@opencode-ai/core/util/effect-flock"
import { Effect, Layer } from "effect"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { PluginConfig } from "@/plugin/config"
import type { PluginCatalog } from "@/plugin/catalog"
import { requireInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const layer = Layer.merge(FSUtil.defaultLayer, EffectFlock.defaultLayer.pipe(Layer.provide(FSUtil.defaultLayer)))
const { instance: test } = testEffect(layer)

describe("PluginConfig", () => {
  test(
    "lists effective config and persists install, enablement, and removal",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const flock = yield* EffectFlock.Service
      const ctx = yield* requireInstance
      const globalConfigDir = path.join(ctx.worktree, ".global")
      const manager = PluginConfig.make({ fs, flock, globalConfigDir, builtins: BUILTINS })
      const local = path.join(ctx.worktree, ".opencode", "opencode.jsonc")
      yield* fs.writeWithDirs(
        path.join(globalConfigDir, "opencode.json"),
        JSON.stringify({ plugin: ["demo@1.0.0"], plugin_enabled: { "npm:demo": false } }),
      )
      yield* fs.writeWithDirs(
        local,
        `{
  // keep this comment
  "plugin": ["demo@2.0.0"],
  "plugin_enabled": { "builtin:pdf": false, "npm:demo": true }
}`,
      )

      const before = yield* manager.list(ctx)
      expect(before.find((item) => item.key === "builtin:pdf")?.enabled).toBe(false)
      expect(before.find((item) => item.key === "npm:demo")).toMatchObject({ spec: "demo@2.0.0", enabled: true })

      const plugin = yield* createPlugin(fs, ctx.worktree, "local-plugin")
      const installed = yield* manager.install(ctx, { scope: "local", spec: pathToFileURL(plugin).href })
      const key = installed.find((item) => item.spec === pathToFileURL(plugin).href)!.key
      yield* manager.setEnabled(ctx, key, false)
      expect((yield* manager.list(ctx)).find((item) => item.key === key)?.enabled).toBe(false)

      yield* manager.remove(ctx, key)
      expect((yield* manager.list(ctx)).some((item) => item.key === key)).toBe(false)
      expect(yield* fs.readFileString(local)).toContain("// keep this comment")
      expect((yield* manager.remove(ctx, "builtin:pdf").pipe(Effect.flip))._tag).toBe(
        "PluginConfigBuiltinRemovalError",
      )
    }),
    { git: true },
  )

  test(
    "rejects duplicate installs, unknown keys, and system plugin disablement",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const flock = yield* EffectFlock.Service
      const ctx = yield* requireInstance
      const manager = PluginConfig.make({ fs, flock, globalConfigDir: path.join(ctx.worktree, ".global"), builtins: BUILTINS })
      yield* fs.writeWithDirs(path.join(ctx.worktree, "opencode.json"), JSON.stringify({ plugin: ["demo@1.0.0"] }))

      expect(
        (yield* manager.install(ctx, { scope: "local", spec: "demo@2.0.0" }).pipe(Effect.flip))._tag,
      ).toBe("PluginConfigConflictError")
      expect((yield* manager.setEnabled(ctx, "npm:missing", false).pipe(Effect.flip))._tag).toBe(
        "PluginConfigNotFoundError",
      )
      expect((yield* manager.setEnabled(ctx, "builtin:system", false).pipe(Effect.flip))._tag).toBe(
        "PluginConfigImmutableError",
      )
    }),
    { git: true },
  )
})

const BUILTINS: readonly PluginCatalog.Builtin[] = [
  {
    key: "builtin:pdf",
    manifest: { id: "pdf", name: "PDF" },
    server: async () => ({}),
    system: false,
    canDisable: true,
  },
  {
    key: "builtin:system",
    manifest: { id: "system", name: "System" },
    server: async () => ({}),
    system: true,
    canDisable: false,
  },
]

function createPlugin(fs: FSUtil.Interface, root: string, name: string) {
  return Effect.gen(function* () {
    const dir = path.join(root, name)
    yield* fs.writeWithDirs(
      path.join(dir, "package.json"),
      JSON.stringify({ name, version: "1.0.0", type: "module", exports: { "./server": "./server.js" } }),
    )
    yield* fs.writeFileString(path.join(dir, "server.js"), "export default async () => ({})\n")
    return dir
  })
}

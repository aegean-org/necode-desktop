import { describe, expect } from "bun:test"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { EffectFlock } from "@opencode-ai/core/util/effect-flock"
import { Effect, Layer } from "effect"
import { parse } from "jsonc-parser"
import path from "node:path"
import { PluginConfigFile } from "@/plugin/config-file"
import { testEffect } from "../lib/effect"

const layer = Layer.merge(FSUtil.defaultLayer, EffectFlock.defaultLayer.pipe(Layer.provide(FSUtil.defaultLayer)))
const { effect: test } = testEffect(layer)

describe("PluginConfigFile", () => {
  test(
    "preserves JSONC while updating plugin specs and prototype-sensitive enabled keys",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const flock = yield* EffectFlock.Service
      const root = yield* fs.makeTempDirectoryScoped()
      const source = path.join(root, "opencode.jsonc")
      yield* fs.writeFileString(
        source,
        `{
  // keep this comment
  "theme": "necode",
  "plugin": [["demo@1.0.0", { "label": "demo" }]],
  "plugin_enabled": {
    "__proto__": false,
    "toString": true
  }
}`,
      )

      const before = yield* PluginConfigFile.read({ fs, path: source })
      expect(before.plugin).toEqual([["demo@1.0.0", { label: "demo" }]])
      expect(Object.hasOwn(before.plugin_enabled, "__proto__")).toBe(true)
      expect(Object.hasOwn(before.plugin_enabled, "toString")).toBe(true)

      yield* PluginConfigFile.install({ fs, flock, path: source, spec: "second@2.0.0" })
      yield* PluginConfigFile.setEnabled({ fs, flock, path: source, key: "constructor", enabled: false })
      yield* PluginConfigFile.remove({ fs, flock, path: source, key: "npm:demo" })

      const text = yield* fs.readFileString(source)
      const data = parse(text)
      expect(text).toContain("// keep this comment")
      expect(data.theme).toBe("necode")
      expect(data.plugin).toEqual(["second@2.0.0"])
      expect(Object.hasOwn((yield* PluginConfigFile.read({ fs, path: source })).plugin_enabled, "constructor")).toBe(true)
    }),
  )

  test(
    "fails explicitly for damaged JSONC and missing plugin removals",
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const flock = yield* EffectFlock.Service
      const root = yield* fs.makeTempDirectoryScoped()
      const source = path.join(root, "opencode.jsonc")
      yield* fs.writeFileString(source, `{ "plugin": [`)
      expect((yield* PluginConfigFile.read({ fs, path: source }).pipe(Effect.flip))._tag).toBe(
        "PluginConfigFile.ParseError",
      )

      yield* fs.writeFileString(source, `{ "plugin": [] }`)
      expect(
        (yield* PluginConfigFile.remove({ fs, flock, path: source, key: "npm:missing" }).pipe(Effect.flip))._tag,
      ).toBe("PluginConfigFile.NotFoundError")
    }),
  )
})

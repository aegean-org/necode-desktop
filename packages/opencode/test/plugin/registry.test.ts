import { expect } from "bun:test"
import path from "path"
import { pathToFileURL } from "url"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { EffectFlock } from "@opencode-ai/core/util/effect-flock"
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { ConfigPlugin } from "@/config/plugin"
import { Config } from "@/config/config"
import { Env } from "@/env"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Plugin } from "@/plugin"
import { AccountTest } from "../fake/account"
import { AuthTest } from "../fake/auth"
import { NpmTest } from "../fake/npm"
import { TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const configLayer = Config.layer.pipe(
  Layer.provide(EffectFlock.defaultLayer),
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Env.defaultLayer),
  Layer.provide(AuthTest.empty),
  Layer.provide(AccountTest.empty),
  Layer.provide(NpmTest.noop),
  Layer.provide(FetchHttpClient.layer),
)
const it = testEffect(
  Layer.mergeAll(
    Plugin.layer.pipe(
      Layer.provide(EventV2Bridge.defaultLayer),
      Layer.provide(configLayer),
      Layer.provide(RuntimeFlags.layer({ disableDefaultPlugins: true })),
    ),
    CrossSpawnSpawner.defaultLayer,
  ),
)

function project(input: { server: string; enabled?: boolean }) {
  return Effect.gen(function* () {
    const test = yield* TestInstance
    const root = path.join(test.directory, "demo-plugin")
    const spec = pathToFileURL(root).href
    yield* Effect.promise(async () => {
      await Bun.write(path.join(root, "server.js"), input.server)
      await Bun.write(path.join(root, "skills", "demo", "SKILL.md"), "---\nname: demo-skill\ndescription: Demo\n---\nBody")
      await Bun.write(
        path.join(root, "package.json"),
        JSON.stringify({
          name: "demo-plugin",
          version: "1.2.3",
          exports: { "./server": "./server.js" },
          necode: { plugin: { id: "demo", name: "Demo Plugin", skills: ["./skills"] } },
        }),
      )
      await Bun.write(
        path.join(test.directory, "opencode.json"),
        JSON.stringify({
          plugin: [spec],
          ...(input.enabled === false ? { plugin_enabled: { [ConfigPlugin.key(spec)]: false } } : {}),
        }),
      )
    })
    return { root, key: ConfigPlugin.key(spec) }
  })
}

it.instance("lists active plugin metadata, tools, and skills", () =>
  Effect.gen(function* () {
    const setup = yield* project({ server: "export default async () => ({ tool: { demo: { description: 'Demo', args: {}, execute: async () => 'ok' } } })" })
    const entry = (yield* (yield* Plugin.Service).entries()).find((item) => item.key === setup.key)!

    expect(entry).toMatchObject({ id: "demo", name: "Demo Plugin", version: "1.2.3", status: "active" })
    expect(entry.tools).toEqual(["demo"])
    expect(entry.skills).toEqual([path.join(setup.root, "skills")])
  }),
)

it.instance("records initialization failures", () =>
  Effect.gen(function* () {
    const setup = yield* project({ server: "export default async () => { throw new Error('init failed') }" })
    const entry = (yield* (yield* Plugin.Service).entries()).find((item) => item.key === setup.key)!

    expect(entry.status).toBe("failed")
    expect(entry.error).toEqual({ stage: "initialize", message: "init failed" })
  }),
)

it.instance("does not initialize disabled plugins", () =>
  Effect.gen(function* () {
    const setup = yield* project({ server: "throw new Error('module loaded')", enabled: false })
    const entry = (yield* (yield* Plugin.Service).entries()).find((item) => item.key === setup.key)!

    expect(entry.status).toBe("disabled")
    expect(entry.tools).toEqual([])
  }),
)

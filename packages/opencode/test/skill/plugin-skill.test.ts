import { expect } from "bun:test"
import path from "path"
import { pathToFileURL } from "url"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Global } from "@opencode-ai/core/global"
import { EffectFlock } from "@opencode-ai/core/util/effect-flock"
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { ConfigPlugin } from "@/config/plugin"
import { Config } from "@/config/config"
import { Env } from "@/env"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Plugin } from "@/plugin"
import { Skill } from "@/skill"
import { Discovery } from "@/skill/discovery"
import { AccountTest } from "../fake/account"
import { AuthTest } from "../fake/auth"
import { NpmTest } from "../fake/npm"
import { TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const flags = RuntimeFlags.layer({ disableDefaultPlugins: true })
const config = Config.layer.pipe(
  Layer.provide(EffectFlock.defaultLayer),
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Env.defaultLayer),
  Layer.provide(AuthTest.empty),
  Layer.provide(AccountTest.empty),
  Layer.provide(NpmTest.noop),
  Layer.provide(FetchHttpClient.layer),
)
const events = EventV2Bridge.defaultLayer
const plugins = Plugin.layer.pipe(Layer.provide(events), Layer.provide(config), Layer.provide(flags))
const skills = Skill.layer.pipe(
  Layer.provide(Discovery.defaultLayer),
  Layer.provide(config),
  Layer.provide(events),
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Global.layer),
  Layer.provide(flags),
  Layer.provide(plugins),
)
const it = testEffect(Layer.mergeAll(skills, plugins, CrossSpawnSpawner.defaultLayer))

function setup(enabled: boolean) {
  return Effect.gen(function* () {
    const test = yield* TestInstance
    const root = path.join(test.directory, "skill-plugin")
    const spec = pathToFileURL(root).href
    yield* Effect.promise(async () => {
      await Bun.write(path.join(root, "server.js"), "export default async () => ({})")
      await Bun.write(
        path.join(root, "skills", "demo", "SKILL.md"),
        "---\nname: plugin-demo\ndescription: Plugin skill\n---\nPlugin body",
      )
      await Bun.write(
        path.join(root, "package.json"),
        JSON.stringify({
          name: "skill-plugin",
          exports: { "./server": "./server.js" },
          necode: { plugin: { id: "skill-plugin", name: "Skill Plugin", skills: ["./skills"] } },
        }),
      )
      await Bun.write(
        path.join(test.directory, "opencode.json"),
        JSON.stringify({ plugin: [spec], plugin_enabled: { [ConfigPlugin.key(spec)]: enabled } }),
      )
    })
  })
}

it.instance("discovers skills from active plugins", () =>
  Effect.gen(function* () {
    yield* setup(true)
    expect((yield* (yield* Skill.Service).all()).find((item) => item.name === "plugin-demo")).toMatchObject({
      source: "plugin",
      scope: "plugin",
      canUninstall: false,
    })
  }),
)

it.instance("does not discover skills from disabled plugins", () =>
  Effect.gen(function* () {
    yield* setup(false)
    expect((yield* (yield* Skill.Service).all()).map((item) => item.name)).not.toContain("plugin-demo")
  }),
)

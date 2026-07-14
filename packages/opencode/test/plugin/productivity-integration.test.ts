import { expect } from "bun:test"
import path from "node:path"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect } from "effect"
import { Config } from "@/config/config"
import { InstanceState } from "@/effect/instance-state"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { Plugin } from "@/plugin"
import type { PluginRegistry } from "@/plugin/registry"
import { Skill } from "@/skill"
import { ToolRegistry } from "@/tool/registry"
import { TestConfig } from "../fixture/config"
import { TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const config = TestConfig.layer({
  get: () => InstanceState.directory.pipe(Effect.flatMap((directory) => Effect.promise(() => readConfig(directory)))),
  directories: () => InstanceState.directory.pipe(Effect.map((directory) => [path.join(directory, ".opencode")])),
})
const root = LayerNode.group([Plugin.node, Skill.node, ToolRegistry.node])
const it = testEffect(
  LayerNode.buildLayer(root, {
    replacements: [LayerNode.replace(Config.node, config), LayerNode.replace(RuntimeFlags.node, RuntimeFlags.layer())],
  }),
)

it.instance("exposes productivity entries, tools, and skills by default", () =>
  Effect.gen(function* () {
    const entries = yield* (yield* Plugin.Service).entries()
    const ids = yield* (yield* ToolRegistry.Service).ids()
    const skills = (yield* (yield* Skill.Service).all()).map((item) => item.name)

    expect(productivityEntries(entries).every((entry) => entry.status === "active")).toBe(true)
    expect(ids).toEqual(
      expect.arrayContaining(["document_create", "pdf_create", "spreadsheet_create", "presentation_create"]),
    )
    expect(skills).toEqual(expect.arrayContaining(["documents", "pdf", "spreadsheets", "presentations"]))
  }),
)

it.instance("removes a disabled productivity plugin from tools and skill discovery", () =>
  Effect.gen(function* () {
    const test = yield* TestInstance
    yield* Effect.promise(() =>
      Bun.write(
        path.join(test.directory, "opencode.json"),
        JSON.stringify({ plugin_enabled: { "builtin:documents": false } }),
      ),
    )
    const entries = yield* (yield* Plugin.Service).entries()
    const ids = yield* (yield* ToolRegistry.Service).ids()
    const skills = (yield* (yield* Skill.Service).all()).map((item) => item.name)

    expect(entries.find((entry) => entry.key === "builtin:documents")?.status).toBe("disabled")
    expect(ids).not.toContain("document_create")
    expect(skills).not.toContain("documents")
  }),
)

function productivityEntries(entries: readonly PluginRegistry.Entry[]) {
  return entries.filter((entry) => ["documents", "pdf", "spreadsheets", "presentations"].includes(entry.id))
}

async function readConfig(directory: string) {
  const file = Bun.file(path.join(directory, "opencode.json"))
  if (!(await file.exists())) return {}
  return file.json()
}

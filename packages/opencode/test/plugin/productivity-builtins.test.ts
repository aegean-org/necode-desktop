import { expect, test } from "bun:test"
import { Effect } from "effect"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { BuiltinPlugins } from "@/plugin/builtin"
import { PluginCatalog } from "@/plugin/catalog"
import { PluginRegistry } from "@/plugin/registry"

const EXPECTED_KEYS = ["builtin:documents", "builtin:pdf", "builtin:presentations", "builtin:spreadsheets"] as const

test("registers default productivity plugins with tools and skills", async () => {
  const flags = await Effect.runPromise(RuntimeFlags.Service.pipe(Effect.provide(RuntimeFlags.layer())))
  const definitions = BuiltinPlugins.list(flags).filter((item) => EXPECTED_KEYS.includes(item.key as never))
  expect(definitions.map((item) => item.key).toSorted()).toEqual([...EXPECTED_KEYS])

  for (const definition of definitions) {
    expect(definition).toMatchObject({ system: false, canDisable: true })
    const catalog = await PluginCatalog.resolveBuiltin(definition, true)
    const hooks = await definition.server(undefined as never)
    const entry = PluginRegistry.active(catalog, [hooks])
    expect(entry).toMatchObject({ enabled: true, status: "active", canDisable: true, canUninstall: false })
    expect(entry.tools.length).toBeGreaterThan(0)
    expect(entry.skills).toHaveLength(1)
  }
})

test("does not initialize a disabled productivity plugin", async () => {
  const flags = await Effect.runPromise(RuntimeFlags.Service.pipe(Effect.provide(RuntimeFlags.layer())))
  const definition = BuiltinPlugins.list(flags).find((item) => item.key === "builtin:pdf")
  if (!definition) throw new Error("PDF built-in is not registered")
  const entry = PluginRegistry.disabled(await PluginCatalog.resolveBuiltin(definition, false))
  expect(entry).toMatchObject({ status: "disabled", enabled: false, tools: [] })
})

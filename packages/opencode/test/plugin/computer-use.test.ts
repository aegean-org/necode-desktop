import { expect, test } from "bun:test"
import type { Config } from "@opencode-ai/plugin"
import { Effect } from "effect"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { BuiltinPlugins } from "@/plugin/builtin"
import { createComputerUsePlugin } from "@/plugin/computer-use"

test("injects the detected Cua Driver as a local MCP server", async () => {
  const plugin = createComputerUsePlugin(async () => ({
    status: "ready",
    platform: "win32",
    path: "C:\\Cua\\cua-driver.exe",
    version: "0.8.1",
  }))
  const hooks = await plugin({} as Parameters<typeof plugin>[0])
  const config: Config = {}

  await hooks.config?.(config)

  expect(config.mcp?.["cua-driver"]).toEqual({
    type: "local",
    command: ["C:\\Cua\\cua-driver.exe", "mcp"],
    enabled: true,
    timeout: 30_000,
  })
})

test("keeps a user-defined cua-driver MCP without running discovery", async () => {
  let detected = false
  const plugin = createComputerUsePlugin(async () => {
    detected = true
    return { status: "not_installed", platform: "win32" }
  })
  const hooks = await plugin({} as Parameters<typeof plugin>[0])
  const config: Config = {
    mcp: {
      "cua-driver": {
        type: "local",
        command: ["custom-cua", "mcp"],
        timeout: 1_000,
      },
    },
  }

  await hooks.config?.(config)

  expect(detected).toBe(false)
  expect(config.mcp?.["cua-driver"]).toEqual({
    type: "local",
    command: ["custom-cua", "mcp"],
    timeout: 1_000,
  })
})

test("surfaces the real recovery instruction when the driver is unavailable", async () => {
  const plugin = createComputerUsePlugin(async () => ({ status: "needs_permissions", platform: "darwin" }))
  const hooks = await plugin({} as Parameters<typeof plugin>[0])

  expect(hooks.config?.({})).rejects.toThrow("cua-driver permissions grant")
})

test("registers Computer Use as a user-manageable built-in without skills", async () => {
  const flags = await Effect.runPromise(RuntimeFlags.Service.pipe(Effect.provide(RuntimeFlags.layer())))
  const definition = BuiltinPlugins.list(flags).find((item) => item.key === "builtin:computer-use")

  expect(definition).toMatchObject({
    system: false,
    canDisable: true,
    defaultEnabled: false,
    manifest: {
      id: "computer-use",
      name: "Computer Use",
    },
  })
  expect(definition?.manifest.skills).toBeUndefined()
})

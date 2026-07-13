import { describe, expect, test } from "bun:test"
import type { PluginEntry } from "@opencode-ai/sdk/v2/client"
import { pluginSections, pluginStatusLabel } from "./plugin-model"

describe("plugin settings model", () => {
  test("filters and groups built-in, installed, and system plugins", () => {
    const entries = [
      entry({ key: "builtin:pdf", id: "pdf", name: "PDF", source: "builtin", system: false }),
      entry({ key: "npm:@scope/demo", id: "demo", name: "Demo Tools", source: "npm", system: false }),
      entry({ key: "builtin:necode", id: "necode", name: "NeCode", source: "builtin", system: true, canDisable: false }),
    ]

    expect(pluginSections(entries, "pdf").builtin.map((item) => item.key)).toEqual(["builtin:pdf"])
    expect(pluginSections(entries, "demo").installed.map((item) => item.key)).toEqual(["npm:@scope/demo"])
    expect(pluginSections(entries, "").system.every((item) => !item.canDisable)).toBe(true)
  })

  test("matches metadata and maps every runtime status to a label", () => {
    const entries = [
      entry({ key: "npm:demo", id: "demo", name: "Example", description: "PDF conversion", tools: ["convert_pdf"] }),
    ]
    expect(pluginSections(entries, "convert_pdf").installed).toHaveLength(1)
    expect(pluginSections(entries, "conversion").installed).toHaveLength(1)
    expect(pluginStatusLabel("active")).toBe("settings.plugins.status.active")
    expect(pluginStatusLabel("disabled")).toBe("settings.plugins.status.disabled")
    expect(pluginStatusLabel("failed")).toBe("settings.plugins.status.failed")
    expect(pluginStatusLabel("incompatible")).toBe("settings.plugins.status.incompatible")
  })
})

function entry(input: Partial<PluginEntry> & Pick<PluginEntry, "key" | "id" | "name">): PluginEntry {
  return {
    spec: input.key,
    source: "npm",
    scope: "local",
    enabled: true,
    status: "active",
    system: false,
    canDisable: true,
    canUninstall: true,
    capabilities: [],
    tools: [],
    skills: [],
    ...input,
  }
}

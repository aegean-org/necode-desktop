import type { PluginEntry } from "@opencode-ai/sdk/v2/client"

const STATUS_LABEL = {
  active: "settings.plugins.status.active",
  disabled: "settings.plugins.status.disabled",
  failed: "settings.plugins.status.failed",
  incompatible: "settings.plugins.status.incompatible",
} as const satisfies Record<PluginEntry["status"], string>

/** Groups filtered plugin entries into product, external, and system sections. */
export function pluginSections(entries: readonly PluginEntry[], raw: string) {
  const query = raw.trim().toLocaleLowerCase()
  const visible = entries.filter((entry) => matchesPlugin(entry, query)).toSorted(comparePlugin)
  return {
    builtin: visible.filter((entry) => entry.source === "builtin" && !entry.system),
    installed: visible.filter((entry) => entry.source !== "builtin" && !entry.system),
    system: visible.filter((entry) => entry.system),
  }
}

/** Returns the translation key for a plugin runtime status. */
export function pluginStatusLabel(status: PluginEntry["status"]) {
  return STATUS_LABEL[status]
}

function matchesPlugin(entry: PluginEntry, query: string) {
  if (!query) return true
  return [entry.key, entry.id, entry.name, entry.description, entry.spec, ...entry.tools, ...entry.skills]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLocaleLowerCase().includes(query))
}

function comparePlugin(a: PluginEntry, b: PluginEntry) {
  return a.name.localeCompare(b.name)
}

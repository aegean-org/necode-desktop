import { FSUtil } from "@opencode-ai/core/fs-util"
import type { EffectFlock } from "@opencode-ai/core/util/effect-flock"
import { Effect } from "effect"
import { PluginConfigFile } from "@/plugin/config-file"

/** Failures surfaced while removing migrated fields from legacy TUI configuration. */
export type ClearLegacyPluginEnabledError =
  | PluginConfigFile.NotFoundError
  | PluginConfigFile.ParseError
  | PluginConfigFile.ReadError
  | PluginConfigFile.WriteError

/** Merges persisted and legacy TUI enablement while translating known runtime IDs to stable plugin keys. */
export function mergePluginEnabled(input: {
  configured: Readonly<Record<string, boolean>>
  legacy: Readonly<Record<string, boolean>>
  keys: ReadonlyMap<string, string>
}) {
  const result = Object.create(null) as Record<string, boolean>
  Object.entries(input.configured).forEach(([key, enabled]) => (result[key] = enabled))
  Object.entries(input.legacy).forEach(([id, enabled]) => (result[input.keys.get(id) ?? id] = enabled))
  return result
}

/** Removes migrated enablement fields from legacy TUI JSONC sources. */
export const clearLegacyPluginEnabledSources = Effect.fn("TuiPluginEnabled.clearLegacy")(function* (input: {
  fs: FSUtil.Interface
  flock: EffectFlock.Interface
  sources: readonly string[]
}) {
  yield* Effect.forEach(
    input.sources,
    (source) => PluginConfigFile.clearLegacyEnabled({ ...input, path: source }),
    { discard: true },
  )
})

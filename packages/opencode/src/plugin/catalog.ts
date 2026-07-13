import type { PluginFailureStage } from "@opencode-ai/plugin"
import { ConfigPlugin } from "@/config/plugin"
import { PluginLoader } from "./loader"
import { pluginSource, readPluginManifest, type ResolvedPluginManifest } from "./shared"

export namespace PluginCatalog {
  export type Failure = {
    stage: PluginFailureStage
    message: string
  }

  export type Entry = {
    key: string
    spec: string
    source: "builtin" | "npm" | "file"
    scope: "builtin" | ConfigPlugin.Scope
    enabled: boolean
    system: boolean
    canDisable: boolean
    canUninstall: boolean
    manifest?: ResolvedPluginManifest
    resolved?: PluginLoader.Resolved
    failure?: Failure
  }

  /** Resolve an external plugin without importing or initializing its server module. */
  export async function resolveExternal(input: { origin: ConfigPlugin.Origin; enabled: boolean }): Promise<Entry> {
    const spec = ConfigPlugin.pluginSpecifier(input.origin.spec)
    const base = externalEntry(input.origin, input.enabled)
    const result = await PluginLoader.resolve(PluginLoader.plan(input.origin.spec), "server")
    if (!result.ok) {
      if (result.stage === "missing") return { ...base, failure: { stage: "entry", message: result.value.message } }
      return { ...base, failure: { stage: result.stage, message: errorMessage(result.error) } }
    }

    try {
      const manifest = result.value.pkg ? await readPluginManifest(spec, result.value.pkg) : undefined
      return { ...base, resolved: result.value, manifest }
    } catch (error) {
      return { ...base, resolved: result.value, failure: { stage: "manifest", message: errorMessage(error) } }
    }
  }

  function externalEntry(origin: ConfigPlugin.Origin, enabled: boolean): Entry {
    const spec = ConfigPlugin.pluginSpecifier(origin.spec)
    return {
      key: ConfigPlugin.key(origin.spec),
      spec,
      source: pluginSource(spec),
      scope: origin.scope,
      enabled,
      system: false,
      canDisable: true,
      canUninstall: true,
    }
  }

  function errorMessage(error: unknown) {
    if (error instanceof Error) return error.message
    return String(error)
  }
}

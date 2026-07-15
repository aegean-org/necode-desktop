import type { Plugin, PluginFailureStage, PluginManifest } from "@opencode-ai/plugin"
import { ConfigPlugin } from "@/config/plugin"
import { PluginLoader } from "./loader"
import { pluginSource, readPluginManifest, type ResolvedPluginManifest } from "./shared"
import path from "path"
import { Filesystem } from "@/util/filesystem"

export namespace PluginCatalog {
  /** Failure found while resolving a plugin without executing its entrypoint. */
  export type Failure = {
    stage: PluginFailureStage
    message: string
  }

  /** Stable catalog record shared by plugin management and runtime loading. */
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

  /** System-provided plugin definition registered directly by NeCode. */
  export type Builtin = {
    key: `builtin:${string}`
    root?: string
    manifest: PluginManifest
    server: Plugin
    system: boolean
    canDisable: boolean
    defaultEnabled?: boolean
  }

  /** Resolve a built-in plugin definition and its package-relative skill paths. */
  export async function resolveBuiltin(definition: Builtin, enabled: boolean): Promise<Entry> {
    const base: Entry = {
      key: definition.key,
      spec: definition.key,
      source: "builtin",
      scope: "builtin",
      enabled,
      system: definition.system,
      canDisable: definition.canDisable,
      canUninstall: false,
      manifest: { ...definition.manifest, skills: [] },
    }
    try {
      const skills = await Promise.all((definition.manifest.skills ?? []).map((item) => builtinPath(definition, item)))
      return { ...base, manifest: { ...definition.manifest, skills } }
    } catch (error) {
      return { ...base, failure: { stage: "manifest", message: errorMessage(error) } }
    }
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

  async function builtinPath(definition: Builtin, value: string) {
    if (!definition.root) throw new TypeError(`Plugin ${definition.key} has no package root for skill path ${value}`)
    if (path.isAbsolute(value) || value.startsWith("file://")) {
      throw new TypeError(`Plugin ${definition.key} skill path must be relative: ${value}`)
    }
    const target = Filesystem.resolve(path.join(definition.root, value))
    if (!Filesystem.contains(definition.root, target)) {
      throw new TypeError(`Plugin ${definition.key} skill path resolves outside plugin directory: ${value}`)
    }
    if (!(await Filesystem.exists(target))) throw new TypeError(`Plugin ${definition.key} skill path does not exist: ${value}`)
    return target
  }
}

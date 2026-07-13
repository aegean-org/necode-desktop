import { Schema } from "effect"
import type { Hooks, PluginCapability, PluginFailureStage } from "@opencode-ai/plugin"
import type { PluginCatalog } from "./catalog"

export namespace PluginRegistry {
  export const Status = Schema.Literals(["active", "disabled", "failed", "incompatible"])
  export type Status = typeof Status.Type

  export const Failure = Schema.Struct({ stage: Schema.String, message: Schema.String })
  export type Failure = { stage: PluginFailureStage; message: string }

  /** Public runtime status returned by the plugin management API. */
  export const Entry = Schema.Struct({
    key: Schema.String,
    id: Schema.String,
    name: Schema.String,
    description: Schema.optional(Schema.String),
    version: Schema.optional(Schema.String),
    spec: Schema.String,
    target: Schema.optional(Schema.String),
    source: Schema.Literals(["builtin", "npm", "file"]),
    scope: Schema.Literals(["builtin", "global", "local"]),
    enabled: Schema.Boolean,
    status: Status,
    system: Schema.Boolean,
    canDisable: Schema.Boolean,
    canUninstall: Schema.Boolean,
    capabilities: Schema.Array(Schema.String),
    tools: Schema.Array(Schema.String),
    skills: Schema.Array(Schema.String),
    error: Schema.optional(Failure),
  }).annotate({ identifier: "PluginEntry" })
  export type Entry = typeof Entry.Type

  /** Creates the runtime representation for an explicitly disabled plugin. */
  export function disabled(entry: PluginCatalog.Entry): Entry {
    return create(entry, "disabled", [])
  }

  /** Creates the runtime representation for a plugin that could not become active. */
  export function failed(entry: PluginCatalog.Entry, failure = entry.failure): Entry {
    const status = failure?.stage === "compatibility" ? "incompatible" : "failed"
    return create(entry, status, [], failure)
  }

  /** Creates the runtime representation for initialized plugin hooks. */
  export function active(entry: PluginCatalog.Entry, hooks: readonly Hooks[]): Entry {
    return create(entry, "active", hooks)
  }

  function create(
    entry: PluginCatalog.Entry,
    status: Status,
    hooks: readonly Hooks[],
    failure?: PluginCatalog.Failure,
  ): Entry {
    const tools = hooks.flatMap((hook) => Object.keys(hook.tool ?? {})).toSorted()
    const skills = entry.manifest?.skills ?? []
    return {
      key: entry.key,
      id: entry.manifest?.id ?? packageString(entry, "name") ?? entry.key,
      name: entry.manifest?.name ?? packageString(entry, "name") ?? entry.spec,
      description: entry.manifest?.description,
      version: packageString(entry, "version"),
      spec: entry.spec,
      target: entry.resolved?.target,
      source: entry.source,
      scope: entry.scope,
      enabled: entry.enabled,
      status,
      system: entry.system,
      canDisable: entry.canDisable,
      canUninstall: entry.canUninstall,
      capabilities: capabilities(entry, hooks, tools),
      tools,
      skills,
      error: failure,
    }
  }

  function capabilities(entry: PluginCatalog.Entry, hooks: readonly Hooks[], tools: readonly string[]) {
    const values = new Set<PluginCapability>()
    if (tools.length) values.add("tools")
    if (entry.manifest?.skills.length) values.add("skills")
    if (hooks.some((hook) => hook.auth)) values.add("auth")
    if (hooks.some((hook) => hook.provider)) values.add("provider")
    if (hasTui(entry)) values.add("tui")
    return Array.from(values).toSorted()
  }

  function packageString(entry: PluginCatalog.Entry, key: "name" | "version") {
    const value = entry.resolved?.pkg?.json[key]
    return typeof value === "string" ? value : undefined
  }

  function hasTui(entry: PluginCatalog.Entry) {
    const exports = entry.resolved?.pkg?.json.exports
    return !!exports && typeof exports === "object" && "./tui" in exports
  }
}

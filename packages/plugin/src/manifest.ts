import { Schema } from "effect"

/** Capabilities a plugin can contribute to a NeCode runtime. */
export const PluginCapability = Schema.Literals(["tools", "skills", "provider", "auth", "tui"])
export type PluginCapability = typeof PluginCapability.Type

/** Stable stage names used when a plugin cannot become active. */
export const PluginFailureStage = Schema.Literals([
  "install",
  "manifest",
  "compatibility",
  "entry",
  "load",
  "initialize",
])
export type PluginFailureStage = typeof PluginFailureStage.Type

/** Optional package metadata displayed by NeCode plugin management surfaces. */
export const PluginManifest = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  description: Schema.optional(Schema.String),
  icon: Schema.optional(Schema.NonEmptyString),
  skills: Schema.optional(Schema.Array(Schema.NonEmptyString)),
})
export type PluginManifest = typeof PluginManifest.Type

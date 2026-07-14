export * as PluginConfig from "./config"

import { FSUtil } from "@opencode-ai/core/fs-util"
import type { EffectFlock } from "@opencode-ai/core/util/effect-flock"
import { Effect, Schema } from "effect"
import type { InstanceContext } from "@/project/instance-context"
import { ConfigPlugin } from "@/config/plugin"
import { PluginCatalog } from "./catalog"
import { PluginConfigFile } from "./config-file"
import { PluginConfigSource, PersistenceError } from "./config-source"
import { pluginSource } from "./shared"

export { PersistenceError } from "./config-source"

/** Writable plugin installation scopes. */
export const Scope = Schema.Literals(["global", "local"])
export type Scope = typeof Scope.Type

/** Manageable plugin installation and enablement record. */
export const Entry = Schema.Struct({
  key: Schema.String,
  spec: Schema.String,
  source: Schema.Literals(["builtin", "npm", "file"]),
  scope: Schema.Literals(["builtin", "global", "local"]),
  enabled: Schema.Boolean,
  system: Schema.Boolean,
  canDisable: Schema.Boolean,
  canUninstall: Schema.Boolean,
}).annotate({ identifier: "PluginConfigEntry" })
export type Entry = typeof Entry.Type

/** Plugin installation request accepted by the management API. */
export const InstallInput = Schema.Struct({ scope: Scope, spec: Schema.String })
export type InstallInput = typeof InstallInput.Type

/** Plugin enablement update accepted by the management API. */
export const UpdateInput = Schema.Struct({ enabled: Schema.Boolean })
export type UpdateInput = typeof UpdateInput.Type

/** Invalid plugin specification or persisted configuration. */
export class InvalidError extends Schema.TaggedErrorClass<InvalidError>()(
  "PluginConfigInvalidError",
  { message: Schema.String, field: Schema.optional(Schema.String) },
  { httpApiStatus: 400 },
) {}

/** Plugin key is absent or no longer resolves to its configured source. */
export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()(
  "PluginConfigNotFoundError",
  { message: Schema.String, pluginKey: Schema.String },
  { httpApiStatus: 404 },
) {}

/** Plugin key is already configured in a higher or equal precedence source. */
export class ConflictError extends Schema.TaggedErrorClass<ConflictError>()(
  "PluginConfigConflictError",
  { message: Schema.String, pluginKey: Schema.String },
  { httpApiStatus: 409 },
) {}

/** Plugin cannot be disabled because it is a required system component. */
export class ImmutableError extends Schema.TaggedErrorClass<ImmutableError>()(
  "PluginConfigImmutableError",
  { message: Schema.String, pluginKey: Schema.String },
  { httpApiStatus: 409 },
) {}

/** Built-in plugins cannot be removed from persistent configuration. */
export class BuiltinRemovalError extends Schema.TaggedErrorClass<BuiltinRemovalError>()(
  "PluginConfigBuiltinRemovalError",
  { message: Schema.String, pluginKey: Schema.String },
  { httpApiStatus: 400 },
) {}

/** Plugin resolution failed before the installation could be persisted. */
export class InstallError extends Schema.TaggedErrorClass<InstallError>()(
  "PluginConfigInstallError",
  { message: Schema.String, stage: Schema.String },
  { httpApiStatus: 400 },
) {}

/** Declared failures surfaced by persistent plugin management operations. */
export type Failure = InvalidError | NotFoundError | ConflictError | ImmutableError | BuiltinRemovalError | InstallError | PersistenceError

/** Failures returned while listing plugin configuration. */
export type ListFailure = InvalidError | PersistenceError
/** Failures returned while installing a plugin. */
export type InstallFailure = ListFailure | ConflictError | InstallError
/** Failures returned while updating plugin enablement. */
export type UpdateFailure = ListFailure | NotFoundError | ImmutableError
/** Failures returned while removing a configured plugin. */
export type RemoveFailure = ListFailure | NotFoundError | BuiltinRemovalError

/** Persistent plugin configuration operations for one filesystem environment. */
export interface Interface {
  readonly list: (ctx: InstanceContext) => Effect.Effect<readonly Entry[], ListFailure>
  readonly install: (ctx: InstanceContext, input: InstallInput) => Effect.Effect<readonly Entry[], InstallFailure>
  readonly setEnabled: (ctx: InstanceContext, key: string, enabled: boolean) => Effect.Effect<readonly Entry[], UpdateFailure>
  readonly remove: (ctx: InstanceContext, key: string) => Effect.Effect<readonly Entry[], RemoveFailure>
}

type Input = {
  fs: FSUtil.Interface
  flock: EffectFlock.Interface
  globalConfigDir: string
  builtins: readonly PluginCatalog.Builtin[]
}

type Loaded = { source: PluginConfigSource.Source; document: PluginConfigFile.Document }
type Managed = { key: string; raw: ConfigPlugin.Origin["spec"]; origin: ConfigPlugin.Origin; source: PluginConfigSource.Source }
type Snapshot = { sources: readonly PluginConfigSource.Source[]; entries: readonly Entry[]; external: readonly Managed[] }

/** Creates a persistent plugin manager backed by the supplied filesystem and built-ins. */
export function make(input: Input): Interface {
  const list = makeList(input)
  return { list, install: makeInstall(input, list), setEnabled: makeSetEnabled(input, list), remove: makeRemove(input, list) }
}

function makeList(input: Input) {
  return Effect.fn("PluginConfig.list")(function* (ctx: InstanceContext) {
    return (yield* snapshot(input, ctx)).entries
  })
}

function makeInstall(input: Input, list: Interface["list"]) {
  return Effect.fn("PluginConfig.install")(function* (ctx: InstanceContext, value: InstallInput) {
    if (!value.spec.trim()) return yield* new InvalidError({ message: "Plugin spec is required", field: "spec" })
    const current = yield* snapshot(input, ctx)
    const target = PluginConfigSource.target({ ...input, ctx, sources: current.sources, scope: value.scope })
    const resolved = yield* Effect.promise(() => ConfigPlugin.resolvePluginSpec(value.spec, target))
    const key = ConfigPlugin.key(resolved)
    if (current.entries.some((entry) => entry.key === key)) {
      return yield* new ConflictError({ message: `Plugin ${key} is already configured`, pluginKey: key })
    }
    const catalog = yield* Effect.promise(() =>
      PluginCatalog.resolveExternal({ origin: { spec: resolved, source: target, scope: value.scope }, enabled: true }),
    )
    if (catalog.failure) return yield* new InstallError({ stage: catalog.failure.stage, message: catalog.failure.message })
    yield* PluginConfigFile.install({ ...input, path: target, spec: value.spec }).pipe(Effect.mapError(mapWriteFailure))
    return yield* list(ctx)
  })
}

function makeSetEnabled(input: Input, list: Interface["list"]) {
  return Effect.fn("PluginConfig.setEnabled")(function* (ctx: InstanceContext, key: string, enabled: boolean) {
    const current = yield* snapshot(input, ctx)
    const entry = current.entries.find((item) => item.key === key)
    if (!entry) return yield* new NotFoundError({ message: `Plugin ${key} was not found`, pluginKey: key })
    if (!entry.canDisable) return yield* new ImmutableError({ message: `Plugin ${key} cannot be disabled`, pluginKey: key })
    const managed = current.external.find((item) => item.key === key)
    const target = managed?.source.path ?? PluginConfigSource.target({ ...input, ctx, sources: current.sources, scope: "local" })
    yield* PluginConfigFile.setEnabled({ ...input, path: target, key, enabled }).pipe(Effect.mapError(mapWriteFailure))
    return yield* list(ctx)
  })
}

function makeRemove(input: Input, list: Interface["list"]) {
  return Effect.fn("PluginConfig.remove")(function* (ctx: InstanceContext, key: string) {
    if (key.startsWith("builtin:")) {
      return yield* new BuiltinRemovalError({ message: `Built-in plugin ${key} cannot be removed`, pluginKey: key })
    }
    const current = yield* snapshot(input, ctx)
    const managed = current.external.find((item) => item.key === key)
    if (!managed) return yield* new NotFoundError({ message: `Plugin ${key} was not found`, pluginKey: key })
    yield* PluginConfigFile.remove({ ...input, path: managed.source.path, key }).pipe(Effect.mapError(mapFileFailure))
    return yield* list(ctx)
  })
}

function snapshot(input: Input, ctx: InstanceContext) {
  return Effect.gen(function* () {
    const sources = yield* PluginConfigSource.discover({ ...input, ctx })
    const documents = yield* Effect.forEach(sources, (source) =>
      PluginConfigFile.read({ fs: input.fs, path: source.path }).pipe(
        Effect.map((document): Loaded => ({ source, document })),
        Effect.mapError(mapReadFailure),
      ),
    )
    const enabled = mergeEnabled(documents)
    const external = yield* managedOrigins(documents)
    return { sources, external, entries: [...builtinEntries(input.builtins, enabled), ...externalEntries(external, enabled)] } satisfies Snapshot
  })
}

function managedOrigins(documents: readonly Loaded[]) {
  return Effect.forEach(
    documents.flatMap((item) => item.document.plugin.map((raw) => ({ raw, source: item.source }))),
    (item) =>
      Effect.promise(async (): Promise<Managed> => {
        const spec = await ConfigPlugin.resolvePluginSpec(item.raw, item.source.path)
        return { key: ConfigPlugin.key(spec), raw: item.raw, origin: { spec, source: item.source.path, scope: item.source.scope }, source: item.source }
      }),
  ).pipe(Effect.map(deduplicate))
}

function deduplicate(items: readonly Managed[]) {
  const seen = new Set<string>()
  return items.toReversed().filter((item) => {
    if (seen.has(item.key)) return false
    seen.add(item.key)
    return true
  }).toReversed()
}

function mergeEnabled(documents: readonly Loaded[]) {
  const result = Object.create(null) as Record<string, boolean>
  documents.forEach((item) => Object.entries(item.document.plugin_enabled).forEach(([key, value]) => (result[key] = value)))
  return result
}

function builtinEntries(builtins: readonly PluginCatalog.Builtin[], enabled: Record<string, boolean>): Entry[] {
  return builtins.map((item) => ({
    key: item.key,
    spec: item.key,
    source: "builtin",
    scope: "builtin",
    enabled: item.canDisable && Object.hasOwn(enabled, item.key) ? enabled[item.key] !== false : true,
    system: item.system,
    canDisable: item.canDisable,
    canUninstall: false,
  }))
}

function externalEntries(items: readonly Managed[], enabled: Record<string, boolean>): Entry[] {
  return items.map((item) => ({
    key: item.key,
    spec: ConfigPlugin.pluginSpecifier(item.origin.spec),
    source: pluginSource(ConfigPlugin.pluginSpecifier(item.origin.spec)),
    scope: item.origin.scope,
    enabled: Object.hasOwn(enabled, item.key) ? enabled[item.key] !== false : true,
    system: false,
    canDisable: true,
    canUninstall: true,
  }))
}

function mapFileFailure(error: PluginConfigFile.ReadError | PluginConfigFile.ParseError | PluginConfigFile.WriteError | PluginConfigFile.NotFoundError) {
  if (error instanceof PluginConfigFile.ParseError) return new InvalidError({ message: error.message })
  if (error instanceof PluginConfigFile.NotFoundError) return new NotFoundError({ message: error.message, pluginKey: error.key })
  return new PersistenceError({ message: error.message, path: error.path, cause: error.cause })
}

function mapReadFailure(error: PluginConfigFile.ReadError | PluginConfigFile.ParseError) {
  if (error instanceof PluginConfigFile.ParseError) return new InvalidError({ message: error.message })
  return new PersistenceError({ message: error.message, path: error.path, cause: error.cause })
}

function mapWriteFailure(error: PluginConfigFile.ReadError | PluginConfigFile.ParseError | PluginConfigFile.WriteError) {
  if (error instanceof PluginConfigFile.ParseError) return new InvalidError({ message: error.message })
  return new PersistenceError({ message: error.message, path: error.path, cause: error.cause })
}

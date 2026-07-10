export * as MCPConfig from "./config"

import { FSUtil } from "@opencode-ai/core/fs-util"
import { ConfigMCPV1 } from "@opencode-ai/core/v1/config/mcp"
import { Effect, Schema } from "effect"
import type { InstanceContext } from "../project/instance-context"
import { BUILTIN_MCP_NAMES, isBuiltinMcp, withNeDefaultMcp } from "../ne/mcp"
import { MCPConfigFile } from "./config-file"
import { MCPConfigSource, PersistenceError } from "./config-source"

export { PersistenceError } from "./config-source"

/** Writable MCP configuration scopes. */
export const Scope = Schema.Literals(["project", "global"])
export type Scope = Schema.Schema.Type<typeof Scope>

/** All MCP entry scopes, including synthetic builtins. */
export const EntryScope = Schema.Union([Scope, Schema.Literal("builtin")])

/** A persisted or synthetic MCP configuration entry with precedence metadata. */
export const Entry = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  scope: EntryScope,
  config: ConfigMCPV1.Info,
  source: Schema.optional(Schema.String),
  effective: Schema.Boolean,
  readonly: Schema.Boolean,
  overriddenBy: Schema.optional(Scope),
}).annotate({ identifier: "McpConfigEntry" })
export type Entry = Schema.Schema.Type<typeof Entry>

/** Input accepted when creating a scoped MCP entry. */
export const CreateInput = Schema.Struct({
  scope: Scope,
  name: Schema.String,
  config: ConfigMCPV1.Info,
})
export type CreateInput = Schema.Schema.Type<typeof CreateInput>

/** Input accepted when updating an existing MCP entry. */
export const UpdateInput = Schema.Struct({
  name: Schema.String,
  config: ConfigMCPV1.Info,
})
export type UpdateInput = Schema.Schema.Type<typeof UpdateInput>

/** Invalid user input or invalid persisted MCP configuration. */
export class InvalidError extends Schema.TaggedErrorClass<InvalidError>()(
  "MCPConfigInvalidError",
  { message: Schema.String, field: Schema.optional(Schema.String) },
  { httpApiStatus: 400 },
) {}

/** An MCP entry ID that is invalid, stale, or no longer discoverable. */
export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()(
  "MCPConfigNotFoundError",
  { message: Schema.String, entryID: Schema.optional(Schema.String) },
  { httpApiStatus: 404 },
) {}

/** A duplicate MCP name in the same writable scope. */
export class ConflictError extends Schema.TaggedErrorClass<ConflictError>()(
  "MCPConfigConflictError",
  { message: Schema.String, name: Schema.String, scope: Scope },
  { httpApiStatus: 409 },
) {}

/** Failures surfaced by persistent MCP configuration operations. */
export type Failure = InvalidError | NotFoundError | ConflictError | PersistenceError

/** Persistent MCP configuration operations for one filesystem environment. */
export interface Interface {
  readonly list: (ctx: InstanceContext) => Effect.Effect<readonly Entry[], Failure>
  readonly create: (ctx: InstanceContext, input: CreateInput) => Effect.Effect<readonly Entry[], Failure>
  readonly update: (
    ctx: InstanceContext,
    entryID: string,
    input: UpdateInput,
  ) => Effect.Effect<readonly Entry[], Failure>
  readonly remove: (ctx: InstanceContext, entryID: string) => Effect.Effect<readonly Entry[], Failure>
}

/** Creates an MCP configuration manager backed by the supplied filesystem. */
export function make(input: { fs: FSUtil.Interface; globalConfigDir: string }): Interface {
  const list = makeList(input)
  return {
    list,
    create: makeCreate(input, list),
    update: makeUpdate(input, list),
    remove: makeRemove(input, list),
  }
}

type ManagerInput = { fs: FSUtil.Interface; globalConfigDir: string }

function makeList(input: ManagerInput) {
  return Effect.fn("MCPConfig.list")(function* (ctx: InstanceContext) {
    const sources = yield* MCPConfigSource.discover({ ...input, ctx })
    return mergeEntries(yield* loadDocuments(input.fs, sources))
  })
}

function makeCreate(input: ManagerInput, list: Interface["list"]) {
  return Effect.fn("MCPConfig.create")(function* (ctx: InstanceContext, value: CreateInput) {
    const invalid = validateName(value.name)
    if (invalid) return yield* invalid
    const sources = yield* MCPConfigSource.discover({ ...input, ctx })
    const documents = yield* loadDocuments(input.fs, sources)
    if (hasName(documents, value.scope, value.name)) {
      return yield* new ConflictError({
        message: `MCP entry "${value.name}" already exists in ${value.scope} scope`,
        name: value.name,
        scope: value.scope,
      })
    }
    const source = MCPConfigSource.target({ ...input, ctx, sources, scope: value.scope })
    yield* MCPConfigFile.set({ ...value, fs: input.fs, path: source }).pipe(Effect.mapError(mapFileFailure))
    return yield* list(ctx)
  })
}

function makeUpdate(input: ManagerInput, list: Interface["list"]) {
  return Effect.fn("MCPConfig.update")(function* (ctx: InstanceContext, entryID: string, value: UpdateInput) {
    const resolved = yield* resolveEntry({ ...input, ctx, entryID })
    if (resolved.scope === "builtin" || resolved.readonly) return yield* readonlyFailure(resolved.name)
    const invalid = validateName(value.name)
    if (invalid) return yield* invalid
    if (value.name !== resolved.name) {
      const documents = yield* loadDocuments(input.fs, resolved.sources)
      if (hasName(documents, resolved.scope, value.name)) {
        return yield* new ConflictError({
          message: `MCP entry "${value.name}" already exists in ${resolved.scope} scope`,
          name: value.name,
          scope: resolved.scope,
        })
      }
    }
    if (value.name === resolved.name) {
      yield* MCPConfigFile.set({
        fs: input.fs,
        path: resolved.source.path,
        name: value.name,
        config: value.config,
      }).pipe(Effect.mapError(mapFileFailure))
      return yield* list(ctx)
    }
    yield* MCPConfigFile.rename({
      fs: input.fs,
      path: resolved.source.path,
      from: resolved.name,
      to: value.name,
      config: value.config,
    }).pipe(Effect.mapError((error) => mapRenameFailure(error, resolved.scope, value.name)))
    return yield* list(ctx)
  })
}

function makeRemove(input: ManagerInput, list: Interface["list"]) {
  return Effect.fn("MCPConfig.remove")(function* (ctx: InstanceContext, entryID: string) {
    const resolved = yield* resolveEntry({ ...input, ctx, entryID })
    if (resolved.scope === "builtin" || resolved.readonly) return yield* readonlyFailure(resolved.name)
    yield* MCPConfigFile.remove({ fs: input.fs, path: resolved.source.path, name: resolved.name }).pipe(
      Effect.mapError(mapFileFailure),
    )
    return yield* list(ctx)
  })
}

type Loaded = {
  readonly source: MCPConfigSource.Source
  readonly document: MCPConfigFile.Document
}

type Resolved =
  | { readonly scope: "builtin"; readonly name: string; readonly config: ConfigMCPV1.Info; readonly readonly: true }
  | {
      readonly scope: Scope
      readonly name: string
      readonly config: ConfigMCPV1.Info
      readonly readonly: boolean
      readonly source: MCPConfigSource.Source
      readonly sources: readonly MCPConfigSource.Source[]
    }

function loadDocuments(fs: FSUtil.Interface, sources: readonly MCPConfigSource.Source[]) {
  return Effect.forEach(sources, (source) =>
    MCPConfigFile.read({ fs, path: source.path }).pipe(
      Effect.map((document): Loaded => ({ source, document })),
      Effect.mapError(mapFileFailure),
    ),
  )
}

function mergeEntries(documents: readonly Loaded[]): readonly Entry[] {
  const loaded = documents.flatMap((item) =>
    Object.entries(item.document.mcp).map(
      ([name, config]): Entry => ({
        id: MCPConfigSource.encodeEntryID({ scope: item.source.scope, source: item.source.path, name }),
        name,
        scope: item.source.scope,
        config,
        source: item.source.path,
        effective: false,
        readonly: isBuiltinMcp(name),
      }),
    ),
  )
  const present = new Set(loaded.map((entry) => entry.name))
  const defaults = withNeDefaultMcp({})
  const builtins = BUILTIN_MCP_NAMES.filter((name) => !present.has(name)).map(
    (name): Entry => ({
      id: MCPConfigSource.encodeEntryID({ scope: "builtin", source: "", name }),
      name,
      scope: "builtin",
      config: defaults[name],
      effective: false,
      readonly: true,
    }),
  )
  const entries = builtins.concat(loaded)
  const winners = new Map(entries.map((entry, index) => [entry.name, index]))
  return entries.map((entry, index) => {
    const winner = entries[winners.get(entry.name)!]
    if (winner === entry) return { ...entry, effective: true }
    if (winner.scope === "builtin") return entry
    return { ...entry, overriddenBy: winner.scope }
  })
}

const hasName = (documents: readonly Loaded[], scope: Scope, name: string) =>
  documents.some((item) => item.source.scope === scope && Object.hasOwn(item.document.mcp, name))

function validateName(name: string) {
  if (isBuiltinMcp(name)) return readonlyFailure(name)
  if (/^[a-z0-9][a-z0-9_-]*$/.test(name)) return
  return new InvalidError({
    message: "MCP name must start with a lowercase letter or digit and contain only lowercase letters, digits, _ or -",
    field: "name",
  })
}

const readonlyFailure = (name: string) =>
  new InvalidError({ message: `MCP entry "${name}" is managed by NE and cannot be changed`, field: "name" })

function resolveEntry(input: {
  fs: FSUtil.Interface
  globalConfigDir: string
  ctx: InstanceContext
  entryID: string
}): Effect.Effect<Resolved, Failure> {
  return Effect.gen(function* () {
    const decoded = MCPConfigSource.decodeEntryID(input.entryID)
    if (!decoded) return yield* missing(input.entryID)
    if (decoded.scope === "builtin") {
      if (!isBuiltinMcp(decoded.name)) return yield* missing(input.entryID)
      return { scope: "builtin", name: decoded.name, config: withNeDefaultMcp({})[decoded.name], readonly: true }
    }
    const sources = yield* MCPConfigSource.discover(input)
    const source = sources.find((candidate) => candidate.scope === decoded.scope && candidate.path === decoded.source)
    if (!source) return yield* missing(input.entryID)
    const document = yield* MCPConfigFile.read({ fs: input.fs, path: source.path }).pipe(
      Effect.mapError(mapFileFailure),
    )
    if (!Object.hasOwn(document.mcp, decoded.name)) return yield* missing(input.entryID)
    return {
      scope: decoded.scope,
      source,
      sources,
      name: decoded.name,
      config: document.mcp[decoded.name],
      readonly: isBuiltinMcp(decoded.name),
    }
  })
}

const missing = (entryID: string) =>
  new NotFoundError({ message: "MCP entry does not exist or is no longer available", entryID })

type FileFailure =
  | MCPConfigFile.ReadError
  | MCPConfigFile.ParseError
  | MCPConfigFile.WriteError
  | MCPConfigFile.NotFoundError

function mapFileFailure(error: FileFailure): Failure {
  if (error._tag === "MCPConfigFile.ParseError") return new InvalidError({ message: error.message })
  if (error._tag === "MCPConfigFile.NotFoundError") return new NotFoundError({ message: error.message })
  return new PersistenceError({
    message: "Unable to access MCP configuration file",
    path: error.path,
    cause: error.cause,
  })
}

function mapRenameFailure(error: FileFailure | MCPConfigFile.ConflictError, scope: Scope, name: string): Failure {
  if (error._tag !== "MCPConfigFile.ConflictError") return mapFileFailure(error)
  return new ConflictError({ message: error.message, name, scope })
}

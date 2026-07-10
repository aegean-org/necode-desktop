export * as MCPConfigSource from "./config-source"

import { FSUtil } from "@opencode-ai/core/fs-util"
import { Effect, Option, Schema } from "effect"
import path from "node:path"
import { ConfigPaths } from "../config/paths"
import type { InstanceContext } from "../project/instance-context"

/** A persisted MCP configuration source ordered by runtime precedence. */
export type Source = {
  readonly scope: "project" | "global"
  readonly path: string
  readonly precedence: number
}

/** A decoded MCP entry identity. Source paths must be revalidated against discovery before use. */
export type EntryID = {
  readonly scope: "project" | "global" | "builtin"
  readonly source: string
  readonly name: string
}

/** A filesystem failure while discovering or persisting MCP configuration. */
export class PersistenceError extends Schema.TaggedErrorClass<PersistenceError>()(
  "MCPConfigPersistenceError",
  { message: Schema.String, path: Schema.optional(Schema.String), cause: Schema.optional(Schema.Defect) },
  { httpApiStatus: 500 },
) {}

/** Discovers existing global and project MCP configuration files in runtime load order. */
export const discover = Effect.fn("MCPConfigSource.discover")(function* (input: {
  fs: FSUtil.Interface
  globalConfigDir: string
  ctx: InstanceContext
}) {
  const global = ["config.json", "opencode.json", "opencode.jsonc"].map((name) => ({
    scope: "global" as const,
    path: path.join(input.globalConfigDir, name),
  }))
  const project = (yield* ConfigPaths.files("opencode", input.ctx.directory, input.ctx.worktree).pipe(
    Effect.provideService(FSUtil.Service, input.fs),
    Effect.mapError((cause) => persistence("Unable to discover project MCP configuration", input.ctx.worktree, cause)),
  )).map((source) => ({ scope: "project" as const, path: source }))
  const directories = yield* input.fs
    .up({ targets: [".opencode"], start: input.ctx.directory, stop: input.ctx.worktree })
    .pipe(
      Effect.mapError((cause) =>
        persistence("Unable to discover .opencode MCP configuration", input.ctx.worktree, cause),
      ),
    )
  const local = directories.flatMap((directory) =>
    ["opencode.json", "opencode.jsonc"].map((name) => ({
      scope: "project" as const,
      path: path.join(directory, name),
    })),
  )
  const existing = yield* Effect.filter([...global, ...project, ...local], (source) => isFile(input.fs, source.path))
  return existing.map((source, precedence) => ({ ...source, precedence }))
})

/** Selects the highest-precedence existing source or the canonical default target for a scope. */
export function target(input: {
  scope: "project" | "global"
  sources: readonly Source[]
  globalConfigDir: string
  ctx: InstanceContext
}) {
  const existing = input.sources.filter((source) => source.scope === input.scope).at(-1)
  if (existing) return existing.path
  if (input.scope === "global") return path.join(input.globalConfigDir, "opencode.json")
  return path.join(input.ctx.worktree, "opencode.json")
}

/** Encodes a stable URL-safe MCP entry identity. */
export function encodeEntryID(input: EntryID) {
  return Buffer.from(JSON.stringify([input.scope, input.source, input.name])).toString("base64url")
}

/** Decodes only the entry ID structure; callers must validate the source against current discovery. */
export function decodeEntryID(entryID: string): EntryID | undefined {
  if (!entryID || !/^[A-Za-z0-9_-]+$/.test(entryID)) return
  const text = Buffer.from(entryID, "base64url").toString("utf8")
  if (Buffer.from(text).toString("base64url") !== entryID) return
  const decoded = Schema.decodeUnknownOption(Schema.fromJsonString(ENTRY_ID))(text)
  if (Option.isNone(decoded)) return
  const [scope, source, name] = decoded.value
  if (!name || (scope !== "builtin" && !source) || (scope === "builtin" && source)) return
  return { scope, source, name }
}

const ENTRY_ID = Schema.Tuple([Schema.Literals(["project", "global", "builtin"]), Schema.String, Schema.String])

function isFile(fs: FSUtil.Interface, source: string) {
  return fs.stat(source).pipe(
    Effect.map((info) => info.type === "File"),
    Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(false)),
    Effect.mapError((cause) => persistence("Unable to inspect MCP configuration source", source, cause)),
  )
}

function persistence(message: string, source: string, cause: unknown) {
  return new PersistenceError({ message, path: source, cause })
}

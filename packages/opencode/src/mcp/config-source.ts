export * as MCPConfigSource from "./config-source"

import { FSUtil } from "@opencode-ai/core/fs-util"
import { Effect, Schema } from "effect"
import { createHash } from "node:crypto"
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

/** Creates a stable short URL-safe MCP entry identity. */
export function encodeEntryID(input: EntryID) {
  return createHash("sha256")
    .update(JSON.stringify([input.scope, input.source ? path.normalize(input.source) : input.source, input.name]))
    .digest("base64url")
}

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

export * as PluginConfigSource from "./config-source"

import { FSUtil } from "@opencode-ai/core/fs-util"
import { Effect, Schema } from "effect"
import path from "node:path"
import { ConfigPaths } from "@/config/paths"
import type { InstanceContext } from "@/project/instance-context"

/** Persisted plugin configuration source ordered by runtime precedence. */
export type Source = {
  readonly scope: "global" | "local"
  readonly path: string
  readonly precedence: number
}

/** Filesystem failure while discovering or persisting plugin configuration. */
export class PersistenceError extends Schema.TaggedErrorClass<PersistenceError>()(
  "PluginConfigPersistenceError",
  { message: Schema.String, path: Schema.optional(Schema.String), cause: Schema.optional(Schema.Defect) },
  { httpApiStatus: 500 },
) {}

/** Discovers existing global and local plugin configuration files in runtime load order. */
export const discover = Effect.fn("PluginConfigSource.discover")(function* (input: {
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
    Effect.mapError((cause) => persistence("Unable to discover project plugin configuration", input.ctx.worktree, cause)),
  )).map((source) => ({ scope: "local" as const, path: source }))
  const directories = yield* input.fs.up({ targets: [".opencode"], start: input.ctx.directory, stop: input.ctx.worktree }).pipe(
    Effect.mapError((cause) => persistence("Unable to discover .opencode plugin configuration", input.ctx.worktree, cause)),
  )
  const local = directories.flatMap((directory) =>
    ["opencode.json", "opencode.jsonc"].map((name) => ({ scope: "local" as const, path: path.join(directory, name) })),
  )
  const existing = yield* Effect.filter([...global, ...project, ...local], (source) => isFile(input.fs, source.path))
  return existing.map((source, precedence) => ({ ...source, precedence }))
})

/** Selects the highest-precedence source or canonical default target for a scope. */
export function target(input: {
  scope: "global" | "local"
  sources: readonly Source[]
  globalConfigDir: string
  ctx: InstanceContext
}) {
  const existing = input.sources.filter((source) => source.scope === input.scope).at(-1)
  if (existing) return existing.path
  if (input.scope === "global") return path.join(input.globalConfigDir, "opencode.json")
  return path.join(input.ctx.worktree, "opencode.json")
}

function isFile(fs: FSUtil.Interface, source: string) {
  return fs.stat(source).pipe(
    Effect.map((info) => info.type === "File"),
    Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(false)),
    Effect.mapError((cause) => persistence("Unable to inspect plugin configuration source", source, cause)),
  )
}

function persistence(message: string, source: string, cause: unknown) {
  return new PersistenceError({ message, path: source, cause })
}

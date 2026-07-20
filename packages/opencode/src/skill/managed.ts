export * as SkillManaged from "./managed"

import { ConfigMarkdown } from "@opencode-ai/core/config/markdown"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Repository } from "@opencode-ai/core/repository"
import { Hash } from "@opencode-ai/core/util/hash"
import { Effect, Schema } from "effect"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { pathToFileURL } from "node:url"
import type { Git } from "@/git"
import type { InstanceContext } from "@/project/instance-context"
import { isRecord } from "@/util/record"

export const Scope = Schema.Literals(["global", "local"])
export type Scope = typeof Scope.Type

export const InstallInput = Schema.Struct({
  source: Schema.String,
  scope: Scope,
  replace: Schema.optional(Schema.Boolean),
})
export type InstallInput = typeof InstallInput.Type

export const InstallResult = Schema.Struct({
  skills: Schema.Array(Schema.String),
  source: Schema.String,
  scope: Scope,
})
export type InstallResult = typeof InstallResult.Type

export const Entry = Schema.Struct({
  name: Schema.String,
  source: Schema.String,
  scope: Scope,
  path: Schema.String,
  canUninstall: Schema.Literal(true),
})
export type Entry = typeof Entry.Type

export class InvalidError extends Schema.TaggedErrorClass<InvalidError>()(
  "SkillManagedInvalidError",
  { message: Schema.String, field: Schema.optional(Schema.String) },
  { httpApiStatus: 400 },
) {}

export class ConflictError extends Schema.TaggedErrorClass<ConflictError>()(
  "SkillManagedConflictError",
  {
    message: Schema.String,
    name: Schema.String,
    currentSource: Schema.String,
    incomingSource: Schema.String,
  },
  { httpApiStatus: 409 },
) {}

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()(
  "SkillManagedNotFoundError",
  { message: Schema.String, name: Schema.String },
  { httpApiStatus: 404 },
) {}

export class PluginRequiredError extends Schema.TaggedErrorClass<PluginRequiredError>()(
  "SkillManagedPluginRequiredError",
  { message: Schema.String, pluginSpec: Schema.String },
  { httpApiStatus: 400 },
) {}

export class InstallError extends Schema.TaggedErrorClass<InstallError>()(
  "SkillManagedInstallError",
  { message: Schema.String, stage: Schema.String },
  { httpApiStatus: 400 },
) {}

export class PersistenceError extends Schema.TaggedErrorClass<PersistenceError>()(
  "SkillManagedPersistenceError",
  { message: Schema.String, path: Schema.optional(Schema.String), cause: Schema.optional(Schema.Defect) },
  { httpApiStatus: 500 },
) {}

export type Failure =
  | InvalidError
  | ConflictError
  | NotFoundError
  | PluginRequiredError
  | InstallError
  | PersistenceError
export type InstallFailure = Exclude<Failure, NotFoundError>

export interface Interface {
  readonly list: (ctx: InstanceContext) => Effect.Effect<Entry[], PersistenceError>
  readonly install: (ctx: InstanceContext, input: InstallInput) => Effect.Effect<InstallResult, InstallFailure>
  readonly remove: (ctx: InstanceContext, name: string) => Effect.Effect<void, NotFoundError | PersistenceError>
}

type Input = {
  fs: FSUtil.Interface
  git: Git.Interface
  globalConfigDir: string
  cacheDir: string
  pull?: (url: string) => Effect.Effect<string[], unknown>
}
type PathsInput = Pick<Input, "fs" | "globalConfigDir">

type Manifest = { version: 1; skills: Record<string, { source: string }> }
type Candidate = { name: string; directory: string }
type Resolved = { source: string; roots: string[]; pluginSpec?: string }

const MANIFEST = ".necode-managed.json"
const EMPTY_MANIFEST: Manifest = { version: 1, skills: {} }

export function make(input: Input): Interface {
  const list = Effect.fn("SkillManaged.list")((ctx: InstanceContext) => entries(input, ctx))
  return { list, install: makeInstall(input), remove: makeRemove(input) }
}

export const entries = Effect.fn("SkillManaged.entries")(function* (input: PathsInput, ctx: InstanceContext) {
  return yield* Effect.forEach(["local", "global"] as const, (scope) =>
    Effect.gen(function* () {
      const root = targetRoot(input, ctx, scope)
      const manifest = yield* readManifest(input.fs, root)
      return Object.entries(manifest.skills).map(([name, item]) => ({
        name,
        source: item.source,
        scope,
        path: path.join(root, name),
        canUninstall: true as const,
      }))
    }),
  ).pipe(Effect.map((items) => items.flat()))
})

function makeInstall(input: Input) {
  return Effect.fn("SkillManaged.install")(function* (ctx: InstanceContext, request: InstallInput) {
    if (!request.source.trim()) return yield* new InvalidError({ message: "Skill source is required", field: "source" })
    const resolved = yield* resolveSource(input, ctx, request.source.trim())
    if (resolved.pluginSpec) {
      return yield* new PluginRequiredError({
        message: `This source is a plugin-backed Skill pack. Install it from Plugins: ${resolved.pluginSpec}`,
        pluginSpec: resolved.pluginSpec,
      })
    }
    const candidates = yield* discoverCandidates(input.fs, resolved.roots)
    if (!candidates.length) {
      return yield* new InstallError({ stage: "discovery", message: "No valid SKILL.md files were found" })
    }

    const root = targetRoot(input, ctx, request.scope)
    const manifest = yield* readManifest(input.fs, root)
    const managed = yield* entries(input, ctx)
    for (const candidate of candidates) {
      const other = managed.find((item) => item.name === candidate.name && item.scope !== request.scope)
      if (other && !request.replace) {
        return yield* new ConflictError({
          message: `Skill ${candidate.name} is already installed in the ${other.scope} scope`,
          name: candidate.name,
          currentSource: other.source,
          incomingSource: resolved.source,
        })
      }
      const current = manifest.skills[candidate.name]?.source
      const existing = yield* input.fs.existsSafe(path.join(root, candidate.name))
      if ((!current && existing) || (current && current !== resolved.source)) {
        if (request.replace) continue
        return yield* new ConflictError({
          message: `Skill ${candidate.name} is already installed from another source`,
          name: candidate.name,
          currentSource: current ?? path.join(root, candidate.name),
          incomingSource: resolved.source,
        })
      }
    }

    if (request.replace) {
      yield* Effect.forEach(
        managed.filter(
          (item) => item.scope !== request.scope && candidates.some((candidate) => candidate.name === item.name),
        ),
        (item) => removeEntry(input, ctx, item.scope, item.name),
        { discard: true },
      )
    }

    yield* input.fs.ensureDir(root).pipe(Effect.mapError((cause) => persistence(root, cause)))
    for (const candidate of candidates) {
      const target = path.join(root, candidate.name)
      const temporary = path.join(root, `.${candidate.name}.${process.pid}.${randomUUID()}.tmp`)
      yield* input.fs.remove(temporary, { recursive: true }).pipe(Effect.catch(() => Effect.void))
      yield* copyDirectory(input.fs, candidate.directory, temporary)
      yield* input.fs.remove(target, { recursive: true }).pipe(Effect.catch(() => Effect.void))
      yield* input.fs.rename(temporary, target).pipe(Effect.mapError((cause) => persistence(target, cause)))
      manifest.skills[candidate.name] = { source: resolved.source }
    }
    yield* writeManifest(input.fs, root, manifest)
    return {
      skills: candidates.map((candidate) => candidate.name).toSorted(),
      source: resolved.source,
      scope: request.scope,
    }
  })
}

function makeRemove(input: Input) {
  return Effect.fn("SkillManaged.remove")(function* (ctx: InstanceContext, name: string) {
    for (const scope of ["local", "global"] as const) {
      const root = targetRoot(input, ctx, scope)
      const manifest = yield* readManifest(input.fs, root)
      if (!manifest.skills[name]) continue
      yield* removeEntry(input, ctx, scope, name)
      return
    }
    return yield* new NotFoundError({ message: `Managed Skill ${name} was not found`, name })
  })
}

function removeEntry(input: PathsInput, ctx: InstanceContext, scope: Scope, name: string) {
  return Effect.gen(function* () {
    const root = targetRoot(input, ctx, scope)
    const manifest = yield* readManifest(input.fs, root)
    yield* input.fs
      .remove(path.join(root, name), { recursive: true })
      .pipe(Effect.mapError((cause) => persistence(path.join(root, name), cause)))
    delete manifest.skills[name]
    yield* writeManifest(input.fs, root, manifest)
  })
}

function targetRoot(input: PathsInput, ctx: InstanceContext, scope: Scope) {
  if (scope === "global") return path.join(input.globalConfigDir, "skills")
  return path.join(ctx.worktree, ".opencode", "skills")
}

function readManifest(fs: FSUtil.Interface, root: string) {
  const filepath = path.join(root, MANIFEST)
  return fs.readFileStringSafe(filepath).pipe(
    Effect.flatMap((text) => {
      if (!text) return Effect.succeed(structuredClone(EMPTY_MANIFEST))
      return Effect.try({
        try: (): Manifest => {
          const parsed: unknown = JSON.parse(text)
          if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.skills)) {
            throw new Error("Managed Skill manifest must contain version 1 and a skills object")
          }
          const skills = Object.fromEntries(
            Object.entries(parsed.skills).filter(
              (item): item is [string, { source: string }] => isRecord(item[1]) && typeof item[1].source === "string",
            ),
          )
          return { version: 1, skills }
        },
        catch: (cause) => persistence(filepath, cause),
      })
    }),
    Effect.mapError((cause) => (cause instanceof PersistenceError ? cause : persistence(filepath, cause))),
  )
}

function writeManifest(fs: FSUtil.Interface, root: string, manifest: Manifest) {
  return fs.ensureDir(root).pipe(
    Effect.flatMap(() => fs.writeJson(path.join(root, MANIFEST), manifest)),
    Effect.mapError((cause) => persistence(path.join(root, MANIFEST), cause)),
  )
}

function resolveSource(input: Input, ctx: InstanceContext, source: string) {
  return Effect.gen(function* () {
    const local = path.resolve(ctx.directory, source)
    if (yield* input.fs.isDir(local)) {
      return {
        source: path.resolve(local),
        roots: [local],
        pluginSpec: yield* pluginSpec(input.fs, local, path.resolve(local)),
      } satisfies Resolved
    }

    const github = githubSource(source)
    if (github) {
      const target = path.join(input.cacheDir, Hash.fast(`${github.remote}#${github.branch ?? ""}`))
      yield* input.fs.remove(target, { recursive: true }).pipe(Effect.catch(() => Effect.void))
      yield* input.fs.ensureDir(input.cacheDir).pipe(Effect.mapError((cause) => persistence(input.cacheDir, cause)))
      const args = [
        "clone",
        "--depth",
        "1",
        ...(github.branch ? ["--branch", github.branch] : []),
        github.remote,
        target,
      ]
      const result = yield* input.git.run(args, { cwd: input.cacheDir })
      if (result.exitCode !== 0) {
        return yield* new InstallError({
          stage: "clone",
          message: result.stderr.toString("utf8").trim() || `Unable to clone ${github.remote}`,
        })
      }
      const root = github.subpath ? path.join(target, github.subpath) : target
      if (!(yield* input.fs.isDir(root))) {
        return yield* new InstallError({ stage: "source", message: `Skill source path does not exist: ${root}` })
      }
      const canonical = `git:${github.remote}#${github.branch ?? ""}:${github.subpath ?? ""}`
      return {
        source: canonical,
        roots: [root],
        pluginSpec: yield* pluginSpec(input.fs, root, github.pluginSpec),
      } satisfies Resolved
    }

    if (URL.canParse(source) && input.pull) {
      const roots = yield* input
        .pull(source)
        .pipe(
          Effect.mapError(
            (cause) =>
              new InstallError({ stage: "download", message: cause instanceof Error ? cause.message : String(cause) }),
          ),
        )
      return { source: new URL(source).href, roots } satisfies Resolved
    }
    return yield* new InvalidError({
      message: `Skill source is not a directory, GitHub repository, or Skill URL: ${source}`,
      field: "source",
    })
  })
}

function githubSource(source: string) {
  const web = URL.canParse(source) ? new URL(source) : undefined
  if (web?.hostname.toLowerCase() === "github.com") {
    const parts = web.pathname.split("/").filter(Boolean)
    if (parts.length < 2) return
    const remote = `https://github.com/${parts[0]}/${parts[1].replace(/\.git$/, "")}.git`
    if (parts[2] !== "tree") return { remote, pluginSpec: `${parts[1]}@git+${remote}` }
    return {
      remote,
      branch: parts[3],
      subpath: parts.slice(4).join("/") || undefined,
      pluginSpec: `${parts[1]}@git+${remote}${parts[3] ? `#${parts[3]}` : ""}`,
    }
  }
  if (web && !web.pathname.endsWith(".git")) return
  const reference = Repository.parse(source)
  if (!reference || Repository.isFile(reference)) return
  return { remote: reference.remote, pluginSpec: `${reference.repo}@git+${reference.remote}` }
}

function pluginSpec(fs: FSUtil.Interface, root: string, fallback: string) {
  return fs.readFileStringSafe(path.join(root, "package.json")).pipe(
    Effect.map((text) => {
      if (!text) return undefined
      const pkg: unknown = JSON.parse(text)
      if (!isRecord(pkg) || typeof pkg.main !== "string") return undefined
      if (!pkg.main.replaceAll("\\", "/").includes(".opencode/plugin")) return undefined
      return typeof pkg.name === "string" && fallback.startsWith("git:") ? `${pkg.name}@${fallback.slice(4)}` : fallback
    }),
    Effect.catch(() => Effect.succeed(undefined)),
  )
}

function discoverCandidates(fs: FSUtil.Interface, roots: string[]) {
  return Effect.gen(function* () {
    const candidates: Candidate[] = []
    const names = new Set<string>()
    for (const root of roots) {
      const matches = yield* fs
        .glob("{SKILL.md,**/SKILL.md}", {
          cwd: root,
          absolute: true,
          include: "file",
          symlink: false,
          dot: true,
        })
        .pipe(Effect.mapError((cause) => persistence(root, cause)))
      for (const match of matches.toSorted()) {
        const text = yield* fs.readFileStringSafe(match).pipe(Effect.mapError((cause) => persistence(match, cause)))
        if (!text) continue
        const markdown = yield* Effect.try({
          try: () => ConfigMarkdown.parse(text),
          catch: (cause) => new InvalidError({ message: `Invalid Skill frontmatter in ${match}: ${String(cause)}` }),
        })
        const name = isRecord(markdown.data) && typeof markdown.data.name === "string" ? markdown.data.name : undefined
        if (!name || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) {
          return yield* new InvalidError({ message: `Invalid Skill name in ${match}`, field: "name" })
        }
        if (names.has(name))
          return yield* new InvalidError({ message: `Duplicate Skill name in source: ${name}`, field: "name" })
        names.add(name)
        candidates.push({ name, directory: path.dirname(match) })
      }
    }
    return candidates
  })
}

function copyDirectory(fs: FSUtil.Interface, source: string, target: string): Effect.Effect<void, PersistenceError> {
  return Effect.gen(function* () {
    yield* fs.ensureDir(target).pipe(Effect.mapError((cause) => persistence(target, cause)))
    const entries = yield* fs.readDirectoryEntries(source).pipe(Effect.mapError((cause) => persistence(source, cause)))
    for (const entry of entries) {
      if (entry.name === ".git" || entry.type === "symlink" || entry.type === "other") continue
      const from = path.join(source, entry.name)
      const to = path.join(target, entry.name)
      if (entry.type === "directory") {
        yield* copyDirectory(fs, from, to)
        continue
      }
      const content = yield* fs.readFile(from).pipe(Effect.mapError((cause) => persistence(from, cause)))
      yield* fs.writeWithDirs(to, content).pipe(Effect.mapError((cause) => persistence(to, cause)))
    }
  })
}

function persistence(target: string, cause: unknown) {
  return new PersistenceError({
    message: `Unable to manage Skill files at ${target}: ${cause instanceof Error ? cause.message : String(cause)}`,
    path: target,
    cause,
  })
}

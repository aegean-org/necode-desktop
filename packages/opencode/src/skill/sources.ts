import { FSUtil } from "@opencode-ai/core/fs-util"
import { Global } from "@opencode-ai/core/global"
import { Glob } from "@opencode-ai/core/util/glob"
import { Effect } from "effect"
import path from "path"
import type { Config } from "@/config/config"
import type { PluginRegistry } from "@/plugin/registry"
import type { Discovery } from "./discovery"

const CLAUDE_EXTERNAL_DIR = ".claude"
const AGENTS_EXTERNAL_DIR = ".agents"
const EXTERNAL_SKILL_PATTERN = "skills/**/SKILL.md"
const OPENCODE_SKILL_PATTERN = "{skill,skills}/**/SKILL.md"
const SKILL_PATTERN = "**/SKILL.md"

type ScanState = { matches: Set<string>; dirs: Set<string> }

export namespace SkillSources {
  /** Files and directories discovered as active skill sources. */
  export type State = { matches: string[]; dirs: string[]; pluginRoots: string[] }
  /** Services and plugin entries required to discover all active skills. */
  export type Input = {
    config: Config.Interface
    discovery: Discovery.Interface
    fsys: FSUtil.Interface
    global: Global.Interface
    plugins: readonly PluginRegistry.Entry[]
    disableExternalSkills: boolean
    disableClaudeCodeSkills: boolean
    directory: string
    worktree: string
  }

  /** Discovers configured, conventional, and active plugin-provided skill files. */
  export const discover = Effect.fnUntraced(function* (input: Input) {
    const state: ScanState = { matches: new Set(), dirs: new Set() }
    yield* external(state, input)
    yield* configured(state, input)
    yield* pluginSkills(state, input.plugins)
    return {
      matches: Array.from(state.matches),
      dirs: Array.from(state.dirs),
      pluginRoots: input.plugins.filter((plugin) => plugin.status === "active").flatMap((plugin) => plugin.skills),
    }
  })
}

function external(state: ScanState, input: SkillSources.Input) {
  return Effect.gen(function* () {
    if (input.disableExternalSkills) return
    const dirs = [...(input.disableClaudeCodeSkills ? [] : [CLAUDE_EXTERNAL_DIR]), AGENTS_EXTERNAL_DIR]
    for (const dir of dirs) {
      const root = path.join(input.global.home, dir)
      if (yield* input.fsys.isDir(root))
        yield* scan(state, root, EXTERNAL_SKILL_PATTERN, { dot: true, scope: "global" })
    }
    const roots = yield* input.fsys
      .up({ targets: dirs, start: input.directory, stop: input.worktree })
      .pipe(Effect.catch(() => Effect.succeed([] as string[])))
    for (const root of roots) yield* scan(state, root, EXTERNAL_SKILL_PATTERN, { dot: true, scope: "project" })
  })
}

function configured(state: ScanState, input: SkillSources.Input) {
  return Effect.gen(function* () {
    const directories = yield* input.config.directories()
    for (const dir of directories) yield* scan(state, dir, OPENCODE_SKILL_PATTERN)
    const project = path.join(input.directory, ".opencode")
    if (!directories.includes(project) && (yield* input.fsys.isDir(project))) {
      yield* scan(state, project, OPENCODE_SKILL_PATTERN)
    }
    const cfg = yield* input.config.get()
    for (const item of cfg.skills?.paths ?? []) {
      const expanded = item.startsWith("~/") ? path.join(input.global.home, item.slice(2)) : item
      const dir = path.isAbsolute(expanded) ? expanded : path.join(input.directory, expanded)
      if (!(yield* input.fsys.isDir(dir))) {
        yield* Effect.logWarning("skill path not found", { path: dir })
        continue
      }
      yield* scan(state, dir, SKILL_PATTERN)
    }
    for (const url of cfg.skills?.urls ?? []) {
      for (const dir of yield* input.discovery.pull(url)) yield* scan(state, dir, SKILL_PATTERN)
    }
  })
}

function pluginSkills(state: ScanState, plugins: readonly PluginRegistry.Entry[]) {
  return Effect.gen(function* () {
    for (const plugin of plugins) {
      if (plugin.status !== "active") continue
      for (const dir of plugin.skills) yield* scan(state, dir, SKILL_PATTERN, { scope: `plugin ${plugin.id}` })
    }
  })
}

const scan = Effect.fnUntraced(function* (
  state: ScanState,
  root: string,
  pattern: string,
  opts?: { dot?: boolean; scope?: string },
) {
  const matches = yield* Effect.tryPromise({
    try: () => Glob.scan(pattern, { cwd: root, absolute: true, include: "file", symlink: true, dot: opts?.dot }),
    catch: (error) => error,
  }).pipe(
    Effect.catch((error) => {
      if (!opts?.scope) return Effect.die(error)
      return Effect.logError(`failed to scan ${opts.scope} skills`, { dir: root, error }).pipe(
        Effect.as([] as string[]),
      )
    }),
  )
  for (const match of matches) {
    state.matches.add(match)
    state.dirs.add(path.dirname(match))
  }
})

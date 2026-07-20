import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import path from "path"
import { pathToFileURL } from "url"
import { Effect, Layer, Context, Option, Schema } from "effect"
import { NamedError } from "@opencode-ai/core/util/error"
import type { Agent } from "@/agent/agent"
import { EventV2Bridge } from "@/event-v2-bridge"
import { InstanceState } from "@/effect/instance-state"
import { Global } from "@opencode-ai/core/global"
import { SkillPlugin } from "@opencode-ai/core/plugin/skill"
import { Permission } from "@/permission"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Config } from "@/config/config"
import { FrontmatterError } from "@opencode-ai/core/v1/config/error"
import { ConfigMarkdown } from "@/config/markdown"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { Discovery } from "./discovery"
import { isRecord } from "@/util/record"
import { Plugin } from "@/plugin"
import { SkillSources } from "./sources"
import { SkillManaged } from "./managed"

// Built-in skill that ships with NeCode. The model's intuition for what a
// runtime config should look like is often wrong, and the runtime hard-fails on
// invalid config, so users hit cryptic startup errors. Loading this skill
// when the model is asked to touch NeCode's own config files gives it the
// actual schemas instead of guesses.
const CUSTOMIZE_NECODE_SKILL_NAME = "customize-necode"
const CUSTOMIZE_NECODE_SKILL_DESCRIPTION =
  "Use ONLY when the user is installing or importing skills, skill packs, or plugins, or editing or creating NeCode configuration, agents, subagents, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring NeCode itself."
const CUSTOMIZE_NECODE_SKILL_BODY = SkillPlugin.CustomizeNecodeContent
const SKILL_CATALOG_GUIDANCE = [
  "The list below is the currently installed skill set, not a fixed or system-predefined catalog.",
  "A missing skill may still be installable; do not reject an installation request solely because it is absent.",
]

export const Info = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  slash: Schema.optional(Schema.Boolean),
  location: Schema.String,
  content: Schema.String,
  source: Schema.optional(Schema.Literals(["builtin", "managed", "plugin", "external", "configured", "url"])),
  scope: Schema.optional(Schema.Literals(["builtin", "plugin", "global", "local"])),
  canUninstall: Schema.optional(Schema.Boolean),
  installSource: Schema.optional(Schema.String),
})
export type Info = Schema.Schema.Type<typeof Info>

const Issue = Schema.StructWithRest(
  Schema.Struct({
    message: Schema.String,
    path: Schema.Array(Schema.String),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
)

function isSkillFrontmatter(data: unknown): data is { name: string; description?: string; slash?: boolean } {
  return (
    isRecord(data) &&
    typeof data.name === "string" &&
    (data.description === undefined || typeof data.description === "string") &&
    (data.slash === undefined || typeof data.slash === "boolean")
  )
}

export class InvalidError extends Schema.TaggedErrorClass<InvalidError>()("SkillInvalidError", {
  path: Schema.String,
  message: Schema.optional(Schema.String),
  issues: Schema.optional(Schema.Array(Issue)),
}) {}

export class NameMismatchError extends Schema.TaggedErrorClass<NameMismatchError>()("SkillNameMismatchError", {
  path: Schema.String,
  expected: Schema.String,
  actual: Schema.String,
}) {}

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("Skill.NotFoundError", {
  name: Schema.String,
  available: Schema.Array(Schema.String),
}) {
  override get message() {
    return `Skill "${this.name}" not found. Available skills: ${this.available.join(", ") || "none"}`
  }
}

type State = {
  skills: Record<string, Info>
  dirs: Set<string>
  matches: Set<string>
}

export interface Interface {
  readonly get: (name: string) => Effect.Effect<Info | undefined>
  readonly require: (name: string) => Effect.Effect<Info, NotFoundError>
  readonly all: () => Effect.Effect<Info[]>
  readonly dirs: () => Effect.Effect<string[]>
  readonly available: (agent?: Agent.Info) => Effect.Effect<Info[]>
}

type Origin = Required<Pick<Info, "source" | "scope" | "canUninstall">> & Pick<Info, "installSource">

const add = Effect.fnUntraced(function* (
  state: State,
  match: string,
  events: EventV2Bridge.Service["Service"],
  origin: (name: string, location: string) => Origin,
) {
  const md = yield* Effect.tryPromise({
    try: () => ConfigMarkdown.parse(match),
    catch: (err) => err,
  }).pipe(
    Effect.catch(
      Effect.fnUntraced(function* (err) {
        const message = FrontmatterError.isInstance(err) ? err.data.message : `Failed to parse skill ${match}`
        const { Session } = yield* Effect.promise(() => import("@/session/session"))
        yield* events.publish(Session.Event.Error, { error: new NamedError.Unknown({ message }).toObject() })
        yield* Effect.logError("failed to load skill", { skill: match, error: err })
        return undefined
      }),
    ),
  )

  if (!md) return

  if (!isSkillFrontmatter(md.data)) return

  const next = origin(md.data.name, match)
  const existing = state.skills[md.data.name]
  if (existing) {
    yield* Effect.logWarning("duplicate skill name", {
      name: md.data.name,
      existing: existing.location,
      duplicate: match,
    })
  }

  // A managed Skill shadows a same-named plugin Skill without deleting it, so
  // uninstalling the managed copy reveals the plugin-provided Skill again.
  if (existing?.source === "managed" && next.source !== "managed") return

  state.dirs.add(path.dirname(match))
  state.skills[md.data.name] = {
    name: md.data.name,
    description: md.data.description,
    slash: md.data.slash,
    location: match,
    content: md.content,
    ...next,
  }
})

const loadSkills = Effect.fnUntraced(function* (
  state: State,
  discovered: SkillSources.State,
  events: EventV2Bridge.Service["Service"],
  origin: (name: string, location: string) => Origin,
) {
  yield* Effect.forEach(discovered.matches, (match) => add(state, match, events, origin), {
    concurrency: 1,
    discard: true,
  })

  state.matches = new Set(discovered.matches)
  yield* Effect.logInfo("init", { count: Object.keys(state.skills).length })
})

export class Service extends Context.Service<Service, Interface>()("@opencode/Skill") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const discovery = yield* Discovery.Service
    const config = yield* Config.Service
    const events = yield* EventV2Bridge.Service
    const fsys = yield* FSUtil.Service
    const global = yield* Global.Service
    const flags = yield* RuntimeFlags.Service
    const plugin = Option.getOrUndefined(yield* Effect.serviceOption(Plugin.Service))
    const discovered = yield* InstanceState.make(
      Effect.fn("Skill.discovery")(function* (ctx) {
        return yield* SkillSources.discover({
          config,
          discovery,
          fsys,
          global,
          plugins: plugin ? yield* plugin.entries() : [],
          disableExternalSkills: flags.disableExternalSkills,
          disableClaudeCodeSkills: flags.disableClaudeCodeSkills,
          directory: ctx.directory,
          worktree: ctx.worktree,
        })
      }),
    )
    const state = yield* InstanceState.make(
      Effect.fn("Skill.state")(function* (ctx) {
        const s: State = { skills: {}, dirs: new Set(), matches: new Set() }
        // Register the built-in skill BEFORE disk discovery so a user-disk
        // skill with the same name can override it.
        s.skills[CUSTOMIZE_NECODE_SKILL_NAME] = {
          name: CUSTOMIZE_NECODE_SKILL_NAME,
          description: CUSTOMIZE_NECODE_SKILL_DESCRIPTION,
          location: "<built-in>",
          content: CUSTOMIZE_NECODE_SKILL_BODY,
          source: "builtin",
          scope: "builtin",
          canUninstall: false,
        }
        const sources = yield* InstanceState.get(discovered)
        const managed = yield* SkillManaged.entries({ fs: fsys, globalConfigDir: global.config }, ctx).pipe(
          Effect.catch((error) =>
            Effect.logError("failed to read managed Skill metadata", { error }).pipe(Effect.as([])),
          ),
        )
        const origin = (name: string, location: string): Origin => {
          const installed = managed.find((item) => item.name === name && FSUtil.contains(item.path, location))
          if (installed) {
            return {
              source: "managed",
              scope: installed.scope,
              canUninstall: true,
              installSource: installed.source,
            }
          }
          if (sources.pluginRoots.some((root) => FSUtil.contains(root, location))) {
            return { source: "plugin", scope: "plugin", canUninstall: false }
          }
          if (FSUtil.contains(path.join(global.cache, "skills"), location)) {
            return { source: "url", scope: "global", canUninstall: false }
          }
          const normalized = location.replaceAll("\\", "/")
          if (normalized.includes("/.claude/skills/") || normalized.includes("/.agents/skills/")) {
            return {
              source: "external",
              scope: FSUtil.contains(global.home, location) ? "global" : "local",
              canUninstall: false,
            }
          }
          return {
            source: "configured",
            scope: FSUtil.contains(ctx.worktree, location) ? "local" : "global",
            canUninstall: false,
          }
        }
        yield* loadSkills(s, sources, events, origin)
        return s
      }),
    )

    const reload = Effect.fn("Skill.reload")(function* () {
      yield* InstanceState.invalidate(discovered)
      const next = yield* InstanceState.get(discovered)
      const current = yield* InstanceState.get(state)
      if (next.matches.length === current.matches.size && next.matches.every((match) => current.matches.has(match))) {
        return current
      }
      yield* InstanceState.invalidate(state)
      return yield* InstanceState.get(state)
    })

    const get = Effect.fn("Skill.get")(function* (name: string) {
      const s = yield* reload()
      return s.skills[name]
    })

    const require = Effect.fn("Skill.require")(function* (name: string) {
      const s = yield* reload()
      const info = s.skills[name]
      if (info) return info
      return yield* new NotFoundError({ name, available: Object.keys(s.skills).toSorted() })
    })

    const all = Effect.fn("Skill.all")(function* () {
      const s = yield* reload()
      return Object.values(s.skills)
    })

    const dirs = Effect.fn("Skill.dirs")(function* () {
      yield* reload()
      return (yield* InstanceState.get(discovered)).dirs
    })

    const available = Effect.fn("Skill.available")(function* (agent?: Agent.Info) {
      const s = yield* reload()
      const list = Object.values(s.skills).toSorted((a, b) => a.name.localeCompare(b.name))
      if (!agent) return list
      return list.filter((skill) => Permission.evaluate("skill", skill.name, agent.permission).action !== "deny")
    })

    return Service.of({ get, require, all, dirs, available })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(Discovery.defaultLayer),
  Layer.provide(Config.defaultLayer),
  Layer.provide(EventV2Bridge.defaultLayer),
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Global.layer),
  Layer.provide(RuntimeFlags.defaultLayer),
  Layer.provide(Plugin.defaultLayer),
)

export function fmt(list: Info[], opts: { verbose: boolean }) {
  const described = list.filter((skill) => skill.description !== undefined)
  if (described.length === 0) return [...SKILL_CATALOG_GUIDANCE, "No skills are currently available."].join("\n")
  if (opts.verbose) {
    return [
      ...SKILL_CATALOG_GUIDANCE,
      "<available_skills>",
      ...described
        .toSorted((a, b) => a.name.localeCompare(b.name))
        .flatMap((skill) => [
          "  <skill>",
          `    <name>${skill.name}</name>`,
          `    <description>${skill.description}</description>`,
          `    <location>${pathToFileURL(skill.location).href}</location>`,
          "  </skill>",
        ]),
      "</available_skills>",
    ].join("\n")
  }

  return [
    ...SKILL_CATALOG_GUIDANCE,
    "## Available Skills",
    ...described
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .map((skill) => `- **${skill.name}**: ${skill.description}`),
  ].join("\n")
}

export const node = LayerNode.make(layer, [
  Discovery.node,
  Config.node,
  EventV2Bridge.node,
  FSUtil.node,
  Global.node,
  RuntimeFlags.node,
  Plugin.node,
])

export * as Skill from "."

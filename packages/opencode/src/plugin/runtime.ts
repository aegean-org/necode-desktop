import type { Config as PluginConfig, Hooks, PluginInput, PluginModule, WorkspaceAdapter as PluginWorkspaceAdapter } from "@opencode-ai/plugin"
import { createOpencodeClient } from "@opencode-ai/sdk"
import { NamedError } from "@opencode-ai/core/util/error"
import { Effect } from "effect"
import type { Config } from "@/config/config"
import { ConfigPlugin } from "@/config/plugin"
import { registerAdapter } from "@/control-plane/adapters"
import type { WorkspaceAdapter } from "@/control-plane/types"
import { EffectBridge } from "@/effect/bridge"
import type { RuntimeFlags } from "@/effect/runtime-flags"
import type { EventV2Bridge } from "@/event-v2-bridge"
import type { InstanceContext } from "@/project/instance-context"
import { ServerAuth } from "@/server/auth"
import { Session } from "@/session/session"
import { errorMessage } from "@/util/error"
import { BuiltinPlugins } from "./builtin"
import { PluginCatalog } from "./catalog"
import { PluginLoader } from "./loader"
import { PluginRegistry } from "./registry"
import { readPluginId, readV1Plugin, resolvePluginId } from "./shared"

type Unit = { catalog: PluginCatalog.Entry; hooks: Hooks[] }

export namespace PluginRuntime {
  /** Loaded hooks and their corresponding management entries for one instance. */
  export type State = { hooks: Hooks[]; entries: PluginRegistry.Entry[] }

  /** Resolves, initializes, configures, and observes all plugins for an instance. */
  export const load = Effect.fn("PluginRuntime.load")(function* (input: {
    ctx: InstanceContext
    events: EventV2Bridge.Service["Service"]
    config: Config.Interface
    flags: RuntimeFlags.Info
  }) {
    const cfg = yield* input.config.get()
    const pluginInput = yield* createInput(input.ctx)
    const bridge = yield* EffectBridge.make()
    const units: Unit[] = []
    const entries: PluginRegistry.Entry[] = []
    const publish = (entry: PluginRegistry.Entry) => {
      if (!entry.error) return
      bridge.fork(
        input.events.publish(Session.Event.Error, {
          error: new NamedError.Unknown({ message: `Plugin ${entry.name} ${entry.error.stage}: ${entry.error.message}` }).toObject(),
        }),
      )
    }

    if (!input.flags.disableDefaultPlugins) {
      yield* loadBuiltins(BuiltinPlugins.list(input.flags), cfg.plugin_enabled ?? {}, pluginInput, units, entries, publish)
    }
    if (!input.flags.pure) {
      yield* loadExternal(cfg.plugin_origins ?? [], cfg.plugin_enabled ?? {}, pluginInput, input.config, units, entries, publish)
    }

    const active = yield* activate(units, cfg, entries, publish)
    yield* listen(active, input.ctx.directory, input.events)
    return { hooks: active, entries }
  })
}

function createInput(ctx: InstanceContext) {
  return Effect.gen(function* () {
    const { Server } = yield* Effect.promise(() => import("../server/server"))
    const serverUrl = Server.url
    const input: PluginInput = {
      client: createOpencodeClient({
        baseUrl: serverUrl?.toString() ?? "http://localhost:4096",
        directory: ctx.directory,
        headers: ServerAuth.headers(),
        ...(serverUrl ? {} : { fetch: async (...args) => Server.Default().app.fetch(...args) }),
      }),
      project: ctx.project,
      worktree: ctx.worktree,
      directory: ctx.directory,
      experimental_workspace: {
        register(type: string, adapter: PluginWorkspaceAdapter) {
          registerAdapter(ctx.project.id, type, adapter as WorkspaceAdapter)
        },
      },
      get serverUrl() {
        return Server.url ?? new URL("http://localhost:4096")
      },
      // @ts-expect-error Bun is unavailable only in non-Bun embedding tests.
      $: typeof Bun === "undefined" ? undefined : Bun.$,
    }
    return input
  })
}

function loadBuiltins(
  definitions: readonly PluginCatalog.Builtin[],
  enabled: Record<string, boolean>,
  input: PluginInput,
  units: Unit[],
  entries: PluginRegistry.Entry[],
  publish: (entry: PluginRegistry.Entry) => void,
) {
  return Effect.forEach(
    definitions,
    (definition) =>
      Effect.gen(function* () {
        const catalog = yield* Effect.promise(() =>
          PluginCatalog.resolveBuiltin(
            definition,
            isEnabled(enabled, definition.key, definition.canDisable, definition.defaultEnabled),
          ),
        )
        if (!catalog.enabled) return entries.push(PluginRegistry.disabled(catalog))
        if (catalog.failure) return entries.push(PluginRegistry.failed(catalog))
        const result = yield* outcome(Effect.tryPromise({ try: () => definition.server(input), catch: errorMessage }))
        if (result.ok) return units.push({ catalog, hooks: [result.value] })
        const entry = PluginRegistry.failed(catalog, { stage: "initialize", message: result.error })
        entries.push(entry)
        publish(entry)
      }),
    { discard: true },
  )
}

function loadExternal(
  origins: readonly ConfigPlugin.Origin[],
  enabled: Record<string, boolean>,
  input: PluginInput,
  config: Config.Interface,
  units: Unit[],
  entries: PluginRegistry.Entry[],
  publish: (entry: PluginRegistry.Entry) => void,
) {
  return Effect.gen(function* () {
    if (origins.length) yield* config.waitForDependencies()
    for (const origin of origins) {
      if (PluginLoader.plan(origin.spec).deprecated) continue
      const key = ConfigPlugin.key(origin.spec)
      const catalog = yield* Effect.promise(() => PluginCatalog.resolveExternal({ origin, enabled: isEnabled(enabled, key, true) }))
      if (!catalog.enabled) {
        entries.push(PluginRegistry.disabled(catalog))
        continue
      }
      const resolved = catalog.resolved
      if (catalog.failure || !resolved) {
        const entry = PluginRegistry.failed(catalog)
        entries.push(entry)
        publish(entry)
        continue
      }
      const loaded = yield* Effect.promise(() => PluginLoader.load(resolved))
      if (!loaded.ok) {
        const entry = PluginRegistry.failed(catalog, { stage: "load", message: errorMessage(loaded.error) })
        entries.push(entry)
        publish(entry)
        continue
      }
      const hooks = yield* outcome(Effect.tryPromise({ try: () => applyPlugin(loaded.value, input), catch: errorMessage }))
      if (hooks.ok) {
        units.push({ catalog, hooks: hooks.value })
        continue
      }
      const entry = PluginRegistry.failed(catalog, { stage: "initialize", message: hooks.error })
      entries.push(entry)
      publish(entry)
    }
  })
}

async function applyPlugin(load: PluginLoader.Loaded, input: PluginInput) {
  const plugin = readV1Plugin(load.mod, load.spec, "server", "detect")
  if (plugin) {
    await resolvePluginId(load.source, load.spec, load.target, readPluginId(plugin.id, load.spec), load.pkg)
    return [(await (plugin as PluginModule).server(input, load.options)) as Hooks]
  }
  return Promise.all(getLegacyPlugins(load.mod).map((server) => server(input, load.options)))
}

function getLegacyPlugins(mod: Record<string, unknown>) {
  const seen = new Set<unknown>()
  return Object.values(mod).flatMap((value) => {
    if (seen.has(value)) return []
    seen.add(value)
    if (typeof value === "function") return [value as import("@opencode-ai/plugin").Plugin]
    if (!value || typeof value !== "object" || !("server" in value) || typeof value.server !== "function") return []
    return [value.server as import("@opencode-ai/plugin").Plugin]
  })
}

function activate(
  units: readonly Unit[],
  cfg: unknown,
  entries: PluginRegistry.Entry[],
  publish: (entry: PluginRegistry.Entry) => void,
) {
  return Effect.gen(function* () {
    const active: Hooks[] = []
    for (const unit of units) {
      const configured = yield* configure(unit.hooks, cfg)
      if (!configured.ok) {
        const entry = PluginRegistry.failed(unit.catalog, { stage: "initialize", message: configured.error })
        entries.push(entry)
        publish(entry)
        yield* dispose(unit.hooks)
        continue
      }
      active.push(...unit.hooks)
      entries.push(PluginRegistry.active(unit.catalog, unit.hooks))
    }
    return active
  })
}

function configure(hooks: readonly Hooks[], cfg: unknown) {
  return Effect.forEach(
    hooks,
    (hook) => Effect.tryPromise({ try: () => Promise.resolve(hook.config?.(cfg as PluginConfig)), catch: errorMessage }),
    { discard: true },
  ).pipe(outcome)
}

function listen(hooks: readonly Hooks[], directory: string, events: EventV2Bridge.Service["Service"]) {
  return Effect.gen(function* () {
    const unsubscribe = yield* events.listen((event) => {
      if (event.location?.directory !== directory) return Effect.void
      return Effect.sync(() => hooks.forEach((hook) => void hook.event?.({ event: { id: event.id, type: event.type, properties: event.data } as never })))
    })
    yield* Effect.addFinalizer(() => unsubscribe)
    yield* Effect.addFinalizer(() => dispose(hooks))
  })
}

function dispose(hooks: readonly Hooks[]) {
  return Effect.forEach(
    hooks,
    (hook) => Effect.tryPromise({ try: () => Promise.resolve(hook.dispose?.()), catch: errorMessage }).pipe(Effect.ignore),
    { discard: true },
  )
}

function isEnabled(enabled: Record<string, boolean>, key: string, canDisable: boolean, defaultEnabled = true) {
  if (!canDisable) return true
  return Object.hasOwn(enabled, key) ? enabled[key] !== false : defaultEnabled
}

function outcome<A>(self: Effect.Effect<A, string>) {
  return self.pipe(
    Effect.match({
      onFailure: (error) => ({ ok: false as const, error }),
      onSuccess: (value) => ({ ok: true as const, value }),
    }),
  )
}

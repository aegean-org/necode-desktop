import { FSUtil } from "@opencode-ai/core/fs-util"
import { Global } from "@opencode-ai/core/global"
import { EffectFlock } from "@opencode-ai/core/util/effect-flock"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceState } from "@/effect/instance-state"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { Plugin } from "@/plugin"
import { BuiltinPlugins } from "@/plugin/builtin"
import { PluginConfig } from "@/plugin/config"
import { InstanceHttpApi } from "../api"
import { markInstanceForDisposal } from "../lifecycle"

/** Provides runtime and persistent plugin management handlers. */
export const pluginHandlers = HttpApiBuilder.group(InstanceHttpApi, "plugin", (handlers) =>
  Effect.gen(function* () {
    const plugin = yield* Plugin.Service
    const config = PluginConfig.make({
      fs: yield* FSUtil.Service,
      flock: yield* EffectFlock.Service,
      globalConfigDir: Global.Path.config,
      builtins: BuiltinPlugins.list(yield* RuntimeFlags.Service),
    })
    return handlers
      .handle("list", makeListHandler(plugin))
      .handle("configList", makeConfigListHandler(config))
      .handle("configInstall", makeConfigInstallHandler(config))
      .handle("configUpdate", makeConfigUpdateHandler(config))
      .handle("configRemove", makeConfigRemoveHandler(config))
  }),
)

function makeListHandler(plugin: Plugin.Interface) {
  return Effect.fn("PluginHttpApi.list")(function* () {
    return yield* plugin.entries()
  })
}

function makeConfigListHandler(config: PluginConfig.Interface) {
  return Effect.fn("PluginHttpApi.configList")(function* () {
    return yield* config.list(yield* InstanceState.context)
  })
}

function makeConfigInstallHandler(config: PluginConfig.Interface) {
  return Effect.fn("PluginHttpApi.configInstall")(function* (ctx: { payload: typeof PluginConfig.InstallInput.Type }) {
    const instance = yield* InstanceState.context
    const entries = yield* config.install(instance, ctx.payload)
    yield* markInstanceForDisposal(instance)
    return entries
  })
}

function makeConfigUpdateHandler(config: PluginConfig.Interface) {
  return Effect.fn("PluginHttpApi.configUpdate")(function* (ctx: {
    params: { pluginKey: string }
    payload: typeof PluginConfig.UpdateInput.Type
  }) {
    const instance = yield* InstanceState.context
    const entries = yield* config.setEnabled(instance, ctx.params.pluginKey, ctx.payload.enabled)
    yield* markInstanceForDisposal(instance)
    return entries
  })
}

function makeConfigRemoveHandler(config: PluginConfig.Interface) {
  return Effect.fn("PluginHttpApi.configRemove")(function* (ctx: { params: { pluginKey: string } }) {
    const instance = yield* InstanceState.context
    const entries = yield* config.remove(instance, ctx.params.pluginKey)
    yield* markInstanceForDisposal(instance)
    return entries
  })
}

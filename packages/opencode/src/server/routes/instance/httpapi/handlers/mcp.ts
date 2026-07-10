import { MCP } from "@/mcp"
import { MCPConfig } from "@/mcp/config"
import { InstanceState } from "@/effect/instance-state"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { Global } from "@opencode-ai/core/global"
import { Effect, Schema } from "effect"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { McpServerNotFoundError } from "../errors"
import { AddPayload, AuthCallbackPayload, StatusMap, UnsupportedOAuthError } from "../groups/mcp"
import { markInstanceForDisposal } from "../lifecycle"

export const mcpHandlers = HttpApiBuilder.group(InstanceHttpApi, "mcp", (handlers) =>
  Effect.gen(function* () {
    const mcp = yield* MCP.Service
    const fs = yield* FSUtil.Service
    const config = MCPConfig.make({ fs, globalConfigDir: Global.Path.config })

    return handlers
      .handle("status", makeStatusHandler(mcp))
      .handle("add", makeAddHandler(mcp))
      .handle("configList", makeConfigListHandler(config))
      .handle("configCreate", makeConfigCreateHandler(config))
      .handle("configUpdate", makeConfigUpdateHandler(config))
      .handle("configRemove", makeConfigRemoveHandler(config))
      .handle("authStart", makeAuthStartHandler(mcp))
      .handle("authCallback", makeAuthCallbackHandler(mcp))
      .handle("authAuthenticate", makeAuthAuthenticateHandler(mcp))
      .handle("authRemove", makeAuthRemoveHandler(mcp))
      .handle("connect", makeConnectHandler(mcp))
      .handle("disconnect", makeDisconnectHandler(mcp))
  }),
)

function makeStatusHandler(mcp: MCP.Interface) {
  return Effect.fn("McpHttpApi.status")(function* () {
    return yield* mcp.status()
  })
}

function makeAddHandler(mcp: MCP.Interface) {
  return Effect.fn("McpHttpApi.add")(function* (ctx: { payload: typeof AddPayload.Type }) {
    const result = (yield* mcp.add(ctx.payload.name, ctx.payload.config)).status
    return yield* Schema.decodeUnknownEffect(StatusMap)(
      "status" in result ? { [ctx.payload.name]: result } : result,
    ).pipe(Effect.mapError(() => new HttpApiError.BadRequest({})))
  })
}

function makeConfigListHandler(config: MCPConfig.Interface) {
  return Effect.fn("McpHttpApi.configList")(function* () {
    return yield* config.list(yield* InstanceState.context)
  })
}

function makeConfigCreateHandler(config: MCPConfig.Interface) {
  return Effect.fn("McpHttpApi.configCreate")(function* (ctx: { payload: typeof MCPConfig.CreateInput.Type }) {
    const instance = yield* InstanceState.context
    const entries = yield* config.create(instance, ctx.payload)
    yield* markInstanceForDisposal(instance)
    return entries
  })
}

function makeConfigUpdateHandler(config: MCPConfig.Interface) {
  return Effect.fn("McpHttpApi.configUpdate")(function* (ctx: {
    params: { entryID: string }
    payload: typeof MCPConfig.UpdateInput.Type
  }) {
    const instance = yield* InstanceState.context
    const entries = yield* config.update(instance, ctx.params.entryID, ctx.payload)
    yield* markInstanceForDisposal(instance)
    return entries
  })
}

function makeConfigRemoveHandler(config: MCPConfig.Interface) {
  return Effect.fn("McpHttpApi.configRemove")(function* (ctx: { params: { entryID: string } }) {
    const instance = yield* InstanceState.context
    const entries = yield* config.remove(instance, ctx.params.entryID)
    yield* markInstanceForDisposal(instance)
    return entries
  })
}

function makeAuthStartHandler(mcp: MCP.Interface) {
  return Effect.fn("McpHttpApi.authStart")(function* (ctx: { params: { name: string } }) {
    return yield* Effect.gen(function* () {
      if (!(yield* mcp.supportsOAuth(ctx.params.name))) {
        return yield* new UnsupportedOAuthError({ error: `MCP server ${ctx.params.name} does not support OAuth` })
      }
      return yield* mcp.startAuth(ctx.params.name)
    }).pipe(Effect.catchTag("MCP.NotFoundError", (error) => Effect.fail(toNotFound(error))))
  })
}

function makeAuthCallbackHandler(mcp: MCP.Interface) {
  return Effect.fn("McpHttpApi.authCallback")(function* (ctx: {
    params: { name: string }
    payload: typeof AuthCallbackPayload.Type
  }) {
    return yield* mcp
      .finishAuth(ctx.params.name, ctx.payload.code)
      .pipe(Effect.catchTag("MCP.NotFoundError", (error) => Effect.fail(toNotFound(error))))
  })
}

function makeAuthAuthenticateHandler(mcp: MCP.Interface) {
  return Effect.fn("McpHttpApi.authAuthenticate")(function* (ctx: { params: { name: string } }) {
    return yield* Effect.gen(function* () {
      if (!(yield* mcp.supportsOAuth(ctx.params.name))) {
        return yield* new UnsupportedOAuthError({ error: `MCP server ${ctx.params.name} does not support OAuth` })
      }
      return yield* mcp.authenticate(ctx.params.name)
    }).pipe(Effect.catchTag("MCP.NotFoundError", (error) => Effect.fail(toNotFound(error))))
  })
}

function makeAuthRemoveHandler(mcp: MCP.Interface) {
  return Effect.fn("McpHttpApi.authRemove")(function* (ctx: { params: { name: string } }) {
    const status = yield* mcp.status()
    if (!(ctx.params.name in status)) {
      return yield* new McpServerNotFoundError({
        name: ctx.params.name,
        message: `MCP server not found: ${ctx.params.name}`,
      })
    }
    yield* mcp.removeAuth(ctx.params.name)
    return { success: true as const }
  })
}

function makeConnectHandler(mcp: MCP.Interface) {
  return Effect.fn("McpHttpApi.connect")(function* (ctx: { params: { name: string } }) {
    yield* mcp
      .connect(ctx.params.name)
      .pipe(Effect.catchTag("MCP.NotFoundError", (error) => Effect.fail(toNotFound(error))))
    return true
  })
}

function makeDisconnectHandler(mcp: MCP.Interface) {
  return Effect.fn("McpHttpApi.disconnect")(function* (ctx: { params: { name: string } }) {
    yield* mcp
      .disconnect(ctx.params.name)
      .pipe(Effect.catchTag("MCP.NotFoundError", (error) => Effect.fail(toNotFound(error))))
    return true
  })
}

function toNotFound(error: MCP.NotFoundError) {
  return new McpServerNotFoundError({ name: error.name, message: `MCP server not found: ${error.name}` })
}

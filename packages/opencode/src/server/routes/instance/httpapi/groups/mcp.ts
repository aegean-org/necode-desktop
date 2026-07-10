import { MCP } from "@/mcp"
import { MCPConfig } from "@/mcp/config"
import { ConfigMCPV1 } from "@opencode-ai/core/v1/config/mcp"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { McpServerNotFoundError } from "../errors"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery } from "../middleware/workspace-routing"
import { described } from "./metadata"

export const AddPayload = Schema.Struct({
  name: Schema.String,
  config: ConfigMCPV1.Info,
})

export const StatusMap = Schema.Record(Schema.String, MCP.Status)
export const AuthStartResponse = Schema.Struct({
  authorizationUrl: Schema.String,
  oauthState: Schema.String,
})
export const AuthCallbackPayload = Schema.Struct({
  code: Schema.String,
})
export const AuthRemoveResponse = Schema.Struct({
  success: Schema.Literal(true),
})
export class UnsupportedOAuthError extends Schema.ErrorClass<UnsupportedOAuthError>("McpUnsupportedOAuthError")(
  { error: Schema.String },
  { httpApiStatus: 400 },
) {}

export const McpPaths = {
  status: "/mcp",
  config: "/mcp/config",
  configEntry: "/mcp/config/:entryID",
  auth: "/mcp/:name/auth",
  authCallback: "/mcp/:name/auth/callback",
  authAuthenticate: "/mcp/:name/auth/authenticate",
  connect: "/mcp/:name/connect",
  disconnect: "/mcp/:name/disconnect",
} as const

export const McpApi = HttpApi.make("mcp")
  .add(
    HttpApiGroup.make("mcp")
      .add(
        HttpApiEndpoint.get("status", McpPaths.status, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Record(Schema.String, MCP.Status), "MCP server status"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "mcp.status",
            summary: "Get MCP status",
            description: "Get the status of all Model Context Protocol (MCP) servers.",
          }),
        ),
        HttpApiEndpoint.post("add", McpPaths.status, {
          query: WorkspaceRoutingQuery,
          payload: AddPayload,
          success: described(StatusMap, "MCP server added successfully"),
          error: HttpApiError.BadRequest,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "mcp.add",
            summary: "Add MCP server",
            description: "Dynamically add a runtime-only Model Context Protocol (MCP) server; it is not persisted.",
          }),
        ),
        HttpApiEndpoint.get("configList", McpPaths.config, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(MCPConfig.Entry), "Persistent MCP configuration entries"),
          error: [MCPConfig.InvalidError, MCPConfig.PersistenceError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "mcp.config.list",
            summary: "List persistent MCP configuration",
            description: "List persistent Model Context Protocol (MCP) configuration entries.",
          }),
        ),
        HttpApiEndpoint.post("configCreate", McpPaths.config, {
          query: WorkspaceRoutingQuery,
          payload: MCPConfig.CreateInput,
          success: described(Schema.Array(MCPConfig.Entry), "Persistent MCP configuration entries"),
          error: [MCPConfig.InvalidError, MCPConfig.ConflictError, MCPConfig.PersistenceError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "mcp.config.create",
            summary: "Create persistent MCP configuration",
            description: "Create a persistent Model Context Protocol (MCP) configuration entry.",
          }),
        ),
        HttpApiEndpoint.put("configUpdate", McpPaths.configEntry, {
          params: { entryID: Schema.String },
          query: WorkspaceRoutingQuery,
          payload: MCPConfig.UpdateInput,
          success: described(Schema.Array(MCPConfig.Entry), "Persistent MCP configuration entries"),
          error: [MCPConfig.InvalidError, MCPConfig.NotFoundError, MCPConfig.ConflictError, MCPConfig.PersistenceError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "mcp.config.update",
            summary: "Update persistent MCP configuration",
            description: "Update a persistent Model Context Protocol (MCP) configuration entry.",
          }),
        ),
        HttpApiEndpoint.delete("configRemove", McpPaths.configEntry, {
          params: { entryID: Schema.String },
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(MCPConfig.Entry), "Persistent MCP configuration entries"),
          error: [MCPConfig.InvalidError, MCPConfig.NotFoundError, MCPConfig.PersistenceError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "mcp.config.remove",
            summary: "Remove persistent MCP configuration",
            description: "Remove a persistent Model Context Protocol (MCP) configuration entry.",
          }),
        ),
        HttpApiEndpoint.post("authStart", McpPaths.auth, {
          params: { name: Schema.String },
          query: WorkspaceRoutingQuery,
          success: described(AuthStartResponse, "OAuth flow started"),
          error: [UnsupportedOAuthError, McpServerNotFoundError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "mcp.auth.start",
            summary: "Start MCP OAuth",
            description: "Start OAuth authentication flow for a Model Context Protocol (MCP) server.",
          }),
        ),
        HttpApiEndpoint.post("authCallback", McpPaths.authCallback, {
          params: { name: Schema.String },
          query: WorkspaceRoutingQuery,
          payload: AuthCallbackPayload,
          success: described(MCP.Status, "OAuth authentication completed"),
          error: [HttpApiError.BadRequest, McpServerNotFoundError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "mcp.auth.callback",
            summary: "Complete MCP OAuth",
            description:
              "Complete OAuth authentication for a Model Context Protocol (MCP) server using the authorization code.",
          }),
        ),
        HttpApiEndpoint.post("authAuthenticate", McpPaths.authAuthenticate, {
          params: { name: Schema.String },
          query: WorkspaceRoutingQuery,
          success: described(MCP.Status, "OAuth authentication completed"),
          error: [UnsupportedOAuthError, McpServerNotFoundError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "mcp.auth.authenticate",
            summary: "Authenticate MCP OAuth",
            description: "Start OAuth flow and wait for callback (opens browser).",
          }),
        ),
        HttpApiEndpoint.delete("authRemove", McpPaths.auth, {
          params: { name: Schema.String },
          query: WorkspaceRoutingQuery,
          success: described(AuthRemoveResponse, "OAuth credentials removed"),
          error: McpServerNotFoundError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "mcp.auth.remove",
            summary: "Remove MCP OAuth",
            description: "Remove OAuth credentials for an MCP server.",
          }),
        ),
        HttpApiEndpoint.post("connect", McpPaths.connect, {
          params: { name: Schema.String },
          query: WorkspaceRoutingQuery,
          success: described(Schema.Boolean, "MCP server connected successfully"),
          error: McpServerNotFoundError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "mcp.connect",
            description: "Connect an MCP server.",
          }),
        ),
        HttpApiEndpoint.post("disconnect", McpPaths.disconnect, {
          params: { name: Schema.String },
          query: WorkspaceRoutingQuery,
          success: described(Schema.Boolean, "MCP server disconnected successfully"),
          error: McpServerNotFoundError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "mcp.disconnect",
            description: "Disconnect an MCP server.",
          }),
        ),
      )
      .annotateMerge(
        OpenApi.annotations({
          title: "mcp",
          description: "Experimental HttpApi MCP routes.",
        }),
      )
      .middleware(InstanceContextMiddleware)
      .middleware(WorkspaceRoutingMiddleware)
      .middleware(Authorization),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "opencode experimental HttpApi",
      version: "0.0.1",
      description: "Experimental HttpApi surface for selected instance routes.",
    }),
  )

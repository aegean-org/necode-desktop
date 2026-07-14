import { PluginConfig } from "@/plugin/config"
import { PluginRegistry } from "@/plugin/registry"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery } from "../middleware/workspace-routing"
import { described } from "./metadata"

/** Stable plugin management route paths shared by tests and generated clients. */
export const PluginPaths = {
  status: "/plugin",
  config: "/plugin/config",
  entry: "/plugin/config/:pluginKey",
} as const

/** Typed runtime and persistent plugin management HTTP surface. */
export const PluginApi = HttpApi.make("plugin")
  .add(
    HttpApiGroup.make("plugin")
      .add(
        HttpApiEndpoint.get("list", PluginPaths.status, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(PluginRegistry.Entry), "Plugin runtime status"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "plugin.list",
            summary: "List plugin status",
            description: "List built-in and configured plugins with their current runtime status.",
          }),
        ),
        HttpApiEndpoint.get("configList", PluginPaths.config, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(PluginConfig.Entry), "Persistent plugin configuration"),
          error: [PluginConfig.InvalidError, PluginConfig.PersistenceError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "plugin.config.list",
            summary: "List plugin configuration",
            description: "List manageable plugin installations and enablement state.",
          }),
        ),
        HttpApiEndpoint.post("configInstall", PluginPaths.config, {
          query: WorkspaceRoutingQuery,
          payload: PluginConfig.InstallInput,
          success: described(Schema.Array(PluginConfig.Entry), "Persistent plugin configuration"),
          error: [
            PluginConfig.InvalidError,
            PluginConfig.ConflictError,
            PluginConfig.InstallError,
            PluginConfig.PersistenceError,
          ],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "plugin.config.install",
            summary: "Install plugin",
            description: "Install an npm plugin or register a local plugin in persistent configuration.",
          }),
        ),
        HttpApiEndpoint.put("configUpdate", PluginPaths.entry, {
          params: { pluginKey: Schema.String },
          query: WorkspaceRoutingQuery,
          payload: PluginConfig.UpdateInput,
          success: described(Schema.Array(PluginConfig.Entry), "Persistent plugin configuration"),
          error: [
            PluginConfig.InvalidError,
            PluginConfig.NotFoundError,
            PluginConfig.ImmutableError,
            PluginConfig.PersistenceError,
          ],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "plugin.config.update",
            summary: "Update plugin enablement",
            description: "Persist the enabled state for a manageable plugin.",
          }),
        ),
        HttpApiEndpoint.delete("configRemove", PluginPaths.entry, {
          params: { pluginKey: Schema.String },
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(PluginConfig.Entry), "Persistent plugin configuration"),
          error: [
            PluginConfig.InvalidError,
            PluginConfig.NotFoundError,
            PluginConfig.BuiltinRemovalError,
            PluginConfig.PersistenceError,
          ],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "plugin.config.remove",
            summary: "Remove plugin",
            description: "Remove an external plugin from persistent configuration.",
          }),
        ),
      )
      .annotateMerge(OpenApi.annotations({ title: "plugin", description: "Plugin management routes." }))
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

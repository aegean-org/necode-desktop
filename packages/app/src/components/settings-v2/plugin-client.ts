import type { PluginConfigEntry, PluginEntry } from "@opencode-ai/sdk/v2/client"
import type { ServerSDK } from "@/context/server-sdk"

type ScopedServerSDK = Pick<ServerSDK, "createClient">

/** Creates a directory-scoped adapter over the generated plugin management SDK. */
export function pluginClient(directory: string, serverSDK: ScopedServerSDK) {
  if (!directory) throw new Error("No project directory available for plugin management")
  const client = serverSDK.createClient({ directory, throwOnError: true })
  return {
    list: async (): Promise<PluginEntry[]> => (await client.plugin.list()).data ?? [],
    config: async (): Promise<PluginConfigEntry[]> => (await client.plugin.config.list()).data ?? [],
    install: async (spec: string, scope: "local" | "global") =>
      (await client.plugin.config.install({ spec, scope })).data ?? [],
    setEnabled: async (pluginKey: string, enabled: boolean) =>
      (await client.plugin.config.update({ pluginKey, enabled })).data ?? [],
    remove: async (pluginKey: string) => (await client.plugin.config.remove({ pluginKey })).data ?? [],
  }
}

import type { PluginEntry } from "@opencode-ai/sdk/v2/client"
import { useQuery } from "@tanstack/solid-query"
import { createMemo, type Accessor } from "solid-js"
import { useServer } from "@/context/server"
import { useServerSDK } from "@/context/server-sdk"

/** Loads project-scoped plugin registry state only while the status popover is visible. */
export function usePluginStatusQuery(shown: Accessor<boolean>) {
  const server = useServer()
  const serverSDK = useServerSDK()
  const directory = createMemo(() => server.projects.last() ?? server.projects.list()[0]?.worktree)
  return useQuery(() => ({
    queryKey: [serverSDK().scope, directory(), "status", "plugins"] as const,
    enabled: shown() && !!directory(),
    queryFn: async () => {
      const current = directory()
      if (!current) throw new Error("No project directory available for plugin status")
      return (await serverSDK().createClient({ directory: current, throwOnError: true }).plugin.list()).data ?? []
    },
  }))
}

/** Maps a runtime plugin state to the status-popover indicator class. */
export function pluginStatusClass(status: PluginEntry["status"]) {
  if (status === "active") return "bg-icon-success-base"
  if (status === "disabled") return "bg-icon-weak"
  return "bg-icon-critical-base"
}

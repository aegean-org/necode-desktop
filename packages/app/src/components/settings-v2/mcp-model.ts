import type { McpConfigEntry, McpLocalConfig, McpRemoteConfig, McpStatus } from "@opencode-ai/sdk/v2/client"
import { mcpDisplayName, sortMcpNames } from "../ne-mcp"

/** One persistent MCP entry prepared for the desktop management list. */
export type McpManagementRow = {
  readonly id: string
  readonly name: string
  readonly displayName: string
  readonly scope: "builtin" | "project" | "global"
  readonly config: McpLocalConfig | McpRemoteConfig
  readonly status?: McpStatus["status"]
  readonly error?: string
  readonly overriddenBy?: "project" | "global"
  readonly canManage: boolean
  readonly canToggle: boolean
}

/** Returns whether the current platform may request persistent MCP configuration. */
export function desktopMcpManagementEnabled(platform: string) {
  return platform === "desktop"
}

/** Converts persistent configuration and runtime status into sorted management rows. */
export function mcpManagementRows(
  entries: readonly McpConfigEntry[],
  statuses: Readonly<Record<string, McpStatus>>,
): McpManagementRow[] {
  const names = [...new Set(sortMcpNames(entries.map((entry) => entry.name)))]
  const rank = new Map(names.map((name, index) => [name, index]))
  return entries
    .slice()
    .sort((a, b) => rank.get(a.name)! - rank.get(b.name)!)
    .map((entry) => managementRow(entry, statuses[entry.name]))
}

function managementRow(entry: McpConfigEntry, status: McpStatus | undefined): McpManagementRow {
  return {
    id: entry.id,
    name: entry.name,
    displayName: mcpDisplayName(entry.name),
    scope: entry.scope,
    config: entry.config,
    ...(status ? { status: status.status } : {}),
    ...(status && "error" in status ? { error: status.error } : {}),
    ...(entry.overriddenBy ? { overriddenBy: entry.overriddenBy } : {}),
    canManage: entry.scope !== "builtin" && !entry.readonly,
    canToggle: entry.effective && status !== undefined,
  }
}

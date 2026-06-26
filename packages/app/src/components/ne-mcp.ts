import type { McpStatus } from "@opencode-ai/sdk/v2/client"

const NE_MCP_ORDER = ["noteexpress", "qingtibase"] as const
const UNKNOWN_MCP_RANK = Number.MAX_SAFE_INTEGER

const neMcpNames = new Map<string, string>([
  ["noteexpress", "NoteExpress"],
  ["qingtibase", "Qingti Base"],
])

const neMcpRank = new Map<string, number>(NE_MCP_ORDER.map((name, index) => [name, index]))

const statusLabels = {
  connected: "mcp.status.connected",
  failed: "mcp.status.failed",
  needs_auth: "mcp.status.needs_auth",
  needs_client_registration: "mcp.status.needs_client_registration",
  disabled: "mcp.status.disabled",
} as const

type McpStatusLike = {
  status: McpStatus["status"]
  error?: string
}

/**
 * Returns the product-facing name for an MCP server.
 */
export function mcpDisplayName(name: string) {
  return neMcpNames.get(name) ?? name
}

/**
 * Sorts NE built-in MCP servers before user-defined MCP servers.
 */
export function sortMcpNames(names: readonly string[]) {
  return names.slice().sort((a, b) => {
    const rank = (neMcpRank.get(a) ?? UNKNOWN_MCP_RANK) - (neMcpRank.get(b) ?? UNKNOWN_MCP_RANK)
    if (rank !== 0) return rank
    return mcpDisplayName(a).localeCompare(mcpDisplayName(b))
  })
}

/**
 * Maps an MCP status value to its localization key.
 */
export function statusLabelKey(status: McpStatus["status"] | undefined) {
  if (!status) return
  return statusLabels[status]
}

/**
 * Converts MCP status map data into sorted display rows.
 */
export function mcpDisplayItems(statuses: Record<string, McpStatusLike>) {
  return sortMcpNames(Object.keys(statuses)).map((name) => {
    const item = statuses[name]
    return {
      name,
      displayName: mcpDisplayName(name),
      status: item.status,
      statusLabelKey: statusLabelKey(item.status),
      ...(item.error ? { error: item.error } : {}),
    }
  })
}

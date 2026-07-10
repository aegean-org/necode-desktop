import type { ConfigMCPV1 } from "@opencode-ai/core/v1/config/mcp"

type McpConfig = Record<string, ConfigMCPV1.Info>

/** Stable names reserved for NE-provided MCP servers. */
export const BUILTIN_MCP_NAMES = ["noteexpress", "qingtibase"] as const

/** Returns whether a name is reserved for an NE-provided MCP server. */
export function isBuiltinMcp(name: string) {
  return BUILTIN_MCP_NAMES.includes(name as (typeof BUILTIN_MCP_NAMES)[number])
}

const QINGTI_PLATFORM_PACKAGES: Readonly<Record<string, string>> = {
  "win32-x64": "@aegean-org/qt-mcp-win32-x64",
  "linux-x64": "@aegean-org/qt-mcp-linux-x64",
  "darwin-x64": "@aegean-org/qt-mcp-darwin-x64",
  "darwin-arm64": "@aegean-org/qt-mcp-darwin-arm64",
}

/** Adds missing NE-provided MCP defaults without replacing user configuration. */
export function withNeDefaultMcp(config: McpConfig, platform = process.platform, arch = process.arch): McpConfig {
  const defaults: Record<(typeof BUILTIN_MCP_NAMES)[number], ConfigMCPV1.Info> = {
    noteexpress: {
      type: "local",
      command: ["npx", "-y", "@aegean-org/ne-mcp"],
    },
    qingtibase: {
      type: "local",
      command: buildQingtiMcpCommand(platform, arch),
    },
  }
  return BUILTIN_MCP_NAMES.reduce<McpConfig>(
    (result, name) => (Object.hasOwn(result, name) ? result : { ...result, [name]: defaults[name] }),
    { ...config },
  )
}

/** Builds the platform-specific Qingti MCP launch command. */
export function buildQingtiMcpCommand(platform = process.platform, arch = process.arch) {
  const packageName = QINGTI_PLATFORM_PACKAGES[`${platform}-${arch}`]
  if (!packageName) return ["npx", "-y", "@aegean-org/qt-mcp", "-transport", "stdio"]
  return ["npx", "-y", "--package", "@aegean-org/qt-mcp", "--package", packageName, "qt-mcp", "-transport", "stdio"]
}

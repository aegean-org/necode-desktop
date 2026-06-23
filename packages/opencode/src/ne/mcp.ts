import type { ConfigMCPV1 } from "@opencode-ai/core/v1/config/mcp"

type McpConfig = Record<string, ConfigMCPV1.Info>

const QINGTI_PLATFORM_PACKAGES: Readonly<Record<string, string>> = {
  "win32-x64": "@aegean-org/qt-mcp-win32-x64",
  "linux-x64": "@aegean-org/qt-mcp-linux-x64",
  "darwin-x64": "@aegean-org/qt-mcp-darwin-x64",
  "darwin-arm64": "@aegean-org/qt-mcp-darwin-arm64",
}

export function withNeDefaultMcp(config: McpConfig, platform = process.platform, arch = process.arch): McpConfig {
  return {
    ...config,
    noteexpress: config.noteexpress ?? {
      type: "local",
      command: ["npx", "-y", "@aegean-org/ne-mcp"],
    },
    qingtibase: config.qingtibase ?? {
      type: "local",
      command: buildQingtiMcpCommand(platform, arch),
    },
  }
}

export function buildQingtiMcpCommand(platform = process.platform, arch = process.arch) {
  const packageName = QINGTI_PLATFORM_PACKAGES[`${platform}-${arch}`]
  if (!packageName) return ["npx", "-y", "@aegean-org/qt-mcp", "-transport", "stdio"]
  return ["npx", "-y", "--package", "@aegean-org/qt-mcp", "--package", packageName, "qt-mcp", "-transport", "stdio"]
}

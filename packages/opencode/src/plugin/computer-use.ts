import type { Config, Plugin } from "@opencode-ai/plugin"
import { ComputerUse } from "@/ne/computer-use"

type Detect = () => Promise<ComputerUse.Status>

/** Creates the built-in adapter that exposes an external Cua Driver through MCP. */
export function createComputerUsePlugin(detect: Detect = ComputerUse.detect): Plugin {
  return async () => ({
    async config(config: Config) {
      if (config.mcp && Object.hasOwn(config.mcp, "cua-driver")) return
      const status = await detect()
      if (status.status !== "ready") throw new Error(ComputerUse.recovery(status))
      config.mcp = {
        ...config.mcp,
        "cua-driver": {
          type: "local",
          command: [status.path, "mcp"],
          enabled: true,
          timeout: 30_000,
        },
      }
    },
  })
}

export const ComputerUsePlugin = createComputerUsePlugin()

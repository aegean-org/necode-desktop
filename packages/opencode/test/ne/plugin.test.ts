import { expect, test } from "bun:test"
import type { Config } from "@opencode-ai/plugin"
import { NePlugin } from "../../src/ne/plugin"

test("NePlugin config injects default MCP servers without overwriting user entries", async () => {
  const hooks = await NePlugin({} as Parameters<typeof NePlugin>[0])
  const config: Config = {
    mcp: {
      noteexpress: {
        type: "local",
        command: ["custom-ne"],
      },
    },
  }

  await hooks.config?.(config)

  expect(config.provider).toBeUndefined()
  expect(config.mcp?.noteexpress).toEqual({
    type: "local",
    command: ["custom-ne"],
  })
  expect(config.mcp?.qingtibase).toBeDefined()
})

import { describe, expect, test } from "bun:test"
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { McpCatalog } from "@/mcp/catalog"

describe("McpCatalog.callTool", () => {
  test("returns successful structured MCP results", async () => {
    const calls: unknown[] = []
    const client = {
      callTool: async (...args: unknown[]) => {
        calls.push(args)
        return {
          content: [{ type: "text" as const, text: "ok" }],
          structuredContent: { ok: true },
        }
      },
    } as unknown as Client

    const result = await McpCatalog.callTool(client, "end_session", { session: "ses_123" }, 5_000)

    expect(result.content).toEqual([{ type: "text", text: JSON.stringify({ ok: true }) }])
    expect((calls[0] as unknown[])[0]).toEqual({ name: "end_session", arguments: { session: "ses_123" } })
  })

  test("throws the original MCP error text", async () => {
    const client = {
      callTool: async () => ({ content: [{ type: "text" as const, text: "session cleanup failed" }], isError: true }),
    } as unknown as Client

    expect(McpCatalog.callTool(client, "end_session", { session: "ses_123" }, 5_000)).rejects.toThrow(
      "session cleanup failed",
    )
  })
})

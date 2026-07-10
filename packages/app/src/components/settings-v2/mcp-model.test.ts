import { describe, expect, test } from "bun:test"
import type { McpConfigEntry, McpStatus } from "@opencode-ai/sdk/v2/client"
import { desktopMcpManagementEnabled, mcpManagementRows } from "./mcp-model"

describe("desktop MCP management model", () => {
  test("enables persistent MCP management only on desktop", () => {
    expect(desktopMcpManagementEnabled("desktop")).toBe(true)
    expect(desktopMcpManagementEnabled("web")).toBe(false)
  })

  test("orders builtins first and exposes management capabilities", () => {
    const entries = [
      entry({ id: "global-shared", name: "shared", scope: "global", effective: false, overriddenBy: "project" }),
      entry({ id: "qingtibase", name: "qingtibase", scope: "builtin", effective: true, readonly: true }),
      entry({ id: "project-shared", name: "shared", scope: "project", effective: true }),
      entry({ id: "noteexpress", name: "noteexpress", scope: "builtin", effective: true, readonly: true }),
    ]
    const statuses = {
      noteexpress: { status: "connected" },
      qingtibase: { status: "disabled" },
      shared: { status: "disabled" },
    } satisfies Record<string, McpStatus>

    expect(
      mcpManagementRows(entries, statuses).map((row) => [row.name, row.scope, row.canManage, row.canToggle]),
    ).toEqual([
      ["noteexpress", "builtin", false, true],
      ["qingtibase", "builtin", false, true],
      ["shared", "global", true, false],
      ["shared", "project", true, true],
    ])
  })

  test("preserves status errors and leaves missing status unresolved", () => {
    const entries = [
      entry({ id: "failed", name: "failed", scope: "project", effective: true }),
      entry({ id: "loading", name: "loading", scope: "project", effective: true }),
    ]

    expect(mcpManagementRows(entries, { failed: { status: "failed", error: "connection refused" } })).toEqual([
      {
        id: "failed",
        name: "failed",
        displayName: "failed",
        scope: "project",
        config: { type: "remote", url: "https://example.com/mcp" },
        status: "failed",
        error: "connection refused",
        canManage: true,
        canToggle: true,
      },
      {
        id: "loading",
        name: "loading",
        displayName: "loading",
        scope: "project",
        config: { type: "remote", url: "https://example.com/mcp" },
        canManage: true,
        canToggle: false,
      },
    ])
  })
})

function entry(input: Partial<McpConfigEntry> & Pick<McpConfigEntry, "id" | "name" | "scope" | "effective">) {
  return {
    config: { type: "remote", url: "https://example.com/mcp" },
    readonly: false,
    ...input,
  } satisfies McpConfigEntry
}

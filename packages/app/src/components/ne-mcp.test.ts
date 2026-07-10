import { describe, expect, test } from "bun:test"
import { isBuiltinMcp, mcpDisplayItems, mcpDisplayName, sortMcpNames, statusLabelKey } from "./ne-mcp"

describe("NE MCP display helpers", () => {
  test("puts NE built-in MCP servers before custom MCP servers", () => {
    expect(sortMcpNames(["z-custom", "qingtibase", "noteexpress", "a-custom"])).toEqual([
      "noteexpress",
      "qingtibase",
      "a-custom",
      "z-custom",
    ])
  })

  test("uses product names for NE built-in MCP servers", () => {
    expect(mcpDisplayName("noteexpress")).toBe("NoteExpress")
    expect(mcpDisplayName("qingtibase")).toBe("Qingti Base")
    expect(mcpDisplayName("custom")).toBe("custom")
  })

  test("identifies reserved NE MCP server names", () => {
    expect(isBuiltinMcp("noteexpress")).toBe(true)
    expect(isBuiltinMcp("qingtibase")).toBe(true)
    expect(isBuiltinMcp("custom")).toBe(false)
  })

  test("maps known MCP status values to localization keys", () => {
    expect(statusLabelKey("connected")).toBe("mcp.status.connected")
    expect(statusLabelKey("needs_client_registration")).toBe("mcp.status.needs_client_registration")
    expect(statusLabelKey(undefined)).toBeUndefined()
  })

  test("builds display items from MCP status map", () => {
    expect(
      mcpDisplayItems({
        custom: { status: "disabled" },
        noteexpress: { status: "failed", error: "not installed" },
      }),
    ).toEqual([
      {
        name: "noteexpress",
        displayName: "NoteExpress",
        status: "failed",
        statusLabelKey: "mcp.status.failed",
        error: "not installed",
      },
      {
        name: "custom",
        displayName: "custom",
        status: "disabled",
        statusLabelKey: "mcp.status.disabled",
      },
    ])
  })
})

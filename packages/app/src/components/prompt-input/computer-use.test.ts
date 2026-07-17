import { describe, expect, test } from "bun:test"
import type { PluginEntry } from "@opencode-ai/sdk/v2/client"
import {
  computerUseEnabled,
  computerUseExitLabel,
  computerUseMcpError,
  computerUseOption,
  prepareComputerUse,
  trailingAtQuery,
} from "./computer-use"

describe("prompt Computer Use", () => {
  test("reads persisted or draft activation state", () => {
    expect(computerUseEnabled({ computerUse: { enabled: true } }, undefined)).toBe(true)
    expect(computerUseEnabled(undefined, true)).toBe(true)
    expect(computerUseEnabled({ computerUse: { enabled: false } }, undefined)).toBe(false)
    expect(computerUseEnabled({ computerUse: { enabled: true } }, false)).toBe(false)
  })

  test("builds an available capability only from an active plugin", () => {
    const active = computerUseOption(entry({ status: "active" }))
    const failed = computerUseOption(entry({ status: "failed", error: { stage: "initialize", message: "missing" } }))

    expect(active).toMatchObject({ type: "capability", id: "computer-use", available: true })
    expect(failed).toMatchObject({ type: "capability", id: "computer-use", available: false, description: "missing" })
  })

  test("finds the @ query range without creating a prompt part", () => {
    expect(trailingAtQuery("调试 @电脑", 6)).toEqual({ start: 3, end: 6 })
    expect(trailingAtQuery("@computer ", 10)).toBeUndefined()
  })

  test("uses an explicit stop label while a session is working", () => {
    expect(computerUseExitLabel(false)).toBe("prompt.computerUse.exit")
    expect(computerUseExitLabel(true)).toBe("prompt.computerUse.stopAndExit")
  })

  test("requires a connected Cua MCP before activating a new session draft", () => {
    expect(computerUseMcpError({ status: "connected" })).toBeUndefined()
    expect(computerUseMcpError({ status: "failed", error: "driver failed" })).toBe("Cua Driver MCP failed: driver failed")
    expect(computerUseMcpError(undefined)).toBe("Cua Driver MCP is not configured")
  })

  test("enables a disabled plugin before checking the Cua MCP", async () => {
    const calls: string[] = []

    await prepareComputerUse(entry({ enabled: false, status: "disabled" }), {
      enable: async (key) => {
        calls.push(`enable:${key}`)
      },
      refresh: async () => {
        calls.push("refresh")
      },
      status: async () => {
        calls.push("status")
        return { status: "connected" }
      },
    })

    expect(calls).toEqual(["enable:builtin:computer-use", "refresh", "status"])
  })

  test("keeps an enabled plugin and checks the Cua MCP directly", async () => {
    const calls: string[] = []

    await prepareComputerUse(entry({ enabled: true, status: "active" }), {
      enable: async () => {
        calls.push("enable")
      },
      refresh: async () => {
        calls.push("refresh")
      },
      status: async () => {
        calls.push("status")
        return { status: "connected" }
      },
    })

    expect(calls).toEqual(["refresh", "status"])
  })

  test("preserves the Cua MCP failure when activation preparation fails", () => {
    expect(
      prepareComputerUse(entry({ enabled: true, status: "failed" }), {
        enable: async () => {},
        refresh: async () => {},
        status: async () => ({ status: "failed", error: "driver failed" }),
      }),
    ).rejects.toThrow("Cua Driver MCP failed: driver failed")
  })
})

function entry(input: Partial<PluginEntry>): PluginEntry {
  return {
    key: "builtin:computer-use",
    id: "computer-use",
    name: "Computer Use",
    spec: "builtin:computer-use",
    source: "builtin",
    scope: "builtin",
    enabled: true,
    status: "active",
    system: false,
    canDisable: true,
    canUninstall: false,
    capabilities: [],
    tools: [],
    skills: [],
    ...input,
  }
}

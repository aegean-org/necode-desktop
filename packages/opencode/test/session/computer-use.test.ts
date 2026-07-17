import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { SessionComputerUse } from "@/session/computer-use"

describe("SessionComputerUse", () => {
  test("reads the durable session metadata flag", () => {
    expect(SessionComputerUse.enabled({ metadata: { computerUse: { enabled: true } } })).toBe(true)
    expect(SessionComputerUse.enabled({ metadata: { computerUse: { enabled: false } } })).toBe(false)
    expect(SessionComputerUse.enabled({ metadata: { computerUse: true } })).toBe(false)
    expect(SessionComputerUse.enabled({})).toBe(false)
  })

  test("only exposes the product allowlist to activated sessions", () => {
    expect(SessionComputerUse.includeTool("bash", false)).toBe(true)
    expect(SessionComputerUse.includeTool("custom-cua_click", false)).toBe(true)
    expect(SessionComputerUse.includeTool("cua-driver_click", false)).toBe(false)
    expect(SessionComputerUse.includeTool("cua-driver_click", true)).toBe(true)
    expect(SessionComputerUse.includeTool("cua-driver_start_recording", true)).toBe(false)
    expect(SessionComputerUse.includeTool("cua-driver_end_session", true)).toBe(true)
  })

  test("provides reliable launch and fallback instructions only to activated sessions", () => {
    expect(SessionComputerUse.systemPrompt({})).toBeUndefined()

    const prompt = SessionComputerUse.systemPrompt({ metadata: { computerUse: { enabled: true } } })
    expect(prompt).toContain("list_apps")
    expect(prompt).toContain("pid")
    expect(prompt).toContain("launch_path")
    expect(prompt).toContain("aumid")
    expect(prompt).toContain("launch_app.urls")
    expect(prompt).toContain("verify")
    expect(prompt).toContain("Shell fallback")
    expect(prompt).toContain("user's language")
  })

  test("removes the Cua session field from the model schema", () => {
    expect(
      SessionComputerUse.bindSchema({
        type: "object",
        properties: { pid: { type: "integer" }, session: { type: "string" } },
        required: ["pid", "session"],
      }),
    ).toEqual({
      bindsSession: true,
      schema: {
        type: "object",
        properties: { pid: { type: "integer" } },
        required: ["pid"],
      },
    })
    expect(
      SessionComputerUse.bindToolSchema("cua-driver_end_session", {
        type: "object",
        properties: { session: { type: "string" } },
        required: ["session"],
      }),
    ).toEqual({ bindsSession: true, schema: { type: "object", properties: {} } })
    expect(
      SessionComputerUse.bindToolSchema("custom_session_tool", {
        type: "object",
        properties: { session: { type: "string" } },
        required: ["session"],
      }),
    ).toEqual({
      bindsSession: false,
      schema: {
        type: "object",
        properties: { session: { type: "string" } },
        required: ["session"],
      },
    })
  })

  test("injects the NeCode Session ID and rejects boundary overrides", () => {
    expect(SessionComputerUse.bindArguments({ pid: 42 }, "ses_123", true)).toEqual({ pid: 42, session: "ses_123" })
    expect(SessionComputerUse.bindArguments({ pid: 42 }, "ses_123", false)).toEqual({ pid: 42 })
    expect(() => SessionComputerUse.bindArguments({ session: "ses_other" }, "ses_123", true)).toThrow(
      "cannot override",
    )
  })

  test("activates only when the built-in Cua MCP is connected and preserves metadata", async () => {
    const saved: Record<string, unknown>[] = []
    const result = await Effect.runPromise(
      SessionComputerUse.update(
        {
          sessionID: "ses_123",
          enabled: true,
          metadata: { owner: "hu", computerUse: { source: "draft" } },
        },
        {
          status: () => Effect.succeed({ "cua-driver": { status: "connected" as const } }),
          callTool: () => Effect.die("not used"),
          setMetadata: (metadata) => Effect.sync(() => saved.push(metadata)),
        },
      ),
    )

    expect(result).toEqual({ enabled: true })
    expect(saved).toEqual([{ owner: "hu", computerUse: { source: "draft", enabled: true } }])
  })

  test("does not activate when the Cua MCP is unavailable", async () => {
    let saved = false
    const result = await Effect.runPromise(
      SessionComputerUse.update(
        { sessionID: "ses_123", enabled: true, metadata: { owner: "hu" } },
        {
          status: () => Effect.succeed({ "cua-driver": { status: "failed" as const, error: "driver missing" } }),
          callTool: () => Effect.die("not used"),
          setMetadata: () => Effect.sync(() => (saved = true)),
        },
      ),
    )

    expect(result).toEqual({ enabled: false, error: "Cua Driver MCP failed: driver missing" })
    expect(saved).toBe(false)
  })

  test("disables the mode even when Driver session cleanup fails", async () => {
    const saved: Record<string, unknown>[] = []
    const result = await Effect.runPromise(
      SessionComputerUse.update(
        { sessionID: "ses_123", enabled: false, metadata: { owner: "hu", computerUse: { enabled: true } } },
        {
          status: () => Effect.die("not used"),
          callTool: (_client, _tool, args) =>
            args.session === "ses_123" ? Effect.fail(new Error("cleanup failed")) : Effect.die("wrong session"),
          setMetadata: (metadata) => Effect.sync(() => saved.push(metadata)),
        },
      ),
    )

    expect(result).toEqual({ enabled: false, error: "cleanup failed" })
    expect(saved).toEqual([{ owner: "hu", computerUse: { enabled: false } }])
  })
})

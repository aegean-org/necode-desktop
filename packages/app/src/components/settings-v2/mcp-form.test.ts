import { describe, expect, test } from "bun:test"
import type { McpConfigEntry, McpRemoteConfig } from "@opencode-ai/sdk/v2/client"
import { createMcpForm, validateMcpForm, type McpForm } from "./mcp-form"

describe("desktop MCP form model", () => {
  test("creates one complete store state and preserves an edited local command", () => {
    expect(createMcpForm()).toMatchObject({
      mode: "create",
      scope: "project",
      name: "",
      type: "local",
      enabled: true,
      oauthMode: "auto",
    })

    const form = createMcpForm({
      id: "project-local",
      name: "local-server",
      scope: "project",
      config: {
        type: "local",
        command: ["bun", "run", "", "--flag=value"],
        cwd: "D:/workspace",
        environment: { TOKEN: "secret" },
        enabled: false,
        timeout: 20,
      },
      effective: true,
      readonly: false,
    })

    expect(form).toMatchObject({
      mode: "edit",
      originalName: "local-server",
      scope: "project",
      name: "local-server",
      type: "local",
      enabled: false,
      timeout: "20",
      command: [{ value: "bun" }, { value: "run" }, { value: "" }, { value: "--flag=value" }],
      cwd: "D:/workspace",
      environment: [{ key: "TOKEN", value: "secret" }],
    })
    expect(validateMcpForm(form, ["local-server"]).result?.config).toEqual({
      type: "local",
      command: ["bun", "run", "", "--flag=value"],
      cwd: "D:/workspace",
      environment: { TOKEN: "secret" },
      enabled: false,
      timeout: 20,
    })
  })

  test("rejects invalid, reserved, and duplicate names while allowing an edited name to keep itself", () => {
    expect(validateMcpForm(local({ name: "Uppercase" }), []).errors.name).toBe("invalid")
    expect(validateMcpForm(local({ name: "noteexpress" }), []).errors.name).toBe("reserved")
    expect(validateMcpForm(local({ name: "duplicate" }), ["duplicate"]).errors.name).toBe("duplicate")
    expect(
      validateMcpForm(local({ mode: "edit", originalName: "existing", name: "existing" }), ["existing"]).result,
    ).toBeDefined()
  })

  test("requires a local executable and preserves empty arguments exactly", () => {
    expect(validateMcpForm(local({ command: [] }), []).errors.command).toBe("required")
    expect(validateMcpForm(local({ command: [{ value: " " }] }), []).errors.command).toBe("required")
    expect(
      validateMcpForm(local({ command: [{ value: "node" }, { value: "" }, { value: "  " }, { value: "--stdio" }] }), [])
        .result?.config,
    ).toEqual({ type: "local", command: ["node", "", "  ", "--stdio"], enabled: true })
  })

  test("ignores empty key-value rows and reports incomplete or case-insensitive duplicates by row", () => {
    const result = validateMcpForm(
      local({
        environment: [
          { key: "", value: "" },
          { key: "Token", value: "one" },
          { key: "TOKEN", value: "two" },
          { key: "half", value: "" },
        ],
      }),
      [],
    )
    expect(result.errors.environment).toEqual({ 1: "duplicate", 2: "duplicate", 3: "incomplete" })
    expect(result.result).toBeUndefined()

    const headers = validateMcpForm(
      remote({
        headers: [
          { key: "Accept", value: "json" },
          { key: "accept", value: "text" },
        ],
      }),
      [],
    )
    expect(headers.errors.headers).toEqual({ 0: "duplicate", 1: "duplicate" })
  })

  test("preserves special JavaScript property names in environment variables", () => {
    const result = validateMcpForm(
      local({
        environment: [
          { key: "__proto__", value: "prototype" },
          { key: "constructor", value: "construct" },
          { key: "toString", value: "stringify" },
        ],
      }),
      [],
    )
    expect(result.errors).toEqual({})
    const config = result.result?.config
    expect(config?.type).toBe("local")
    if (config?.type !== "local") throw new Error("Expected local MCP config")
    expect(Object.hasOwn(config.environment!, "__proto__")).toBe(true)
    expect(config.environment?.["__proto__"]).toBe("prototype")
    expect(config.environment?.["constructor"]).toBe("construct")
    expect(config.environment?.["toString"]).toBe("stringify")
  })

  test("preserves special JavaScript property names in remote headers", () => {
    const result = validateMcpForm(
      remote({
        headers: [
          { key: "__proto__", value: "prototype" },
          { key: "constructor", value: "construct" },
          { key: "toString", value: "stringify" },
        ],
      }),
      [],
    )
    expect(result.errors).toEqual({})
    const config = result.result?.config
    expect(config?.type).toBe("remote")
    if (config?.type !== "remote") throw new Error("Expected remote MCP config")
    expect(Object.hasOwn(config.headers!, "__proto__")).toBe(true)
    expect(config.headers?.["__proto__"]).toBe("prototype")
    expect(config.headers?.["constructor"]).toBe("construct")
    expect(config.headers?.["toString"]).toBe("stringify")
  })

  test("validates HTTP URLs, positive timeouts, redirect URIs, and callback ports", () => {
    expect(validateMcpForm(remote({ url: "ftp://example.com" }), []).errors.url).toBe("url")
    expect(validateMcpForm(remote({ timeout: "0" }), []).errors.timeout).toBe("positive_integer")
    expect(validateMcpForm(remote({ timeout: "1.5" }), []).errors.timeout).toBe("positive_integer")
    expect(
      validateMcpForm(remote({ oauthMode: "explicit", redirectUri: "custom://callback" }), []).errors.redirectUri,
    ).toBe("url")
    expect(validateMcpForm(remote({ oauthMode: "explicit", callbackPort: "0" }), []).errors.callbackPort).toBe("port")
    expect(validateMcpForm(remote({ oauthMode: "explicit", callbackPort: "65536" }), []).errors.callbackPort).toBe(
      "port",
    )
    expect(
      validateMcpForm(
        remote({
          timeout: "15",
          oauthMode: "explicit",
          redirectUri: "https://app.example/callback",
          callbackPort: "65535",
        }),
        [],
      ).result?.config,
    ).toMatchObject({ timeout: 15, oauth: { redirectUri: "https://app.example/callback", callbackPort: 65535 } })
  })

  test("serializes OAuth auto, disabled, and explicit states distinctly", () => {
    expect(validateMcpForm(remote({ oauthMode: "auto" }), []).result?.config).not.toHaveProperty("oauth")
    expect(validateMcpForm(remote({ oauthMode: "disabled" }), []).result?.config).toMatchObject({ oauth: false })
    expect(validateMcpForm(remote({ oauthMode: "explicit", clientId: "" }), []).result?.config).toMatchObject({
      oauth: {},
    })
  })

  test("rejects builtin entries as edit forms", () => {
    expect(() => createMcpForm(builtinEntry())).toThrow("Builtin MCP entries cannot be edited")
  })

  test("rejects readonly project and global entries as edit forms", () => {
    expect(() => createMcpForm(readonlyEntry("project", "noteexpress"))).toThrow(
      "Readonly MCP entries cannot be edited",
    )
    expect(() => createMcpForm(readonlyEntry("global", "qingtibase"))).toThrow("Readonly MCP entries cannot be edited")
  })
})

function local(input: Partial<McpForm> = {}): McpForm {
  return { ...createMcpForm(), name: "local-server", command: [{ value: "node" }], ...input }
}

function remote(input: Partial<McpForm> = {}): McpForm {
  return {
    ...createMcpForm(),
    name: "remote-server",
    type: "remote",
    url: "https://example.com/mcp",
    command: [],
    ...input,
  }
}

function builtinEntry() {
  return {
    id: "builtin",
    name: "noteexpress",
    scope: "builtin",
    config: { type: "remote", url: "https://example.com/mcp" } satisfies McpRemoteConfig,
    effective: true,
    readonly: true,
  } satisfies McpConfigEntry
}

function readonlyEntry(scope: "project" | "global", name: "noteexpress" | "qingtibase") {
  return {
    id: `${scope}-${name}`,
    name,
    scope,
    config: { type: "remote", url: "https://example.com/mcp" } satisfies McpRemoteConfig,
    effective: true,
    readonly: true,
  } satisfies McpConfigEntry
}

import { describe, expect, test } from "bun:test"
import { parseMcpImport } from "./mcp-import"

describe("desktop MCP JSONC import parser", () => {
  test("imports one wrapped local MCP entry", () => {
    expect(
      parseMcpImport(
        `{ // copied config\n "mcp": { "demo": { "type": "local", "command": ["npx", "-y", "demo"], "environment": { "TOKEN": "x" } } } }`,
        "project",
      ),
    ).toEqual({
      form: expect.objectContaining({
        mode: "create",
        name: "demo",
        scope: "project",
        type: "local",
        command: [{ value: "npx" }, { value: "-y" }, { value: "demo" }],
        environment: [{ key: "TOKEN", value: "x" }],
      }),
    })
  })

  test("rejects multiple entries", () => {
    expect(
      parseMcpImport(`{"mcp":{"a":{"type":"local","command":["a"]},"b":{"type":"local","command":["b"]}}}`, "project"),
    ).toEqual({ error: "single_entry" })
  })

  test("rejects duplicate JSONC properties instead of silently keeping the last value", () => {
    expect(
      parseMcpImport(`{"demo":{"type":"local","command":["a"]},"demo":{"type":"local","command":["b"]}}`, "project"),
    ).toEqual({ error: "invalid_jsonc" })
    expect(
      parseMcpImport(
        `{"mcp":{"a":{"type":"local","command":["a"]}},"mcp":{"b":{"type":"local","command":["b"]}}}`,
        "project",
      ),
    ).toEqual({ error: "invalid_jsonc" })
  })

  test("imports a direct entry named mcp", () => {
    expect(parseMcpImport(`{"mcp":{"type":"local","command":["demo"]}}`, "project")).toEqual({
      form: expect.objectContaining({ name: "mcp", command: [{ value: "demo" }] }),
    })
  })

  test("imports a wrapped entry named type", () => {
    expect(parseMcpImport(`{"mcp":{"type":{"type":"local","command":["demo"]}}}`, "project")).toEqual({
      form: expect.objectContaining({ name: "type", command: [{ value: "demo" }] }),
    })
  })

  test("imports one direct named remote entry with headers and OAuth", () => {
    expect(
      parseMcpImport(
        `{
          "remote-demo": {
            "type": "remote",
            "url": "https://example.com/mcp",
            "enabled": false,
            "headers": { "Authorization": "Bearer token" },
            "oauth": {
              "clientId": "client",
              "clientSecret": "secret",
              "scope": "read write",
              "callbackPort": 4321,
              "redirectUri": "https://example.com/callback"
            },
            "timeout": 30
          }
        }`,
        "global",
      ),
    ).toEqual({
      form: {
        mode: "create",
        scope: "global",
        name: "remote-demo",
        type: "remote",
        enabled: false,
        timeout: "30",
        command: [{ value: "" }],
        cwd: "",
        environment: [],
        url: "https://example.com/mcp",
        headers: [{ key: "Authorization", value: "Bearer token" }],
        oauthMode: "explicit",
        clientId: "client",
        clientSecret: "secret",
        oauthScope: "read write",
        callbackPort: "4321",
        redirectUri: "https://example.com/callback",
      },
    })
  })

  test("accepts trailing commas", () => {
    expect(parseMcpImport(`{"demo":{"type":"local","command":["demo",],},}`, "project")).toEqual({
      form: expect.objectContaining({ name: "demo", command: [{ value: "demo" }] }),
    })
  })

  test("rejects invalid JSONC", () => {
    expect(parseMcpImport(`{"demo":{"type":"local","command":[}}`, "project")).toEqual({
      error: "invalid_jsonc",
    })
  })

  test("rejects unsupported properties", () => {
    expect(parseMcpImport(`{"demo":{"type":"local","command":["demo"],"args":[]}}`, "project")).toEqual({
      error: "unsupported_field",
    })
    expect(
      parseMcpImport(
        `{"demo":{"type":"remote","url":"https://example.com/mcp","oauth":{"clientId":"client","extra":true}}}`,
        "project",
      ),
    ).toEqual({ error: "unsupported_field" })
  })

  test("rejects an empty local command", () => {
    expect(parseMcpImport(`{"demo":{"type":"local","command":[]}}`, "project")).toEqual({
      error: "invalid_entry",
    })
  })

  test.each(["__proto__", "constructor", "toString"])("imports the prototype-sensitive name %s", (name) => {
    expect(parseMcpImport(`{"${name}":{"type":"local","command":["demo"]}}`, "project")).toEqual({
      form: expect.objectContaining({ name }),
    })
  })
})

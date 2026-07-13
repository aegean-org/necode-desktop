import type { McpLocalConfig, McpRemoteConfig } from "@opencode-ai/sdk/v2/client"
import { parseTree, type Node, type ParseError } from "jsonc-parser"
import { createMcpForm, type KeyValueRow, type McpForm } from "./mcp-form"

const LOCAL_FIELDS = ["type", "command", "cwd", "environment", "enabled", "timeout"] as const
const REMOTE_FIELDS = ["type", "url", "headers", "oauth", "enabled", "timeout"] as const
const OAUTH_FIELDS = ["clientId", "clientSecret", "scope", "callbackPort", "redirectUri"] as const
const MAX_CALLBACK_PORT = 65_535

/** Stable errors returned when pasted MCP configuration cannot be imported. */
export type McpImportError = "invalid_jsonc" | "single_entry" | "invalid_entry" | "unsupported_field"

/** Pure parser output containing either a complete create form or one stable error. */
export type McpImportResult = { readonly form: McpForm } | { readonly error: McpImportError }

type ConfigResult = { readonly config: McpLocalConfig | McpRemoteConfig } | { readonly error: McpImportError }
type OAuthResult = { readonly oauth: McpRemoteConfig["oauth"] } | { readonly error: McpImportError }
type EntryResult =
  | { readonly name: string; readonly config: McpLocalConfig | McpRemoteConfig }
  | { readonly error: McpImportError }

/** Parses one pasted MCP JSON/JSONC entry without persisting it. */
export function parseMcpImport(text: string, scope: McpForm["scope"]): McpImportResult {
  const errors: ParseError[] = []
  const root = parseTree(text, errors, { allowTrailingComma: true })
  if (errors.length > 0 || !root || hasDuplicateKeys(root)) return { error: "invalid_jsonc" }
  const input = readNode(root)
  const entry = readSingleEntry(input)
  if ("error" in entry) return entry
  return { form: toImportForm(entry.name, entry.config, scope) }
}

function hasDuplicateKeys(node: Node): boolean {
  if (node.type === "array") return (node.children ?? []).some(hasDuplicateKeys)
  if (node.type !== "object") return false
  const keys = new Set<string>()
  return (node.children ?? []).some((property) => {
    const key = property.children?.[0]?.value
    const value = property.children?.[1]
    if (typeof key !== "string") return false
    if (keys.has(key)) return true
    keys.add(key)
    return value ? hasDuplicateKeys(value) : false
  })
}

function readNode(node: Node): unknown {
  if (node.type === "array") return (node.children ?? []).map(readNode)
  if (node.type !== "object") return node.value
  const result = Object.create(null) as Record<string, unknown>
  node.children?.forEach((property) => {
    const key = property.children?.[0]?.value
    const value = property.children?.[1]
    if (typeof key === "string" && value) result[key] = readNode(value)
  })
  return result
}

function readSingleEntry(input: unknown): EntryResult {
  if (!isRecord(input)) return { error: "invalid_entry" }
  const mcp = readOwn(input, "mcp")
  const wrapped = Object.hasOwn(input, "mcp")
  if (wrapped && hasUnsupportedFields(input, ["mcp"])) return { error: "unsupported_field" }
  const entries = wrapped ? mcp : input
  if (!isRecord(entries)) return { error: "invalid_entry" }
  const names = Object.keys(entries)
  if (names.length !== 1) return { error: "single_entry" }
  const name = names[0]
  if (!name) return { error: "invalid_entry" }
  const config = readConfig(readOwn(entries, name))
  if ("error" in config) return config
  return { name, config: config.config }
}

function readConfig(input: unknown): ConfigResult {
  if (!isRecord(input)) return { error: "invalid_entry" }
  const type = readOwn(input, "type")
  if (type === "local") return readLocalConfig(input)
  if (type === "remote") return readRemoteConfig(input)
  return { error: "invalid_entry" }
}

function readLocalConfig(input: Record<string, unknown>): ConfigResult {
  if (hasUnsupportedFields(input, LOCAL_FIELDS)) return { error: "unsupported_field" }
  const command = readOwn(input, "command")
  const cwd = readOwn(input, "cwd")
  const environment = readOwn(input, "environment")
  const enabled = readOwn(input, "enabled")
  const timeout = readOwn(input, "timeout")
  if (!isCommand(command) || !isOptionalString(cwd) || !isOptionalStringRecord(environment))
    return { error: "invalid_entry" }
  if (!isOptionalBoolean(enabled) || !isOptionalPositiveInteger(timeout)) return { error: "invalid_entry" }
  return { config: { type: "local", command, ...optionalLocalFields({ cwd, environment, enabled, timeout }) } }
}

function readRemoteConfig(input: Record<string, unknown>): ConfigResult {
  if (hasUnsupportedFields(input, REMOTE_FIELDS)) return { error: "unsupported_field" }
  const url = readOwn(input, "url")
  const headers = readOwn(input, "headers")
  const enabled = readOwn(input, "enabled")
  const timeout = readOwn(input, "timeout")
  const oauth = readOAuth(readOwn(input, "oauth"))
  if (typeof url !== "string" || !isOptionalStringRecord(headers)) return { error: "invalid_entry" }
  if (!isOptionalBoolean(enabled) || !isOptionalPositiveInteger(timeout)) return { error: "invalid_entry" }
  if ("error" in oauth) return oauth
  return { config: { type: "remote", url, ...optionalRemoteFields({ headers, oauth: oauth.oauth, enabled, timeout }) } }
}

function readOAuth(input: unknown): OAuthResult {
  if (input === undefined || input === false) return { oauth: input }
  if (!isRecord(input)) return { error: "invalid_entry" }
  if (hasUnsupportedFields(input, OAUTH_FIELDS)) return { error: "unsupported_field" }
  const clientId = readOwn(input, "clientId")
  const clientSecret = readOwn(input, "clientSecret")
  const scope = readOwn(input, "scope")
  const callbackPort = readOwn(input, "callbackPort")
  const redirectUri = readOwn(input, "redirectUri")
  if (!isOptionalString(clientId) || !isOptionalString(clientSecret)) return { error: "invalid_entry" }
  if (!isOptionalString(scope) || !isOptionalString(redirectUri)) return { error: "invalid_entry" }
  if (
    callbackPort !== undefined &&
    (typeof callbackPort !== "number" ||
      !Number.isInteger(callbackPort) ||
      callbackPort <= 0 ||
      callbackPort > MAX_CALLBACK_PORT)
  )
    return { error: "invalid_entry" }
  return {
    oauth: {
      ...(clientId === undefined ? {} : { clientId }),
      ...(clientSecret === undefined ? {} : { clientSecret }),
      ...(scope === undefined ? {} : { scope }),
      ...(callbackPort === undefined ? {} : { callbackPort }),
      ...(redirectUri === undefined ? {} : { redirectUri }),
    },
  }
}

function toImportForm(name: string, config: McpLocalConfig | McpRemoteConfig, scope: McpForm["scope"]): McpForm {
  const base = createMcpForm()
  if (config.type === "local") {
    return {
      ...base,
      scope,
      name,
      command: config.command.map((value) => ({ value })),
      cwd: config.cwd ?? "",
      environment: toKeyValueRows(config.environment),
      enabled: config.enabled ?? true,
      timeout: config.timeout === undefined ? "" : String(config.timeout),
    }
  }
  const oauth = config.oauth && typeof config.oauth === "object" ? config.oauth : undefined
  return {
    ...base,
    scope,
    name,
    type: "remote",
    enabled: config.enabled ?? true,
    timeout: config.timeout === undefined ? "" : String(config.timeout),
    url: config.url,
    headers: toKeyValueRows(config.headers),
    oauthMode: config.oauth === undefined ? "auto" : config.oauth === false ? "disabled" : "explicit",
    clientId: oauth?.clientId ?? "",
    clientSecret: oauth?.clientSecret ?? "",
    oauthScope: oauth?.scope ?? "",
    callbackPort: oauth?.callbackPort === undefined ? "" : String(oauth.callbackPort),
    redirectUri: oauth?.redirectUri ?? "",
  }
}

function optionalLocalFields(input: {
  cwd: string | undefined
  environment: Record<string, string> | undefined
  enabled: boolean | undefined
  timeout: number | undefined
}) {
  return {
    ...(input.cwd === undefined ? {} : { cwd: input.cwd }),
    ...(input.environment === undefined ? {} : { environment: input.environment }),
    ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
    ...(input.timeout === undefined ? {} : { timeout: input.timeout }),
  }
}

function optionalRemoteFields(input: {
  headers: Record<string, string> | undefined
  oauth: McpRemoteConfig["oauth"]
  enabled: boolean | undefined
  timeout: number | undefined
}) {
  return {
    ...(input.headers === undefined ? {} : { headers: input.headers }),
    ...(input.oauth === undefined ? {} : { oauth: input.oauth }),
    ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
    ...(input.timeout === undefined ? {} : { timeout: input.timeout }),
  }
}

function readOwn(input: Record<string, unknown>, key: string) {
  return Object.hasOwn(input, key) ? input[key] : undefined
}

function hasUnsupportedFields(input: Record<string, unknown>, supported: readonly string[]) {
  return Object.keys(input).some((key) => !supported.includes(key))
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input)
}

function isCommand(input: unknown): input is string[] {
  return (
    Array.isArray(input) && input.length > 0 && input.every((value) => typeof value === "string") && !!input[0]?.trim()
  )
}

function isOptionalString(input: unknown): input is string | undefined {
  return input === undefined || typeof input === "string"
}

function isOptionalBoolean(input: unknown): input is boolean | undefined {
  return input === undefined || typeof input === "boolean"
}

function isOptionalPositiveInteger(input: unknown): input is number | undefined {
  return input === undefined || (typeof input === "number" && Number.isSafeInteger(input) && input > 0)
}

function isOptionalStringRecord(input: unknown): input is Record<string, string> | undefined {
  return input === undefined || (isRecord(input) && Object.values(input).every((value) => typeof value === "string"))
}

function toKeyValueRows(input: Record<string, string> | undefined): KeyValueRow[] {
  return Object.entries(input ?? {}).map(([key, value]) => ({ key, value }))
}

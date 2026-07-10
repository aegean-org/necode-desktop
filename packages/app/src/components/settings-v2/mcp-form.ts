import type { McpConfigEntry, McpLocalConfig, McpRemoteConfig } from "@opencode-ai/sdk/v2/client"
import { isBuiltinMcp } from "../ne-mcp"

const MCP_NAME = /^[a-z0-9][a-z0-9_-]*$/
const MAX_CALLBACK_PORT = 65_535

/** One editable command token. Empty argument tokens remain meaningful. */
export type CommandRow = { value: string }

/** One editable environment variable or HTTP header. */
export type KeyValueRow = { key: string; value: string }

/** Complete state stored by the MCP create/edit dialog in one createStore object. */
export type McpForm = {
  mode: "create" | "edit"
  originalName?: string
  scope: "project" | "global"
  name: string
  type: "local" | "remote"
  enabled: boolean
  timeout: string
  command: CommandRow[]
  cwd: string
  environment: KeyValueRow[]
  url: string
  headers: KeyValueRow[]
  oauthMode: "auto" | "disabled" | "explicit"
  clientId: string
  clientSecret: string
  oauthScope: string
  callbackPort: string
  redirectUri: string
  pendingType?: "local" | "remote"
}

/** Stable field-level validation codes consumed by the dialog. */
export type McpFormErrorCode = "required" | "invalid" | "reserved" | "duplicate" | "positive_integer" | "url" | "port"

/** Stable row-level validation codes for key-value editors. */
export type McpKeyValueErrorCode = "incomplete" | "duplicate"

/** Field and row errors returned without mutating the submitted form. */
export type McpFormErrors = {
  name?: McpFormErrorCode
  command?: McpFormErrorCode
  timeout?: McpFormErrorCode
  url?: McpFormErrorCode
  callbackPort?: McpFormErrorCode
  redirectUri?: McpFormErrorCode
  environment?: Readonly<Record<number, McpKeyValueErrorCode>>
  headers?: Readonly<Record<number, McpKeyValueErrorCode>>
}

/** Valid configuration accepted by the generated persistent MCP client. */
export type McpFormResult = {
  readonly scope: "project" | "global"
  readonly name: string
  readonly config: McpLocalConfig | McpRemoteConfig
}

/** Pure validation output for dialog rendering and submission. */
export type McpFormValidation = { readonly errors: McpFormErrors; readonly result?: McpFormResult }

/** Creates the complete state object for a new or writable existing MCP entry. */
export function createMcpForm(entry?: McpConfigEntry): McpForm {
  if (entry?.scope === "builtin") throw new Error("Builtin MCP entries cannot be edited")
  const config = entry?.config
  const oauth = config?.type === "remote" && config.oauth && typeof config.oauth === "object" ? config.oauth : undefined
  return {
    mode: entry ? "edit" : "create",
    ...(entry ? { originalName: entry.name } : {}),
    scope: entry?.scope ?? "project",
    name: entry?.name ?? "",
    type: config?.type ?? "local",
    enabled: config?.enabled ?? true,
    timeout: config?.timeout === undefined ? "" : String(config.timeout),
    command: config?.type === "local" ? config.command.map((value) => ({ value })) : [{ value: "" }],
    cwd: config?.type === "local" ? (config.cwd ?? "") : "",
    environment: config?.type === "local" ? toKeyValueRows(config.environment) : [],
    url: config?.type === "remote" ? config.url : "",
    headers: config?.type === "remote" ? toKeyValueRows(config.headers) : [],
    oauthMode:
      config?.type !== "remote" || config.oauth === undefined
        ? "auto"
        : config.oauth === false
          ? "disabled"
          : "explicit",
    clientId: oauth?.clientId ?? "",
    clientSecret: oauth?.clientSecret ?? "",
    oauthScope: oauth?.scope ?? "",
    callbackPort: oauth?.callbackPort === undefined ? "" : String(oauth.callbackPort),
    redirectUri: oauth?.redirectUri ?? "",
  }
}

/** Validates a complete MCP form and serializes it into generated SDK configuration types. */
export function validateMcpForm(form: McpForm, existingNames: readonly string[]): McpFormValidation {
  const name = form.name.trim()
  const errors: McpFormErrors = {}
  const nameError = validateName(form, name, existingNames)
  if (nameError) errors.name = nameError
  const timeout = readPositiveInteger(form.timeout)
  if (timeout === null) errors.timeout = "positive_integer"
  const parsed = form.type === "local" ? validateLocal(form, timeout, errors) : validateRemote(form, timeout, errors)
  if (Object.keys(errors).length > 0) return { errors }
  return { errors, result: { scope: form.scope, name, config: parsed } }
}

function validateName(form: McpForm, name: string, existingNames: readonly string[]): McpFormErrorCode | undefined {
  if (!name) return "required"
  if (isBuiltinMcp(name)) return "reserved"
  if (!MCP_NAME.test(name)) return "invalid"
  if (existingNames.some((item) => item === name && item !== form.originalName)) return "duplicate"
}

function validateLocal(form: McpForm, timeout: number | null | undefined, errors: McpFormErrors): McpLocalConfig {
  if (form.command.length === 0 || !form.command[0]?.value.trim()) errors.command = "required"
  const environment = readKeyValueRows(form.environment)
  if (environment.errors) errors.environment = environment.errors
  return {
    type: "local",
    command: form.command.map((row) => row.value),
    enabled: form.enabled,
    ...(form.cwd.trim() ? { cwd: form.cwd.trim() } : {}),
    ...(environment.value ? { environment: environment.value } : {}),
    ...(timeout ? { timeout } : {}),
  }
}

function validateRemote(form: McpForm, timeout: number | null | undefined, errors: McpFormErrors): McpRemoteConfig {
  const url = form.url.trim()
  if (!isHttpUrl(url)) errors.url = "url"
  const headers = readKeyValueRows(form.headers)
  if (headers.errors) errors.headers = headers.errors
  const oauth = validateOAuth(form, errors)
  return {
    type: "remote",
    url,
    enabled: form.enabled,
    ...(headers.value ? { headers: headers.value } : {}),
    ...(oauth !== undefined ? { oauth } : {}),
    ...(timeout ? { timeout } : {}),
  }
}

function validateOAuth(form: McpForm, errors: McpFormErrors): McpRemoteConfig["oauth"] {
  if (form.oauthMode === "auto") return
  if (form.oauthMode === "disabled") return false
  const callbackPort = readCallbackPort(form.callbackPort)
  if (callbackPort === null) errors.callbackPort = "port"
  const redirectUri = form.redirectUri.trim()
  if (redirectUri && !isHttpUrl(redirectUri)) errors.redirectUri = "url"
  return {
    ...(form.clientId.trim() ? { clientId: form.clientId } : {}),
    ...(form.clientSecret.trim() ? { clientSecret: form.clientSecret } : {}),
    ...(form.oauthScope.trim() ? { scope: form.oauthScope } : {}),
    ...(callbackPort ? { callbackPort } : {}),
    ...(redirectUri ? { redirectUri } : {}),
  }
}

function readKeyValueRows(rows: readonly KeyValueRow[]) {
  const errors: Record<number, McpKeyValueErrorCode> = {}
  const values: Record<string, string> = {}
  const first = new Map<string, number>()
  rows.forEach((row, index) => {
    const key = row.key.trim()
    const hasValue = row.value.trim().length > 0
    if (!key && !hasValue) return
    if (!key || !hasValue) {
      errors[index] = "incomplete"
      return
    }
    const duplicate = first.get(key.toLowerCase())
    if (duplicate !== undefined) {
      errors[duplicate] = "duplicate"
      errors[index] = "duplicate"
      return
    }
    first.set(key.toLowerCase(), index)
    values[key] = row.value
  })
  return {
    ...(Object.keys(values).length > 0 ? { value: values } : {}),
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  }
}

function readPositiveInteger(value: string) {
  if (!value.trim()) return
  if (!/^[1-9]\d*$/.test(value.trim())) return null
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : null
}

function readCallbackPort(value: string) {
  const port = readPositiveInteger(value)
  if (port === undefined) return
  if (port === null || port > MAX_CALLBACK_PORT) return null
  return port
}

function isHttpUrl(value: string) {
  if (!URL.canParse(value)) return false
  return ["http:", "https:"].includes(new URL(value).protocol)
}

function toKeyValueRows(value: Record<string, string> | undefined) {
  return Object.entries(value ?? {}).map(([key, item]) => ({ key, value: item }))
}

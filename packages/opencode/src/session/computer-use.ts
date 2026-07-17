import { Effect } from "effect"

const PREFIX = "cua-driver_"

export const ALLOWED_TOOLS = [
  "list_apps",
  "list_windows",
  "get_window_state",
  "launch_app",
  "bring_to_front",
  "click",
  "double_click",
  "right_click",
  "drag",
  "type_text",
  "press_key",
  "hotkey",
  "set_value",
  "scroll",
  "check_permissions",
  "health_report",
  "start_session",
  "end_session",
] as const

const allowed = new Set<string>(ALLOWED_TOOLS)

const SYSTEM_PROMPT = `You are operating in Computer Use mode.
- Call list_apps before launching an application. If the target is already running, reuse the returned pid and its existing windows instead of launching it again.
- When a launch is required, reuse the exact launch_path or packaged bundle_id/AUMID returned by list_apps, passing the packaged identifier as aumid when appropriate. If neither is available, use the complete returned application name. Never guess aliases such as "Chrome".
- To open a webpage or search URL, prefer launch_app.urls before using Shell.
- If a Cua tool reports an error, verify the real application or window state with list_apps, list_windows, or get_window_state before deciding the action failed.
- Use Shell fallback only when the requested result is still incomplete after that verification.
- When Shell fallback succeeds, explicitly state in the user's language that the Computer Use action failed and the task was completed through Shell fallback. Do not claim that Cua succeeded, and do not hide the original Cua error.`

export function enabled(session: { metadata?: Record<string, unknown> }) {
  const value = session.metadata?.computerUse
  if (!value || typeof value !== "object") return false
  return "enabled" in value && value.enabled === true
}

export function systemPrompt(session: { metadata?: Record<string, unknown> }) {
  if (!enabled(session)) return
  return SYSTEM_PROMPT
}

export function includeTool(key: string, active: boolean) {
  if (!key.startsWith(PREFIX)) return true
  return active && allowed.has(key.slice(PREFIX.length))
}

export function bindSchema(schema: Record<string, unknown>) {
  const properties = schema.properties
  if (!properties || typeof properties !== "object" || !("session" in properties)) {
    return { schema, bindsSession: false }
  }
  const { session: _session, ...rest } = properties as Record<string, unknown>
  const required = Array.isArray(schema.required) ? schema.required.filter((value) => value !== "session") : undefined
  const { required: _required, ...base } = schema
  return {
    bindsSession: true,
    schema: {
      ...base,
      properties: rest,
      ...(required?.length ? { required } : {}),
    },
  }
}

export function bindToolSchema(key: string, schema: Record<string, unknown>) {
  if (!key.startsWith(PREFIX)) return { schema, bindsSession: false }
  return bindSchema(schema)
}

export function bindArguments(args: Record<string, unknown>, sessionID: string, bindsSession: boolean) {
  if (!bindsSession) return args
  if (Object.hasOwn(args, "session") && args.session !== sessionID) {
    throw new Error(`Computer Use tools cannot override the current NeCode Session ID (${sessionID})`)
  }
  return { ...args, session: sessionID }
}

type Dependencies = {
  status: () => Effect.Effect<Record<string, { status: string; error?: string }>>
  callTool: (client: string, tool: string, args: Record<string, unknown>) => Effect.Effect<unknown, unknown>
  setMetadata: (metadata: Record<string, unknown>) => Effect.Effect<void>
}

export const update = Effect.fn("SessionComputerUse.update")(function* (
  input: { sessionID: string; enabled: boolean; metadata?: Record<string, unknown> },
  dependencies: Dependencies,
) {
  if (input.enabled) {
    const state = (yield* dependencies.status())["cua-driver"]
    if (state?.status !== "connected") {
      return {
        enabled: false,
        error: `Cua Driver MCP ${state?.status ?? "is not configured"}${state?.error ? `: ${state.error}` : ""}`,
      }
    }
    yield* dependencies.setMetadata(metadata(input.metadata, true))
    return { enabled: true }
  }

  const cleanupError = yield* dependencies
    .callTool("cua-driver", "end_session", { session: input.sessionID })
    .pipe(
      Effect.match({
        onFailure: message,
        onSuccess: () => undefined,
      }),
    )
  yield* dependencies.setMetadata(metadata(input.metadata, false))
  if (cleanupError) yield* Effect.logError("failed to end Cua Driver session", { sessionID: input.sessionID, cleanupError })
  return { enabled: false, ...(cleanupError ? { error: cleanupError } : {}) }
})

function metadata(current: Record<string, unknown> | undefined, value: boolean) {
  const computerUse = current?.computerUse
  return {
    ...current,
    computerUse: {
      ...(computerUse && typeof computerUse === "object" ? computerUse : {}),
      enabled: value,
    },
  }
}

function message(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

export * as SessionComputerUse from "./computer-use"

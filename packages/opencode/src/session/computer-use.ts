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

export function enabled(session: { metadata?: Record<string, unknown> }) {
  const value = session.metadata?.computerUse
  if (!value || typeof value !== "object") return false
  return "enabled" in value && value.enabled === true
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

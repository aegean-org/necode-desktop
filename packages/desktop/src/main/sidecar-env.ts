import { join } from "node:path"

const XDG_CACHE_ROOT = "xdg-cache"
const XDG_CONFIG_ROOT = "xdg-config"
const XDG_DATA_ROOT = "xdg-data"
const XDG_STATE_ROOT = "xdg-state"
const DESKTOP_CONFIG_DIR = "necode-desktop"

/**
 * OpenCode CLI config override variables must not leak into NeCode Desktop.
 */
export const OPENCODE_CONFIG_OVERRIDE_KEYS = [
  "OPENCODE_CONFIG",
  "OPENCODE_CONFIG_CONTENT",
  "OPENCODE_CONFIG_DIR",
] as const

/**
 * Creates the runtime environment used by the NeCode desktop sidecar.
 */
export function createDesktopRuntimeEnv(input: { userDataPath: string; password?: string; configDir?: string }) {
  const configHome = join(input.userDataPath, XDG_CONFIG_ROOT)
  return {
    OPENCODE_CLIENT: "desktop",
    OPENCODE_CONFIG_DIR: join(configHome, input.configDir ?? DESKTOP_CONFIG_DIR),
    OPENCODE_EXPERIMENTAL_FILEWATCHER: "true",
    OPENCODE_EXPERIMENTAL_ICON_DISCOVERY: "true",
    ...(input.password !== undefined
      ? { OPENCODE_SERVER_PASSWORD: input.password, OPENCODE_SERVER_USERNAME: "necode" }
      : {}),
    XDG_CACHE_HOME: join(input.userDataPath, XDG_CACHE_ROOT),
    XDG_CONFIG_HOME: configHome,
    XDG_DATA_HOME: join(input.userDataPath, XDG_DATA_ROOT),
    XDG_STATE_HOME: join(input.userDataPath, XDG_STATE_ROOT),
  }
}

/**
 * Removes inherited OpenCode config overrides while preserving unrelated environment values.
 */
export function sanitizeInheritedOpenCodeEnv(input: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(input).filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined && !OPENCODE_CONFIG_OVERRIDE_KEYS.includes(entry[0] as (typeof OPENCODE_CONFIG_OVERRIDE_KEYS)[number]),
    ),
  )
}

import { join } from "node:path"
import { expect, test } from "bun:test"
import { createDesktopRuntimeEnv, sanitizeInheritedOpenCodeEnv } from "./src/main/sidecar-env"

test("desktop runtime env isolates opencode paths under NeCode user data", () => {
  const userDataPath = join("Users", "hu", "Library", "Application Support", "NeCode")
  const env = createDesktopRuntimeEnv({ password: "secret", userDataPath })

  expect(env).toMatchObject({
    OPENCODE_CLIENT: "desktop",
    OPENCODE_CONFIG_DIR: join(userDataPath, "xdg-config", "necode-desktop"),
    OPENCODE_EXPERIMENTAL_FILEWATCHER: "true",
    OPENCODE_EXPERIMENTAL_ICON_DISCOVERY: "true",
    OPENCODE_SERVER_PASSWORD: "secret",
    OPENCODE_SERVER_USERNAME: "necode",
    XDG_CACHE_HOME: join(userDataPath, "xdg-cache"),
    XDG_CONFIG_HOME: join(userDataPath, "xdg-config"),
    XDG_DATA_HOME: join(userDataPath, "xdg-data"),
    XDG_STATE_HOME: join(userDataPath, "xdg-state"),
  })
})

test("desktop runtime env can keep the legacy config directory after a failed migration", () => {
  const userDataPath = join("Users", "hu", "Library", "Application Support", "NeCode")

  expect(createDesktopRuntimeEnv({ userDataPath, configDir: "opencode" }).OPENCODE_CONFIG_DIR).toBe(
    join(userDataPath, "xdg-config", "opencode"),
  )
})

test("desktop runtime env drops inherited OpenCode config overrides", () => {
  expect(
    sanitizeInheritedOpenCodeEnv({
      OPENCODE_CONFIG: "/Users/hu/.config/opencode/config.json",
      OPENCODE_CONFIG_CONTENT: "{}",
      OPENCODE_CONFIG_DIR: "/Users/hu/.config/opencode",
      PATH: "/usr/bin",
    }),
  ).toEqual({ PATH: "/usr/bin" })
})

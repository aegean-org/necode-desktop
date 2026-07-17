import { randomUUID } from "node:crypto"
import { cpSync, existsSync, readdirSync, renameSync, rmSync } from "node:fs"
import { join } from "node:path"

const LEGACY_CONFIG_DIR = "opencode"
const DESKTOP_CONFIG_DIR = "necode-desktop"

type Input = {
  userDataPath: string
  log?: (message: string) => void
  rename?: typeof renameSync
  copy?: typeof cpSync
}

/** Migrates Desktop config files and returns the directory name this launch must use. */
export function migrateDesktopConfigDir(input: Input) {
  const root = join(input.userDataPath, "xdg-config")
  const legacy = join(root, LEGACY_CONFIG_DIR)
  const target = join(root, DESKTOP_CONFIG_DIR)
  if (existsSync(target)) return DESKTOP_CONFIG_DIR
  if (!existsSync(legacy)) return DESKTOP_CONFIG_DIR

  const rename = input.rename ?? renameSync
  try {
    rename(legacy, target)
    return DESKTOP_CONFIG_DIR
  } catch (error) {
    input.log?.(`desktop config migration move failed: ${message(error)}`)
  }

  const temporary = join(root, `${DESKTOP_CONFIG_DIR}.migrating-${randomUUID()}`)
  try {
    ;(input.copy ?? cpSync)(legacy, temporary, { recursive: true, errorOnExist: true })
    for (const entry of readdirSync(legacy)) {
      if (!existsSync(join(temporary, entry))) throw new Error(`copied config is missing ${entry}`)
    }
    rename(temporary, target)
    return DESKTOP_CONFIG_DIR
  } catch (error) {
    input.log?.(`desktop config migration copy failed: ${message(error)}`)
    if (existsSync(temporary)) {
      try {
        rmSync(temporary, { recursive: true, force: true })
      } catch (cleanupError) {
        input.log?.(`desktop config migration cleanup failed: ${message(cleanupError)}`)
      }
    }
    return LEGACY_CONFIG_DIR
  }
}

function message(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

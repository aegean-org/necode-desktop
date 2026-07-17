import { homedir } from "node:os"
import { posix, win32 } from "node:path"

export type CommandResult = { exitCode: number; stdout: string; stderr: string }

type Base = {
  platform: string
  path?: string
  version?: string
}

export type Status =
  | (Base & { status: "unsupported" })
  | (Base & { status: "not_installed" })
  | (Base & {
      status: "needs_permissions"
      permissions?: { accessibility: boolean; screenRecording: boolean }
      error?: string
    })
  | (Base & { status: "ready"; path: string; version: string })
  | (Base & { status: "failed"; error: string; exitCode?: number; stderr?: string })

type DetectInput = {
  platform?: string
  env?: Record<string, string | undefined>
  home?: string
  exists?: (path: string) => Promise<boolean>
  run?: (command: string[]) => Promise<CommandResult>
}

/** Discovers an external Cua Driver installation without changing host state. */
export async function detect(input: DetectInput = {}): Promise<Status> {
  const platform = input.platform ?? process.platform
  if (platform !== "win32" && platform !== "darwin") return { status: "unsupported", platform }

  const executable = await findExecutable({
    platform,
    env: input.env ?? process.env,
    home: input.home ?? homedir(),
    exists: input.exists ?? ((path) => Bun.file(path).exists()),
  })
  if (!executable) return { status: "not_installed", platform }

  const run = input.run ?? runCommand
  const version = await execute(run, [executable, "--version"])
  if (!version.ok) {
    return {
      status: "failed",
      platform,
      path: executable,
      error: version.error,
      exitCode: version.exitCode,
      stderr: version.stderr,
    }
  }
  const match = version.stdout.match(/cua-driver\s+([^\s]+)/i)
  if (!match) {
    return {
      status: "failed",
      platform,
      path: executable,
      error: `Unable to parse Cua Driver version from: ${version.stdout.trim() || "empty output"}`,
    }
  }
  if (platform === "win32") return { status: "ready", platform, path: executable, version: match[1] }

  const permissions = await execute(run, [executable, "permissions", "status", "--json"])
  if (!permissions.ok) {
    return {
      status: "failed",
      platform,
      path: executable,
      version: match[1],
      error: permissions.error,
      exitCode: permissions.exitCode,
      stderr: permissions.stderr,
    }
  }

  const parsed = parsePermissions(permissions.stdout)
  if (!parsed.ok) {
    return {
      status: "failed",
      platform,
      path: executable,
      version: match[1],
      error: parsed.error,
    }
  }
  if (parsed.accessibility && parsed.screenRecording) {
    return { status: "ready", platform, path: executable, version: match[1] }
  }
  return {
    status: "needs_permissions",
    platform,
    path: executable,
    version: match[1],
    permissions: {
      accessibility: parsed.accessibility,
      screenRecording: parsed.screenRecording,
    },
    error: parsed.reason,
  }
}

export function recovery(status: Status) {
  if (status.status === "unsupported") return `Computer Use is not supported on ${status.platform}.`
  if (status.status === "not_installed") {
    return "Cua Driver is not installed. Install it from https://cua.ai/cua-driver and restart NeCode."
  }
  if (status.status === "needs_permissions") {
    return `Cua Driver needs Accessibility and Screen Recording permission. Run: ${status.path ?? "cua-driver"} permissions grant${status.error ? ` (${status.error})` : ""}`
  }
  if (status.status === "failed") {
    return `Cua Driver check failed${status.path ? ` at ${status.path}` : ""}${status.exitCode === undefined ? "" : ` (exit ${status.exitCode})`}: ${status.error}`
  }
  return `Cua Driver ${status.version} is ready at ${status.path}`
}

async function findExecutable(input: {
  platform: "win32" | "darwin"
  env: Record<string, string | undefined>
  home: string
  exists: (path: string) => Promise<boolean>
}) {
  const path = input.env.PATH ?? input.env.Path ?? ""
  const separator = input.platform === "win32" ? ";" : ":"
  const join = input.platform === "win32" ? win32.join : posix.join
  const binary = input.platform === "win32" ? "cua-driver.exe" : "cua-driver"
  const fromPath = path
    .split(separator)
    .map((directory) => directory.trim())
    .filter(Boolean)
    .map((directory) => join(directory, binary))
  const defaults =
    input.platform === "win32"
      ? [
          win32.join(
            input.env.LOCALAPPDATA ?? win32.join(input.home, "AppData", "Local"),
            "Programs",
            "Cua",
            "cua-driver",
            "bin",
            binary,
          ),
        ]
      : [
          posix.join(input.home, ".local", "bin", binary),
          posix.join("/usr/local/bin", binary),
          posix.join("/opt/homebrew/bin", binary),
        ]

  for (const candidate of [...new Set([...fromPath, ...defaults])]) {
    if (await input.exists(candidate)) return candidate
  }
}

async function runCommand(command: string[]): Promise<CommandResult> {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  return { exitCode, stdout, stderr }
}

async function execute(run: (command: string[]) => Promise<CommandResult>, command: string[]) {
  try {
    const result = await run(command)
    if (result.exitCode === 0) return { ok: true as const, stdout: result.stdout }
    return {
      ok: false as const,
      error: result.stderr.trim() || result.stdout.trim() || `Command exited with ${result.exitCode}`,
      exitCode: result.exitCode,
      stderr: result.stderr,
    }
  } catch (error) {
    return { ok: false as const, error: message(error), stderr: message(error) }
  }
}

function parsePermissions(stdout: string) {
  try {
    const value = JSON.parse(stdout) as Record<string, unknown>
    return {
      ok: true as const,
      accessibility: value.accessibility === true,
      screenRecording: value.screen_recording === true,
      reason: typeof value.reason === "string" ? value.reason : undefined,
    }
  } catch (error) {
    return { ok: false as const, error: `Invalid Cua Driver permissions JSON: ${message(error)}` }
  }
}

function message(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

export * as ComputerUse from "./computer-use"

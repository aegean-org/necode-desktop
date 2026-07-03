import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFilePromise = promisify(execFile)
const WINDOWS_FONT_REGISTRY_KEYS = [
  "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts",
  "HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts",
] as const
const FONT_ENUMERATION_TIMEOUT = 10_000

export async function listSystemFonts() {
  if (process.platform === "win32") return listWindowsFonts()
  if (process.platform === "darwin") return listMacFonts()
  return listLinuxFonts()
}

export async function listWindowsFonts() {
  const outputs = await Promise.all(
    WINDOWS_FONT_REGISTRY_KEYS.map((key) =>
      execFilePromise("reg", ["query", key], { timeout: FONT_ENUMERATION_TIMEOUT }).then((result) => result.stdout),
    ),
  )
  return parseWindowsRegistryFonts(outputs.join("\n"))
}

export async function listMacFonts() {
  const result = await execFilePromise("system_profiler", ["SPFontsDataType", "-json"], {
    timeout: FONT_ENUMERATION_TIMEOUT,
    maxBuffer: 8 * 1024 * 1024,
  })
  return parseMacSystemProfilerFonts(result.stdout)
}

export async function listLinuxFonts() {
  const result = await execFilePromise("fc-list", [":", "family"], {
    timeout: FONT_ENUMERATION_TIMEOUT,
    maxBuffer: 8 * 1024 * 1024,
  })
  return parseFontConfigFamilies(result.stdout)
}

export function parseWindowsRegistryFonts(output: string) {
  return normalizeFamilies(
    output
      .split(/\r?\n/)
      .flatMap((line) => {
        const match = line.match(/^\s{2,}(.+?)\s+REG_\w+\s+.+$/)
        if (!match) return []
        return match[1]
          .replace(/\s+\([^)]*\)\s*$/u, "")
          .split("&")
          .map((family) => family.trim())
          .map(stripFaceStyle)
          .filter((family) => family && !family.startsWith("@"))
      }),
  )
}

export function parseFontConfigFamilies(output: string) {
  return normalizeFamilies(output.split(/\r?\n|,/).map((family) => family.trim()))
}

export function parseMacSystemProfilerFonts(output: string) {
  const parsed = JSON.parse(output) as { SPFontsDataType?: { family?: unknown; _name?: unknown }[] }
  return normalizeFamilies((parsed.SPFontsDataType ?? []).flatMap((font) => stringValue(font.family)))
}

function stringValue(value: unknown) {
  if (typeof value !== "string") return []
  return [value]
}

function stripFaceStyle(family: string) {
  return family
    .replace(/\s+Bold\s+Italic$/iu, "")
    .replace(/\s+Bold$/iu, "")
    .replace(/\s+Italic$/iu, "")
    .replace(/\s+Oblique$/iu, "")
    .replace(/\s+Regular$/iu, "")
}

function normalizeFamilies(families: readonly string[]) {
  return [
    ...families
      .reduce((map, family) => {
        const value = family.trim()
        if (!value) return map
        const key = value.toLowerCase()
        if (map.has(key)) return map
        return map.set(key, value)
      }, new Map<string, string>())
      .values(),
  ].sort(compareFontFamily)
}

function compareFontFamily(left: string, right: string) {
  const a = left.toLowerCase()
  const b = right.toLowerCase()
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

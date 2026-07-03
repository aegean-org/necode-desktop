type LocalFontData = {
  family: string
}

export type LocalFontSource = () => Promise<readonly LocalFontData[]>

export type SystemFontSource = {
  listSystemFonts?(): Promise<readonly string[]>
}

type LocalFontWindow = Window & {
  queryLocalFonts?: LocalFontSource
}

const APP_FONT_FAMILIES = ["Inter", "JetBrainsMono Nerd Font Mono"] as const

/** Font option rendered in settings font selectors. */
export type FontOption = Readonly<{
  id: string
  value: string
  label: string
}>

type FontOptionsInput = {
  available: readonly string[]
  current: string
  defaultLabel: string
}

/** Reads local font families from the browser Local Font Access API. */
export async function loadLocalFontFamilies(source: LocalFontSource = queryWindowLocalFonts) {
  return normalizeFontFamilies((await source()).map((font) => font.family))
}

/** Loads available font families, preferring native desktop enumeration over Chromium's local-font API. */
export async function loadAvailableFontFamilies(
  source: SystemFontSource = {},
  fallback: LocalFontSource = queryWindowLocalFonts,
) {
  const systemFonts = source.listSystemFonts
  if (systemFonts) return normalizeFontFamilies(await systemFonts())
  return loadLocalFontFamilies(fallback)
}

/** Formats local font access failures for visible settings UI errors. */
export function fontLoadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return `Unable to read local fonts: ${message}`
}

/** Builds stable settings options from app fonts, local fonts, and the current saved value. */
export function fontOptionsFor(input: FontOptionsInput): FontOption[] {
  const options = [
    { id: "system", value: "", label: input.defaultLabel },
    ...normalizeFontFamilies([...APP_FONT_FAMILIES, ...input.available]).map((family) => ({
      id: `font:${family}`,
      value: family,
      label: family,
    })),
  ]
  const current = input.current.trim()
  if (!current || options.some((option) => option.value.toLowerCase() === current.toLowerCase())) return options
  return [...options, { id: `font:${current}`, value: current, label: current }]
}

async function queryWindowLocalFonts() {
  if (typeof window === "undefined") throw new Error("Local font enumeration requires a browser window.")
  const source = (window as LocalFontWindow).queryLocalFonts
  if (!source) throw new Error("Local font enumeration is not available in this runtime.")
  return source()
}

function normalizeFontFamilies(families: readonly string[]) {
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

import { expect, test } from "bun:test"
import {
  fontLoadErrorMessage,
  fontOptionsFor,
  loadAvailableFontFamilies,
  loadLocalFontFamilies,
} from "./settings-font-options"

test("loadLocalFontFamilies returns sorted unique font families", async () => {
  const families = await loadLocalFontFamilies(() =>
    Promise.resolve([
      { family: "Roboto" },
      { family: "  " },
      { family: "Arial" },
      { family: "roboto" },
      { family: "Noto Sans CJK" },
    ]),
  )

  expect(families).toEqual(["Arial", "Noto Sans CJK", "Roboto"])
})

test("fontOptionsFor includes defaults, bundled fonts, local fonts, and the saved value", () => {
  const options = fontOptionsFor({
    available: ["Arial", "Inter"],
    current: "Missing Font",
    defaultLabel: "System Sans",
  })

  expect(options.map((option) => option.value)).toEqual([
    "",
    "Arial",
    "Inter",
    "JetBrainsMono Nerd Font Mono",
    "Missing Font",
  ])
  expect(options[0]).toEqual({ id: "system", value: "", label: "System Sans" })
})

test("fontOptionsFor gives the system default a non-empty select id", () => {
  expect(fontOptionsFor({ available: [], current: "", defaultLabel: "System Mono" })[0]?.id).toBe("system")
})

test("fontLoadErrorMessage exposes local font enumeration failures", () => {
  expect(fontLoadErrorMessage(new Error("permission denied"))).toBe("Unable to read local fonts: permission denied")
  expect(fontLoadErrorMessage("blocked")).toBe("Unable to read local fonts: blocked")
})

test("loadAvailableFontFamilies prefers desktop system font enumeration", async () => {
  const families = await loadAvailableFontFamilies({
    listSystemFonts: () => Promise.resolve(["System Font", "system font", "Another Font"]),
  })

  expect(families).toEqual(["Another Font", "System Font"])
})

test("loadAvailableFontFamilies falls back when native enumeration is not exposed", async () => {
  const families = await loadAvailableFontFamilies(
    {},
    () => Promise.resolve([{ family: "Chromium Font" }, { family: "chromium font" }]),
  )

  expect(families).toEqual(["Chromium Font"])
})

import { expect, test } from "bun:test"
import { parseFontConfigFamilies, parseMacSystemProfilerFonts, parseWindowsRegistryFonts } from "./fonts"

test("parseWindowsRegistryFonts extracts registry font family names", () => {
  const families = parseWindowsRegistryFonts(`
HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts
    Arial (TrueType)    REG_SZ    arial.ttf
    Microsoft YaHei & Microsoft YaHei UI (TrueType)    REG_SZ    msyh.ttc
    @Microsoft YaHei UI (TrueType)    REG_SZ    msyh.ttc
    Noto Sans Mono CJK SC Regular (OpenType)    REG_SZ    NotoSansMonoCJK-Regular.ttc
`)

  expect(families).toEqual(["Arial", "Microsoft YaHei", "Microsoft YaHei UI", "Noto Sans Mono CJK SC"])
})

test("parseFontConfigFamilies extracts and deduplicates fc-list families", () => {
  expect(parseFontConfigFamilies("Noto Sans CJK SC, Noto Sans CJK SC Regular\nArial\narial\n")).toEqual([
    "Arial",
    "Noto Sans CJK SC",
    "Noto Sans CJK SC Regular",
  ])
})

test("parseMacSystemProfilerFonts extracts font family names", () => {
  const families = parseMacSystemProfilerFonts(
    JSON.stringify({
      SPFontsDataType: [
        { family: "SF Pro" },
        { _name: "Menlo Regular", family: "Menlo" },
        { _name: "Menlo Bold", family: "Menlo" },
      ],
    }),
  )

  expect(families).toEqual(["Menlo", "SF Pro"])
})

import { expect, test } from "bun:test"
import { applyAppearanceFontVariables, newLayoutDesignsDefault } from "./settings"

test("new layout is enabled by default in packaged builds", () => {
  expect(newLayoutDesignsDefault).toBe(true)
})

test("applyAppearanceFontVariables updates legacy and v2 font variables", () => {
  const element = document.createElement("div")

  applyAppearanceFontVariables(element, {
    mono: "Cascadia Code",
    sans: "Microsoft YaHei UI",
  })

  expect(element.style.getPropertyValue("--font-family-mono")).toContain('"Cascadia Code"')
  expect(element.style.getPropertyValue("--font-family-sans")).toContain('"Microsoft YaHei UI"')
  expect(element.style.getPropertyValue("--font-family-text")).toContain('"Microsoft YaHei UI"')
  expect(element.style.getPropertyValue("--v2-font-family-sans")).toContain('"Microsoft YaHei UI"')
})

import { describe, expect, test } from "bun:test"

const productSource = await Bun.file(new URL("./product.ts", import.meta.url)).text().catch(() => "")
const desktopMenuSource = await Bun.file(new URL("./desktop-menu.ts", import.meta.url)).text()
const homeSource = await Bun.file(new URL("./pages/home.tsx", import.meta.url)).text()
const layoutSource = await Bun.file(new URL("./pages/layout.tsx", import.meta.url)).text()
const sessionSource = await Bun.file(new URL("./pages/session.tsx", import.meta.url)).text()
const errorSource = await Bun.file(new URL("./pages/error.tsx", import.meta.url)).text()
const appPackage = await Bun.file(new URL("../package.json", import.meta.url)).json()
const desktopPackage = await Bun.file(new URL("../../desktop/package.json", import.meta.url)).json()
const opencodePackage = await Bun.file(new URL("../../opencode/package.json", import.meta.url)).json()
const corePackage = await Bun.file(new URL("../../core/package.json", import.meta.url)).json()

describe("product entry points", () => {
  test("centralizes user-visible NeCode support links", () => {
    expect(productSource).toContain("PRODUCT_HOME_URL")
    expect(productSource).toContain("https://necode.ai")
    expect(productSource).toContain("PRODUCT_FEEDBACK_URL")

    for (const source of [homeSource, layoutSource, sessionSource, errorSource]) {
      expect(source).not.toContain("https://opencode.ai/desktop-feedback")
      expect(source).toContain("PRODUCT_FEEDBACK_URL")
    }
  })

  test("keeps desktop help menu on NeCode destinations", () => {
    expect(desktopMenuSource).toContain("NeCode Website")
    expect(desktopMenuSource).toContain("PRODUCT_HOME_URL")
    expect(desktopMenuSource).toContain("PRODUCT_FEEDBACK_URL")
    expect(desktopMenuSource).not.toContain("OpenCode Documentation")
    expect(desktopMenuSource).not.toContain("https://opencode.ai/docs")
    expect(desktopMenuSource).not.toContain("discord.com/invite/opencode")
    expect(desktopMenuSource).not.toContain("github.com/anomalyco/opencode/issues")
  })

  test("starts NeCode-visible product packages from their own version", () => {
    expect(appPackage.version).toBe("0.0.1")
    expect(desktopPackage.version).toBe("0.0.1")
    expect(opencodePackage.version).toBe("0.0.1")
    expect(corePackage.version).toBe("0.0.1")
  })
})

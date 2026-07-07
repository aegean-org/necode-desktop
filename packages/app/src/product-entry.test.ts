import { describe, expect, test } from "bun:test"
import { productProviderName } from "./product"

const productSource = await Bun.file(new URL("./product.ts", import.meta.url)).text().catch(() => "")
const desktopMenuSource = await Bun.file(new URL("./desktop-menu.ts", import.meta.url)).text()
const homeSource = await Bun.file(new URL("./pages/home.tsx", import.meta.url)).text()
const layoutSource = await Bun.file(new URL("./pages/layout.tsx", import.meta.url)).text()
const sessionSource = await Bun.file(new URL("./pages/session.tsx", import.meta.url)).text()
const errorSource = await Bun.file(new URL("./pages/error.tsx", import.meta.url)).text()
const dialogConnectProviderSource = await Bun.file(new URL("./components/dialog-connect-provider.tsx", import.meta.url)).text()
const dialogCustomProviderSource = await Bun.file(new URL("./components/dialog-custom-provider.tsx", import.meta.url)).text()
const settingsGeneralSource = await Bun.file(new URL("./components/settings-general.tsx", import.meta.url)).text()
const settingsGeneralV2Source = await Bun.file(new URL("./components/settings-v2/general.tsx", import.meta.url)).text()
const settingsProvidersSource = await Bun.file(new URL("./components/settings-providers.tsx", import.meta.url)).text()
const settingsProvidersV2Source = await Bun.file(new URL("./components/settings-v2/providers.tsx", import.meta.url)).text()
const wslSettingsModelSource = await Bun.file(new URL("./wsl/settings-model.ts", import.meta.url)).text()
const appPackage = await Bun.file(new URL("../package.json", import.meta.url)).json()
const desktopPackage = await Bun.file(new URL("../../desktop/package.json", import.meta.url)).json()
const opencodePackage = await Bun.file(new URL("../../opencode/package.json", import.meta.url)).json()
const corePackage = await Bun.file(new URL("../../core/package.json", import.meta.url)).json()

describe("product entry points", () => {
  test("centralizes user-visible NeCode support links", () => {
    expect(productSource).toContain("PRODUCT_HOME_URL")
    expect(productSource).toContain("https://necode.ai")
    expect(productSource).not.toContain("PRODUCT_FEEDBACK_URL")
    expect(productSource).toContain("PRODUCT_DOCS_URL")
    expect(productSource).toContain("PRODUCT_THEME_DOCS_URL")
    expect(productSource).toContain("PRODUCT_ZEN_URL")

    for (const source of [layoutSource, sessionSource, errorSource]) {
      expect(source).not.toContain("https://opencode.ai/desktop-feedback")
      expect(source).not.toContain("PRODUCT_FEEDBACK_URL")
    }
    expect(homeSource).not.toContain("https://opencode.ai/desktop-feedback")
    expect(homeSource).not.toContain("PRODUCT_FEEDBACK_URL")
  })

  test("keeps user-facing provider/docs links on NeCode destinations", () => {
    expect(dialogConnectProviderSource).toContain("PRODUCT_ZEN_URL")
    expect(dialogCustomProviderSource).toContain("PRODUCT_CUSTOM_PROVIDER_DOCS_URL")
    expect(settingsGeneralSource).toContain("PRODUCT_THEME_DOCS_URL")
    expect(settingsGeneralV2Source).toContain("PRODUCT_THEME_DOCS_URL")

    for (const source of [dialogConnectProviderSource, dialogCustomProviderSource, settingsGeneralSource, settingsGeneralV2Source]) {
      expect(source).not.toContain("https://opencode.ai/zen")
      expect(source).not.toContain("https://opencode.ai/docs")
    }
  })

  test("renames OpenCode service providers only at the user-facing presentation layer", () => {
    expect(productProviderName("opencode", "OpenCode Zen")).toBe("NeCode Zen")
    expect(productProviderName("opencode-go", "OpenCode Go")).toBe("NeCode Go")
    expect(productProviderName("anthropic", "Anthropic")).toBe("Anthropic")

    for (const source of [settingsProvidersSource, settingsProvidersV2Source, dialogConnectProviderSource]) {
      expect(source).toContain("productProviderName")
    }
  })

  test("uses NeCode wording for WSL desktop install/update prompts", () => {
    expect(wslSettingsModelSource).toContain("Install NeCode")
    expect(wslSettingsModelSource).toContain("Update NeCode")
    expect(wslSettingsModelSource).not.toContain("Install OpenCode")
    expect(wslSettingsModelSource).not.toContain("Update OpenCode")
  })

  test("hides feedback/help link entry points until a real support destination exists", () => {
    expect(desktopMenuSource).toContain("NeCode Website")
    expect(desktopMenuSource).toContain("PRODUCT_HOME_URL")
    expect(desktopMenuSource).not.toContain("PRODUCT_FEEDBACK_URL")
    expect(desktopMenuSource).not.toContain("Share Feedback")
    expect(desktopMenuSource).not.toContain("Report a Bug")
    expect(layoutSource).not.toContain("onOpenHelp")
    expect(sessionSource).not.toContain("openWorkflowHelp")
    expect(errorSource).not.toContain("error.page.report.feedback")
    expect(desktopMenuSource).not.toContain("OpenCode Documentation")
    expect(desktopMenuSource).not.toContain("https://opencode.ai/docs")
    expect(desktopMenuSource).not.toContain("discord.com/invite/opencode")
    expect(desktopMenuSource).not.toContain("github.com/anomalyco/opencode/issues")
  })

  test("uses NeCode branding on startup error page", () => {
    expect(errorSource).toContain("NeCode")
    expect(errorSource).not.toContain("Logo")
  })

  test("settings update check uses the desktop updater action", () => {
    for (const source of [settingsGeneralSource, settingsGeneralV2Source]) {
      expect(source).toContain("useUpdaterAction")
      expect(source).toContain("updater.run")
      expect(source).toContain("settings.updates.row.check.title")
    }
  })

  test("starts NeCode-visible product packages from their own version", () => {
    expect(appPackage.version).toBe("0.0.1")
    expect(desktopPackage.version).toBe("0.0.1")
    expect(opencodePackage.version).toBe("0.0.1")
    expect(corePackage.version).toBe("0.0.1")
  })
})

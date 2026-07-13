import { describe, expect, test } from "bun:test"

const mcpSource = await Bun.file(new URL("./mcp.tsx", import.meta.url)).text()
const controllerSource = await Bun.file(new URL("./mcp-controller.tsx", import.meta.url)).text()
const createFlowSource = await Bun.file(new URL("./mcp-create-dialog-flow.tsx", import.meta.url)).text()
const cssSource = await Bun.file(new URL("./settings-v2.css", import.meta.url)).text()
const settings = `${mcpSource}\n${controllerSource}`
const menuFile = Bun.file(new URL("./mcp-row-menu.tsx", import.meta.url))
const translations = await Promise.all(
  ["../../i18n/en.ts", "../../i18n/zh.ts", "../../i18n/zht.ts"].map((file) =>
    Bun.file(new URL(file, import.meta.url)).text(),
  ),
)

describe("desktop MCP settings contract", () => {
  test("gates persistent configuration behind the desktop platform", () => {
    expect(settings).toContain('platform.platform === "desktop"')
    expect(settings).toContain("enabled: desktop() && !!directory()")
    expect(settings).toContain('[serverSDK().scope, directory(), "settings", "mcp-config"]')
    expect(settings).toContain("mcpDisplayItems(controller.status.data ?? {})")
  })

  test("uses the generated persistent MCP client and refreshes both views", () => {
    expect(settings).toContain(".mcp.config.list()")
    expect(settings).toContain(".mcp.config.create({")
    expect(settings).toContain(".mcp.config.update({")
    expect(settings).toContain(".mcp.config.remove({ entryID: entry.id })")
    expect(settings).toContain("await config.refetch()")
    expect(settings).toContain("await status.refetch()")
  })

  test("exposes desktop add, edit, and remove actions", async () => {
    expect(settings).toContain('data-action="mcp-add"')
    expect(mcpSource).toContain('class="settings-v2-tab-header settings-v2-mcp-header"')
    expect(controllerSource).toContain("<McpCreateDialogFlow")
    expect(createFlowSource).toContain("<DialogMcpAdd")
    expect(createFlowSource).toContain("<DialogMcpImport")
    expect(createFlowSource).toContain("initialForm={form}")
    expect(createFlowSource).toContain("dialog.replace")
    expect(settings).toContain("DialogMcpRemove")
    expect(await menuFile.exists()).toBe(true)
    const menu = await menuFile.text()
    expect(menu).toContain("props.entry.canManage")
    expect(menu).toContain('language.t("settings.mcp.action.edit")')
    expect(menu).toContain('language.t("settings.mcp.action.remove")')
  })

  test("keeps overridden entries read-only at runtime", () => {
    expect(settings).toContain("entry.canToggle")
    expect(settings).toContain("entry.overriddenBy")
    expect(settings).toContain("settings.mcp.overridden.${props.entry.overriddenBy}")
  })

  test("defines the list management vocabulary in every dictionary", () => {
    const keys = [
      "settings.mcp.action.add",
      "settings.mcp.action.edit",
      "settings.mcp.action.remove",
      "settings.mcp.scope.project",
      "settings.mcp.scope.global",
      "settings.mcp.scope.builtin",
      "settings.mcp.overridden.project",
      "settings.mcp.addMethod.title",
      "settings.mcp.addMethod.import",
      "settings.mcp.addMethod.manual",
      "settings.mcp.import.title",
      "settings.mcp.import.config",
      "settings.mcp.import.placeholder",
      "settings.mcp.import.scope",
      "settings.mcp.import.check",
      "settings.mcp.import.error.invalidJsonc",
      "settings.mcp.import.error.singleEntry",
      "settings.mcp.import.error.invalidEntry",
      "settings.mcp.import.error.unsupportedField",
    ]
    translations.forEach((translation) => keys.forEach((key) => expect(translation).toContain(`"${key}"`)))
  })

  test("keeps the settings component below the file-size limit", () => {
    expect(mcpSource.split(/\r?\n/).length).toBeLessThanOrEqual(300)
  })

  test("shares the title-row layout rule with the RAG header", () => {
    expect(cssSource).toContain(
      ".settings-v2-rag-header .settings-v2-tab-header-row,\n.settings-v2-mcp-header .settings-v2-tab-header-row",
    )
  })
})

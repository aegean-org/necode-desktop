import { describe, expect, test } from "bun:test"

const files = [
  "dialog-mcp.tsx",
  "mcp-key-value-editor.tsx",
  "mcp-local-fields.tsx",
  "mcp-remote-fields.tsx",
  "dialog-mcp-remove.tsx",
] as const

const source = async (file: (typeof files)[number]) =>
  Bun.file(new URL(`./${file}`, import.meta.url))
    .text()
    .catch(() => "")

const dialogSource = await source("dialog-mcp.tsx")
const localSource = await source("mcp-local-fields.tsx")
const remoteSource = await source("mcp-remote-fields.tsx")
const removeSource = await source("dialog-mcp-remove.tsx")
const translations = await Promise.all(
  ["../../i18n/en.ts", "../../i18n/zh.ts", "../../i18n/zht.ts"].map((file) =>
    Bun.file(new URL(file, import.meta.url)).text(),
  ),
)

describe("desktop MCP dialog contract", () => {
  test("exposes the save, command, secret, and remove accessibility actions", () => {
    expect(dialogSource).toContain('data-action="mcp-save"')
    expect(localSource).toContain('data-action="mcp-command-add"')
    expect(remoteSource).toContain('type="password"')
    expect(removeSource).toContain('data-action="mcp-remove-confirm"')
    expect(removeSource).toContain("props.entry.scope")
  })

  test("keeps destructive type switching explicit and model-owned", () => {
    expect(dialogSource).toContain("replaceTypeFields(form, form.pendingType)")
    expect(dialogSource).toContain('language.t("settings.mcp.dialog.typeSwitch.message")')
    expect(dialogSource).toContain('language.t("settings.mcp.dialog.typeSwitch.cancel")')
    expect(dialogSource).toContain('language.t("settings.mcp.dialog.typeSwitch.confirm")')
  })

  test("defines the complete dialog vocabulary in supported Chinese dictionaries", () => {
    const keys = [
      "settings.mcp.dialog.addTitle",
      "settings.mcp.dialog.remove.description",
      "settings.mcp.dialog.field.name",
      "settings.mcp.dialog.local.command",
      "settings.mcp.dialog.remote.url",
      "settings.mcp.dialog.oauth.clientSecret",
      "settings.mcp.dialog.typeSwitch.message",
      "settings.mcp.dialog.error.duplicateKey",
    ]
    translations.forEach((translation) => keys.forEach((key) => expect(translation).toContain(`"${key}"`)))
  })

  test("keeps each dialog component below the file-size limit", async () => {
    for (const file of files) expect((await source(file)).split(/\r?\n/).length).toBeLessThanOrEqual(300)
  })
})

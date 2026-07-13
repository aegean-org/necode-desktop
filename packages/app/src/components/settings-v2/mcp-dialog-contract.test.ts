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
const keyValueSource = await source("mcp-key-value-editor.tsx")
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

  test("labels every SelectV2 trigger explicitly", () => {
    expectTag(functionBody(dialogSource, "ScopeField"), "SelectV2", [
      /aria-label=\{language\.t\("settings\.mcp\.dialog\.field\.scope"\)\}/,
    ])
    expectTag(functionBody(dialogSource, "TypeField"), "SelectV2", [
      /aria-label=\{language\.t\("settings\.mcp\.dialog\.field\.type"\)\}/,
    ])
    expectTag(functionBody(remoteSource, "OAuthFields"), "SelectV2", [
      /aria-label=\{language\.t\("settings\.mcp\.dialog\.oauth\.label"\)\}/,
    ])
  })

  test("associates field errors with stable input and error ids", () => {
    expectErrorAssociation(functionBody(dialogSource, "NameField"), "mcp-name", "mcp-name-error")
    expectErrorAssociation(functionBody(dialogSource, "TimeoutField"), "mcp-timeout", "mcp-timeout-error")
    expectErrorAssociation(functionBody(remoteSource, "UrlField"), "mcp-url", "mcp-url-error")

    const oauth = functionBody(remoteSource, "OAuthField")
    expect(oauth).toContain("const inputId = `mcp-oauth-${props.field}`")
    expect(oauth).toContain("const errorId = `${inputId}-error`")
    expectTag(oauth, "TextInputV2", [/id=\{inputId\}/, /aria-describedby=\{props\.invalid \? errorId : undefined\}/])
    expectTag(oauth, "span", [/id=\{errorId\}/, /class="settings-v2-mcp-error"/])
  })

  test("associates stable row inputs and row errors", () => {
    const command = functionBody(localSource, "CommandEditorRow")
    expect(command).toContain("const inputId = `${id}-input`")
    expect(command).toContain("const errorId = `${id}-error`")
    expectTag(command, "TextInputV2", [/id=\{inputId\}/, /aria-describedby=\{hasError\(\) \? errorId : undefined\}/])
    expectTag(command, "span", [/id=\{errorId\}/, /class="settings-v2-mcp-error"/])

    const keyValue = functionBody(keyValueSource, "KeyValueEditorRow")
    expect(keyValue).toContain("const ids = createRowIds(createUniqueId())")
    expectTag(keyValue, "TextInputV2", [/id=\{ids\.key\}/, /aria-describedby=\{error\(\) \? ids\.error : undefined\}/])
    expectTag(keyValue, "TextInputV2", [
      /id=\{ids\.value\}/,
      /aria-describedby=\{error\(\) \? ids\.error : undefined\}/,
    ])
    expectTag(keyValue, "span", [/id=\{ids\.error\}/, /class="settings-v2-mcp-row-error"/])
    expect(functionBody(keyValueSource, "createRowIds")).toContain(
      "return { row: id, key: `${id}-key`, value: `${id}-value`, error: `${id}-error` }",
    )
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

function functionBody(contents: string, name: string) {
  const start = contents.indexOf(`function ${name}(`)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = contents.indexOf("\nfunction ", start + 1)
  return contents.slice(start, end < 0 ? contents.length : end)
}

function expectErrorAssociation(contents: string, inputId: string, errorId: string) {
  expectTag(contents, "TextInputV2", [
    new RegExp(`id="${inputId}"`),
    new RegExp(`aria-describedby=\\{[^}]+ \\? "${errorId}" : undefined\\}`),
  ])
  expectTag(contents, "span", [new RegExp(`id="${errorId}"`), /class="settings-v2-mcp-error"/])
}

function expectTag(contents: string, tag: string, attributes: readonly RegExp[]) {
  const tags = [...contents.matchAll(new RegExp(`<${tag}\\b([\\s\\S]*?)(?:\\/>|>)`, "g"))].map((match) => match[1])
  expect(tags.some((candidate) => attributes.every((attribute) => attribute.test(candidate)))).toBe(true)
}

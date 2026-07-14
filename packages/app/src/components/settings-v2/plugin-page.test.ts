import { describe, expect, test } from "bun:test"

const settings = await Bun.file(new URL("./dialog-settings-v2.tsx", import.meta.url)).text()
const page = await Bun.file(new URL("./plugins.tsx", import.meta.url)).text()
const row = await Bun.file(new URL("./plugin-row.tsx", import.meta.url)).text()
const controller = await Bun.file(new URL("./plugin-controller.tsx", import.meta.url)).text()
const detail = await Bun.file(new URL("./dialog-plugin-detail.tsx", import.meta.url)).text()
const styles = await Bun.file(new URL("./plugin.css", import.meta.url)).text()

describe("desktop plugin settings page", () => {
  test("places the plugin tab between MCP and skills", () => {
    expect(settings).toContain('<TabsV2.Trigger value="plugins">')
    expect(settings.indexOf('value="mcp"')).toBeLessThan(settings.indexOf('value="plugins"'))
    expect(settings.indexOf('value="plugins"')).toBeLessThan(settings.indexOf('value="skills"'))
    expect(settings).toContain('<TabsV2.Content value="plugins"')
  })

  test("supports install, search, row details, and isolated row controls", () => {
    expect(page).toContain("settings.plugins.action.install")
    expect(page).toContain("settings.plugins.search.placeholder")
    expect(row).toContain("onClick={() => props.onOpen(props.entry)}")
    expect(row).toContain("event.stopPropagation()")
    expect(row).toContain("props.entry.canDisable")
    expect(row).toContain("props.entry.canUninstall")
  })

  test("keeps system components collapsed and renders real failure details", () => {
    expect(page).toContain("settings.plugins.section.system")
    expect(page).toContain("settings-v2-plugin-system-toggle")
    expect(controller).toContain("client().list()")
    expect(detail).toContain("error().stage")
    expect(detail).toContain("error().message")
  })

  test("keeps vertical space inside the plugin list", () => {
    expect(styles).toContain('.settings-v2-plugins [data-component="settings-v2-list"]')
    expect(styles).toContain("padding-block: 12px")
  })
})

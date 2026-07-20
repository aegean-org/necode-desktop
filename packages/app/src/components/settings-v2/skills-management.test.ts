import { describe, expect, test } from "bun:test"

const page = await Bun.file(new URL("./skills.tsx", import.meta.url)).text()
const install = await Bun.file(new URL("./dialog-skill-install.tsx", import.meta.url)).text()
const remove = await Bun.file(new URL("./dialog-skill-remove.tsx", import.meta.url)).text()
const settings = await Bun.file(new URL("./dialog-settings-v2.tsx", import.meta.url)).text()
const styles = await Bun.file(new URL("./settings-v2.css", import.meta.url)).text()

describe("settings Skill management", () => {
  test("offers URL and local installation with project or global scope", () => {
    expect(page).toContain("settings.skills.action.install")
    expect(install).toContain('value="url"')
    expect(install).toContain('value="local"')
    expect(install).toContain("settings.skills.scope.local")
    expect(install).toContain("settings.skills.scope.global")
  })

  test("uses the full dialog content width for install controls", () => {
    expect(install).toContain('class="settings-v2-skill-install-content"')
    expect(styles).toContain('.settings-v2-skill-field [data-component="text-input-v2"]')
    expect(styles).toContain('.settings-v2-skill-field [data-component="select-v2-root"]')
    expect(styles).toContain("padding-inline: 20px")
  })

  test("shows progress while a repository is downloading", () => {
    expect(install).toContain("settings.skills.dialog.install.installing")
    expect(install).toContain("settings.skills.dialog.install.progress")
    expect(install).toContain("aria-busy={state.pending}")
  })

  test("confirms installation and groups the changed skills at the top", () => {
    expect(page).toContain('role="status"')
    expect(page).toContain("settings-v2-skill-install-success")
    expect(page).toContain("settings.skills.toast.installed.title")
    expect(page).toContain("settings.skills.section.recent")
    expect(page).toContain("settings.skills.section.other")
  })

  test("requires an explicit second submit for cross-source replacement", () => {
    expect(install).toContain("SettingsSkillConflict")
    expect(install).toContain("replace: !!state.conflict")
    expect(install).toContain("settings.skills.dialog.install.replace")
  })

  test("only exposes removal for manager-installed skills", () => {
    expect(page).toContain("item.canUninstall")
    expect(page).toContain("DialogSkillRemove")
    expect(remove).toContain("settings.skills.dialog.remove.description")
    expect(styles).toContain(".settings-v2-skill-remove-dialog")
    expect(styles).toContain("width: min(440px, calc(100vw - 32px))")
    expect(styles).toContain("padding: 0 20px")
    expect(styles).toContain("overflow-wrap: anywhere")
  })

  test("uses the selected or routed project instead of a stale recent project", () => {
    expect(page).toContain("props.directory ?? decode64(params.dir)")
    expect(settings).toContain("<SettingsSkillsV2 directory={props.directory} />")
  })
})

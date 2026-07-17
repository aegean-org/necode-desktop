import { describe, expect, test } from "bun:test"
import { shouldUseTitlebarSessionTabs } from "./titlebar-workflow"

const titlebarSource = await Bun.file(new URL("./titlebar.tsx", import.meta.url)).text()

describe("shouldUseTitlebarSessionTabs", () => {
  test("disables titlebar session tabs in the workflow layout", () => {
    expect(shouldUseTitlebarSessionTabs({ workflowLayout: true })).toBe(false)
  })

  test("keeps legacy titlebar session tabs outside the workflow layout", () => {
    expect(shouldUseTitlebarSessionTabs({ workflowLayout: false })).toBe(true)
  })

  test("exposes back and forward controls in the v2 desktop titlebar", () => {
    const v2Source = titlebarSource.slice(titlebarSource.indexOf("<ChannelIndicator />"), titlebarSource.indexOf("<Show when={titlebarSessionTabs()}"))

    expect(v2Source).toContain("disabled={!canBack()}")
    expect(v2Source).toContain("disabled={!canForward()}")
    expect(v2Source).toContain("onClick={back}")
    expect(v2Source).toContain("onClick={forward}")
    expect(v2Source).toContain("<Show when={hasProjects()}>")
  })

  test("exposes a workflow navigation toggle at the start of the v2 titlebar", () => {
    const v2Source = titlebarSource.slice(titlebarSource.indexOf("<ChannelIndicator />"), titlebarSource.indexOf("<Show when={titlebarSessionTabs()}"))

    expect(v2Source).toContain("onClick={layout.workflowSidebar.toggle}")
    expect(v2Source).toContain("aria-expanded={layout.workflowSidebar.opened()}")
    expect(v2Source).toContain('name="sidebar-right" class="rotate-180"')
  })

  test("shares the workflow ambient background with the v2 titlebar", () => {
    expect(titlebarSource).toContain("WORKFLOW_SHELL_AMBIENT_BACKGROUND")
    expect(titlebarSource).toContain("before:bg-(image:--titlebar-background)")
    expect(titlebarSource).toContain('"--titlebar-background": useV2Titlebar() ? WORKFLOW_SHELL_AMBIENT_BACKGROUND : undefined')
    expect(titlebarSource).toContain("background: useV2Titlebar() ? WORKFLOW_SHELL_AMBIENT_BACKGROUND : undefined")
  })

  test("does not render a development channel badge", () => {
    expect(titlebarSource).not.toContain('["beta", "dev"].includes(import.meta.env.VITE_OPENCODE_CHANNEL)')
  })
})

import type { PluginEntry } from "@opencode-ai/sdk/v2/client"
import { afterEach, expect, mock, test } from "bun:test"
import { createSignal } from "solid-js"
import { render } from "solid-js/web"
import { pluginSections } from "../src/components/settings-v2/plugin-model"

const labels: Record<string, string> = {
  "settings.plugins.title": "Plugins",
  "settings.plugins.action.install": "Install plugin",
  "settings.plugins.action.remove": "Remove",
  "settings.plugins.search.placeholder": "Search plugins",
  "settings.plugins.section.builtin": "Built-in productivity",
  "settings.plugins.section.installed": "Installed plugins",
  "settings.plugins.section.system": "System components",
  "settings.plugins.status.active": "Active",
  "settings.plugins.status.failed": "Failed",
  "settings.plugins.scope.local": "Current project",
  "common.moreOptions": "More options",
}
const [filter, setFilter] = createSignal("")
const openInstall = mock()
const openDetail = mock()
const openRemove = mock()
const toggle = mock()
const entries = [
  plugin({
    key: "builtin:documents",
    id: "documents",
    name: "Documents plugin with an intentionally very long display name",
    source: "builtin",
    scope: "builtin",
    status: "failed",
    error: { stage: "initialize", message: "A very long initialization error that must remain visible in details" },
    canUninstall: false,
  }),
  plugin({
    key: "builtin:auth",
    id: "auth",
    name: "Authentication provider",
    system: true,
    canDisable: false,
    canUninstall: false,
  }),
]

mock.module("@/context/language", () => ({
  useLanguage: () => ({ t: (key: string) => labels[key] ?? key }),
}))
mock.module("../src/components/settings-v2/plugin-controller", () => ({
  usePluginSettings: () => ({
    language: { t: (key: string) => labels[key] ?? key },
    desktop: () => true,
    directory: () => "C:\\project",
    filter,
    setFilter,
    status: { isLoading: false, error: undefined },
    config: { isLoading: false, error: undefined },
    entries: () => pluginSections(entries, filter()),
    management: { toggle: { isPending: false, variables: undefined, mutate: toggle } },
    openInstall,
    openDetail,
    openRemove,
  }),
}))

const { SettingsPluginsV2 } = await import("../src/components/settings-v2/plugins")
const disposers: Array<() => void> = []

afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose())
  document.body.replaceChildren()
  setFilter("")
  openInstall.mockClear()
  openDetail.mockClear()
  openRemove.mockClear()
  toggle.mockClear()
})

test("manages plugin rows without leaking control clicks into row details", async () => {
  mount(() => <SettingsPluginsV2 />)
  ;(await button("Install plugin")).click()
  expect(openInstall).toHaveBeenCalledTimes(1)

  const row = await role("button", "Documents plugin with an intentionally very long display name")
  row.click()
  expect(openDetail).toHaveBeenCalledTimes(1)
  expect(await text("initialize: A very long initialization error that must remain visible in details")).toBeTruthy()

  const switchControl = await element('[role="switch"]')
  switchControl.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  expect(toggle).toHaveBeenCalledTimes(1)
  expect(openDetail).toHaveBeenCalledTimes(1)

  expect(document.body.textContent).not.toContain("Authentication provider")
  ;(await button("System components1")).click()
  expect(await text("Authentication provider")).toBeTruthy()
  expect(document.querySelectorAll('[role="switch"]')).toHaveLength(1)

  input(await element('input[type="search"]'), "missing")
  expect(await text("settings.plugins.empty")).toBeTruthy()
})

function plugin(input: Partial<PluginEntry> & Pick<PluginEntry, "key" | "id" | "name">): PluginEntry {
  return {
    spec: input.key,
    source: "npm",
    scope: "local",
    enabled: true,
    status: "active",
    system: false,
    canDisable: true,
    canUninstall: true,
    capabilities: [],
    tools: [],
    skills: [],
    ...input,
  }
}

function mount(open: () => HTMLElement) {
  const root = document.createElement("div")
  document.body.append(root)
  disposers.push(render(open, root))
}

async function button(name: string) {
  return find(() => [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === name))
}

async function role(name: string, textValue: string) {
  return find(() =>
    [...document.querySelectorAll(`[role="${name}"]`)].find((item) => item.textContent?.includes(textValue)),
  )
}

async function element(selector: string) {
  return find(() => document.querySelector(selector))
}

async function text(value: string) {
  return find(() => [...document.querySelectorAll("*")].find((item) => item.textContent?.trim() === value))
}

function input(target: Element, value: string) {
  if (!(target instanceof HTMLInputElement)) throw new Error("Expected input")
  target.value = value
  target.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }))
}

async function find<T>(read: () => T | null | undefined) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const value = read()
    if (value) return value
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  throw new Error(`Expected rendered value: ${document.body.innerHTML}`)
}

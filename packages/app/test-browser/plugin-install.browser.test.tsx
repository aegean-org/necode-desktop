import { DialogProvider, useDialog } from "@opencode-ai/ui/context/dialog"
import { afterEach, expect, mock, test } from "bun:test"
import { type JSX } from "solid-js"
import { render } from "solid-js/web"

const openDirectoryPickerDialog = mock(async () => "C:\\plugins\\demo")
const openFilePathPickerDialog = mock(async () => [{ path: "C:\\plugins\\demo.ts", name: "demo.ts", size: 10 }])
const labels: Record<string, string> = {
  "settings.plugins.dialog.install.title": "安装插件",
  "settings.plugins.dialog.install.method.npm": "npm 包",
  "settings.plugins.dialog.install.method.local": "本地插件",
  "settings.plugins.dialog.install.npm.label": "包名",
  "settings.plugins.dialog.install.npm.placeholder": "例如 @scope/plugin",
  "settings.plugins.dialog.install.local.path": "已选择路径",
  "settings.plugins.dialog.install.local.chooseDirectory": "选择插件目录",
  "settings.plugins.dialog.install.local.chooseFile": "选择入口文件",
  "settings.plugins.dialog.install.scope": "安装范围",
  "settings.plugins.scope.local": "当前项目",
  "settings.plugins.scope.global": "全局",
  "settings.plugins.dialog.install.action": "安装",
  "common.cancel": "取消",
}

mock.module("@/context/language", () => ({
  useLanguage: () => ({ t: (key: string) => labels[key] ?? key }),
}))
mock.module("@/context/platform", () => ({
  usePlatform: () => ({ platform: "desktop", openDirectoryPickerDialog, openFilePathPickerDialog }),
}))

const { DialogPluginInstall } = await import("../src/components/settings-v2/dialog-plugin-install")
const disposers: Array<() => void> = []

afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose())
  document.body.replaceChildren()
  openDirectoryPickerDialog.mockClear()
  openFilePathPickerDialog.mockClear()
})

test("selects a local plugin path and submits the current-project scope", async () => {
  const onSubmit = mock(async () => {})
  const dialog = mountProvider()
  await dialog.show(() => <DialogPluginInstall onSubmit={onSubmit} />)
  ;(await button("本地插件")).click()
  ;(await button("选择插件目录")).click()
  await find(() => openDirectoryPickerDialog.mock.calls.length === 1, "directory picker call")
  expect((await input("C:\\plugins\\demo")).value).toBe("C:\\plugins\\demo")
  ;(await button("安装")).click()

  await find(() => onSubmit.mock.calls.length === 1, "install submit")
  expect(onSubmit).toHaveBeenCalledWith({ spec: "C:\\plugins\\demo", scope: "local" })
  expect(openFilePathPickerDialog).not.toHaveBeenCalled()
})

function mountProvider() {
  let dialog: ReturnType<typeof useDialog> | undefined
  const root = document.createElement("div")
  document.body.append(root)
  disposers.push(
    render(
      () => (
        <DialogProvider>
          <CaptureDialog onReady={(value) => (dialog = value)} />
        </DialogProvider>
      ),
      root,
    ),
  )
  if (!dialog) throw new Error("Dialog context not initialized")
  return dialog
}

function CaptureDialog(props: { onReady: (dialog: ReturnType<typeof useDialog>) => void }) {
  props.onReady(useDialog())
  return null
}

async function button(name: string) {
  return find(
    () => [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === name),
    `button ${name}`,
  )
}

async function input(value: string) {
  return find(() => [...document.querySelectorAll("input")].find((item) => item.value === value), `input ${value}`)
}

async function find<T>(read: () => T | null | undefined, label = "element") {
  for (let attempt = 0; attempt < 20; attempt++) {
    const value = read()
    if (value) return value
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  throw new Error(`Expected ${label}: ${document.body.innerHTML}`)
}

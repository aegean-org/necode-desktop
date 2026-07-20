import { DialogProvider, useDialog } from "@opencode-ai/ui/context/dialog"
import { afterEach, expect, mock, test } from "bun:test"
import { type JSX } from "solid-js"
import { render } from "solid-js/web"

const labels: Record<string, string> = {
  "settings.skills.dialog.install.title": "安装 Skill",
  "settings.skills.dialog.install.method.url": "GitHub / URL",
  "settings.skills.dialog.install.method.local": "本地目录",
  "settings.skills.dialog.install.url.label": "GitHub 仓库或 Skill 源地址",
  "settings.skills.dialog.install.url.placeholder": "https://github.com/example/skills",
  "settings.skills.dialog.install.local.label": "Skill 目录",
  "settings.skills.dialog.install.local.placeholder": "选择包含 SKILL.md 的目录",
  "settings.skills.dialog.install.local.choose": "选择目录",
  "settings.skills.dialog.install.scope": "安装范围",
  "settings.skills.scope.local": "当前项目",
  "settings.skills.scope.global": "全局",
  "settings.skills.dialog.install.action": "安装",
  "settings.skills.dialog.install.installing": "安装中…",
  "settings.skills.dialog.install.progress": "正在下载并安装，较大的仓库可能需要一些时间。",
  "settings.skills.dialog.install.replace": "替换并安装",
  "common.cancel": "取消",
}

mock.module("@/context/language", () => ({
  useLanguage: () => ({ t: (key: string) => labels[key] ?? key }),
}))
mock.module("@/context/platform", () => ({
  usePlatform: () => ({ platform: "desktop", openDirectoryPickerDialog: mock(async () => undefined) }),
}))

const { DialogSkillInstall } = await import("../src/components/settings-v2/dialog-skill-install")
const disposers: Array<() => void> = []

afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose())
  document.body.replaceChildren()
})

test("submits the selected global scope from the install dialog", async () => {
  const pending = Promise.withResolvers<void>()
  const onSubmit = mock(() => pending.promise)
  const dialog = mountProvider()
  await dialog.show(() => <DialogSkillInstall onSubmit={onSubmit} />)

  const source = await find(() => document.querySelector("input"), "source input")
  source.value = " https://github.com/example/skills "
  source.dispatchEvent(new InputEvent("input", { bubbles: true }))

  const scope = await find(() => document.querySelector<HTMLElement>('[data-component="select-v2"]'), "scope select")
  scope.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }))
  ;(
    await find(
      () =>
        [...document.querySelectorAll<HTMLElement>('[data-component="menu-v2-item"]')].find(
          (item) => item.textContent?.trim() === "全局",
        ),
      "global scope option",
    )
  ).click()
  ;(await button("安装")).click()

  await find(() => onSubmit.mock.calls.length === 1, "install submit")
  expect((await button("安装中…")).disabled).toBe(true)
  expect(document.querySelector('[role="status"]')?.textContent).toContain("正在下载并安装")
  expect(onSubmit).toHaveBeenCalledWith({
    source: "https://github.com/example/skills",
    scope: "global",
    replace: false,
  })
  pending.resolve()
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

async function find<T>(read: () => T | null | undefined, label: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const value = read()
    if (value) return value
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  throw new Error(`Expected ${label}: ${document.body.innerHTML}`)
}

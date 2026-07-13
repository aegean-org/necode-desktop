import { DialogProvider, useDialog } from "@opencode-ai/ui/context/dialog"
import { afterEach, describe, expect, mock, test } from "bun:test"
import { createSignal, type JSX } from "solid-js"
import { render } from "solid-js/web"
import { createMcpForm } from "../src/components/settings-v2/mcp-form"

const labels: Record<string, string> = {
  "settings.mcp.addMethod.title": "Add MCP",
  "settings.mcp.addMethod.import": "Paste MCP config",
  "settings.mcp.addMethod.manual": "Manual config",
  "settings.mcp.import.title": "Paste MCP config",
  "settings.mcp.import.config": "MCP config",
  "settings.mcp.import.placeholder": "Paste JSON or JSONC",
  "settings.mcp.import.scope": "Scope",
  "settings.mcp.import.check": "Check config",
  "settings.mcp.import.error.invalidJsonc": "Invalid JSONC",
  "settings.mcp.dialog.addTitle": "Add MCP",
  "settings.mcp.dialog.field.name": "Name",
  "settings.mcp.dialog.field.scope": "Scope",
  "settings.mcp.dialog.field.type": "Type",
  "settings.mcp.dialog.field.timeout": "Timeout",
  "settings.mcp.dialog.field.timeoutPlaceholder": "Milliseconds",
  "settings.mcp.dialog.field.enabled": "Enabled",
  "settings.mcp.dialog.scope.project": "Project",
  "settings.mcp.dialog.scope.global": "Global",
  "settings.mcp.dialog.type.local": "Local",
  "settings.mcp.dialog.type.remote": "Remote",
  "settings.mcp.dialog.local.command": "Command",
  "settings.mcp.dialog.local.executable": "Executable",
  "settings.mcp.dialog.local.addArgument": "Add argument",
  "settings.mcp.dialog.local.cwd": "Working directory",
  "settings.mcp.dialog.local.cwdPlaceholder": "Optional working directory",
  "settings.mcp.dialog.local.environment": "Environment",
  "settings.mcp.dialog.local.environmentKey": "NAME",
  "settings.mcp.dialog.local.environmentValue": "Value",
  "settings.mcp.dialog.error.duplicate": "This name already exists",
  "common.cancel": "Cancel",
  "common.save": "Save",
}

mock.module("@/context/language", () => ({
  useLanguage: () => ({ t: (key: string) => labels[key] ?? key }),
}))

const { DialogMcpAdd } = await import("../src/components/settings-v2/dialog-mcp-add")
const { DialogMcpImport } = await import("../src/components/settings-v2/dialog-mcp-import")
const { DialogMcp } = await import("../src/components/settings-v2/dialog-mcp")
const { McpCreateDialogFlow } = await import("../src/components/settings-v2/mcp-create-dialog-flow")
const LOCAL_CONFIG = `{"mcp":{"demo":{"type":"local","command":["demo"]}}}`
const disposers: Array<() => void> = []

afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose())
  document.body.replaceChildren()
})

describe("desktop MCP browser add flow", () => {
  test("uses live existing entries when the imported form is finally saved", async () => {
    const [existingEntries, setExistingEntries] = createSignal<
      readonly { name: string; scope: "project" | "global" }[]
    >([])
    const onSubmit = mock(async () => {})
    const dialog = mountProvider()
    await dialog.push(() => <div data-testid="parent">Parent</div>)
    await dialog.push(() => <McpCreateDialogFlow existingEntries={existingEntries} onSubmit={onSubmit} />)
    ;(await button("Paste MCP config")).click()
    input(await element("textarea"), LOCAL_CONFIG)
    ;(await button("Check config")).click()

    expect(onSubmit).not.toHaveBeenCalled()
    expect(((await element("#mcp-name")) as HTMLInputElement).value).toBe("demo")
    expect(document.querySelector('[data-testid="parent"]')).not.toBeNull()

    setExistingEntries([{ name: "demo", scope: "project" }])
    ;(await button("Save")).click()
    expect(await text("This name already exists")).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()

    setExistingEntries([])
    ;(await button("Save")).click()
    await find(() => onSubmit.mock.calls.length === 1)
    expect(document.querySelector('[data-testid="parent"]')).not.toBeNull()
  })

  test("accepts an imported project entry when the same name exists only globally", async () => {
    const onSubmit = mock(async () => {})
    const dialog = mountProvider()
    await dialog.push(() => (
      <McpCreateDialogFlow existingEntries={() => [{ name: "demo", scope: "global" }]} onSubmit={onSubmit} />
    ))
    ;(await button("Paste MCP config")).click()
    input(await element("textarea"), LOCAL_CONFIG)
    ;(await button("Check config")).click()
    ;(await button("Save")).click()

    await find(() => onSubmit.mock.calls.length === 1)
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "demo", scope: "project" }))
  })

  test("manual creation replaces only the method picker", async () => {
    const dialog = mountProvider()
    await dialog.push(() => <div data-testid="parent">Parent</div>)
    await dialog.push(() => <McpCreateDialogFlow existingEntries={() => []} onSubmit={async () => {}} />)
    ;(await button("Manual config")).click()

    expect(await element("#mcp-name")).toBeTruthy()
    expect(document.querySelector('[data-testid="parent"]')).not.toBeNull()
    expect(document.querySelectorAll("[data-dialog-layer]")).toHaveLength(2)
    expect([...document.querySelectorAll("button")].some((item) => item.textContent?.trim() === "Manual config")).toBe(
      false,
    )
  })

  test("method buttons invoke manual and import callbacks", async () => {
    const onManual = mock()
    const onImport = mock()
    mountDialog(() => <DialogMcpAdd onManual={onManual} onImport={onImport} />)
    ;(await button("Manual config")).click()
    ;(await button("Paste MCP config")).click()

    expect(onManual).toHaveBeenCalledTimes(1)
    expect(onImport).toHaveBeenCalledTimes(1)
  })

  test("import parses before continuing", async () => {
    const onContinue = mock()
    mountDialog(() => <DialogMcpImport scope="project" onContinue={onContinue} />)

    input(await element("textarea"), LOCAL_CONFIG)
    ;(await button("Check config")).click()

    expect(onContinue).toHaveBeenCalledWith(expect.objectContaining({ name: "demo", type: "local" }))
  })

  test("import displays an explicit parse error", async () => {
    const onContinue = mock()
    mountDialog(() => <DialogMcpImport scope="project" onContinue={onContinue} />)

    input(await element("textarea"), "{")
    ;(await button("Check config")).click()

    expect(await text("Invalid JSONC")).toBeTruthy()
    expect(onContinue).not.toHaveBeenCalled()
  })

  test("initialForm populates the editable form", async () => {
    mountDialog(() => (
      <DialogMcp
        initialForm={{ ...createMcpForm(), name: "demo", command: [{ value: "demo" }] }}
        existingEntries={[]}
        onSubmit={async () => {}}
      />
    ))

    expect(((await element("#mcp-name")) as HTMLInputElement).value).toBe("demo")
  })
})

function mountDialog(open: () => JSX.Element) {
  const dialog = mountProvider()
  void dialog.show(open)
}

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
  return find(() => [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === name))
}

function input(target: Element, value: string) {
  if (!(target instanceof HTMLTextAreaElement)) throw new Error("Expected textarea")
  target.value = value
  target.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }))
}

async function element(selector: string) {
  return find(() => document.querySelector(selector))
}

async function text(value: string) {
  return find(() => [...document.querySelectorAll("*")].find((item) => item.textContent?.trim() === value))
}

async function find<T>(read: () => T | null | undefined) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const value = read()
    if (value) return value
    await Promise.resolve()
  }
  throw new Error("Expected rendered element")
}

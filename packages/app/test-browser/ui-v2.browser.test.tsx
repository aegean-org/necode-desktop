import { DialogProvider, useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { afterEach, describe, expect, test } from "bun:test"
import { render } from "solid-js/web"

type Dialog = ReturnType<typeof useDialog>
const disposers: Array<() => void> = []

afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose())
  document.body.replaceChildren()
})

describe("browser v2 Icon", () => {
  test("renders every supported literal without falling back to plus", () => {
    const root = document.createElement("div")
    document.body.append(root)
    disposers.push(render(() => <Icon name="copy" />, root))
    expect(root.querySelector("use")?.getAttribute("href")).toBe("#opencode-v2-icon-copy")
  })

  test("throws for an unknown runtime name", () => {
    const root = document.createElement("div")
    expect(() => render(() => <Icon name={"missing" as never} />, root)).toThrow("Unknown v2 icon: missing")
    expect(root.querySelector('use[href="#opencode-v2-icon-plus"]')).toBeNull()
  })
})

describe("dialog stack", () => {
  test("replace changes only the top dialog", async () => {
    const dialog = mountProvider()
    await dialog.push(() => <div data-testid="parent">Parent</div>)
    await dialog.push(() => <div data-testid="child">Child</div>)
    await dialog.replace(() => <div data-testid="replacement">Replacement</div>)
    expect(document.querySelector('[data-testid="parent"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="child"]')).toBeNull()
    expect(document.querySelector('[data-testid="replacement"]')).not.toBeNull()
    expect(document.querySelectorAll("[data-dialog-layer]")).toHaveLength(2)
  })
})

function mountProvider() {
  let dialog: Dialog | undefined
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

function CaptureDialog(props: { onReady: (dialog: Dialog) => void }) {
  props.onReady(useDialog())
  return null
}

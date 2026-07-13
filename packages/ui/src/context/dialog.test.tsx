import { afterEach, describe, expect, test } from "bun:test"
import type { JSX } from "solid-js"
import { render } from "solid-js/web"
import { DialogProvider, useDialog } from "./dialog"

type Dialog = ReturnType<typeof useDialog>
type Replace = (element: () => JSX.Element, onClose?: () => void) => unknown
const disposers: Array<() => void> = []

afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose())
  document.body.replaceChildren()
})

describe("dialog stack", () => {
  test("replace changes only the top dialog", async () => {
    const dialog = mountProvider() as Dialog & { replace?: Replace }
    await dialog.push(() => <div data-testid="parent">Parent</div>)
    await dialog.push(() => <div data-testid="child">Child</div>)

    expect(typeof dialog.replace).toBe("function")
    if (!dialog.replace) return
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

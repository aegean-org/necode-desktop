import { describe, expect, test } from "bun:test"

const source = await Bun.file(new URL("./session-review.tsx", import.meta.url)).text()
const styles = await Bun.file(new URL("./session-review.css", import.meta.url)).text()
const tooltip = await Bun.file(new URL("./tooltip.tsx", import.meta.url)).text()

describe("session review file actions", () => {
  test("renders large diffs immediately when a file is manually expanded", () => {
    expect(source).toContain("const handleFileChange = (next: string[]) => {")
    expect(source).toContain('setStore("force", file, true)')
    expect(source).toContain("<Accordion multiple value={open()} onChange={handleFileChange}>")
  })

  test("defers expensive diff parsing until a file needs content", () => {
    expect(source).toContain("const viewCache = new Map")
    expect(source).toContain("Object.fromEntries(list(props.diffs).map((diff) => [diff.file, diff]))")
    expect(source).toContain("const view = () => viewDiff(file)")
  })

  test("keeps internal and external file actions separate", () => {
    expect(source).toContain("onOpenFileExternally?: (file: string) => void")
    expect(source).toContain('<Icon name="code" size="small" />')
    expect(source).toContain('<Icon name="square-arrow-top-right" size="small" />')
    expect(styles).toContain('[data-slot="session-review-file-actions"]')
  })

  test("keeps file action buttons outside the accordion trigger", () => {
    const row = source.indexOf('data-slot="session-review-row"')
    const triggerEnd = source.indexOf("</Accordion.Trigger>", row)
    const actions = source.indexOf('data-slot="session-review-file-actions"', row)

    expect(row).toBeGreaterThanOrEqual(0)
    expect(triggerEnd).toBeGreaterThan(row)
    expect(actions).toBeGreaterThan(triggerEnd)
  })

  test("shows the complete path after a deliberate hover", () => {
    expect(source).toContain('data-slot="session-review-full-path"')
    expect(source).toContain("{file}</span>")
    expect(source).toContain("openDelay={500}")
    expect(source).toContain('placement={index() === 0 ? "bottom-start" : "top-start"}')
    expect(source).toContain("flip")
    expect(source).toContain("slide")
    expect(tooltip).toContain("hoverTimer = window.setTimeout")
    expect(tooltip).toContain("if (local.openDelay && local.openDelay > 0 && open) return")
  })
})

import { describe, expect, test } from "bun:test"
import { parseMcpImport } from "./mcp-import"

const addSource = await Bun.file(new URL("./dialog-mcp-add.tsx", import.meta.url)).text()
const importSource = await Bun.file(new URL("./dialog-mcp-import.tsx", import.meta.url)).text()
const LOCAL_CONFIG = `{"mcp":{"demo":{"type":"local","command":["demo"]}}}`

describe("desktop MCP add flow", () => {
  test("manual add opens the existing form", () => {
    expect(addSource).toContain("export function DialogMcpAdd")
    expect(addSource).toContain("onClick={props.onManual}")
    expect(addSource).toContain('language.t("settings.mcp.addMethod.manual")')
  })

  test("import parses before opening the form", () => {
    expect(parseMcpImport(LOCAL_CONFIG, "project")).toEqual({
      form: expect.objectContaining({ name: "demo", type: "local" }),
    })
    expect(importSource.indexOf("parseMcpImport(store.text, store.scope)")).toBeLessThan(
      importSource.indexOf("props.onContinue(result.form)"),
    )
  })

  test("import keeps text, scope, and explicit parse errors in one store", () => {
    expect(importSource).toContain("const [store, setStore] = createStore<ImportStore>({")
    expect(importSource).toContain('text: ""')
    expect(importSource).toContain("scope: props.scope")
    expect(importSource).toContain("error: undefined as McpImportError | undefined")
  })
})

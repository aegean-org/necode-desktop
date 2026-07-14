import { describe, expect, mock, test } from "bun:test"
import { pluginClient } from "./plugin-client"

describe("plugin client", () => {
  test("uses the generated runtime and config operations with directory scope", async () => {
    const list = mock(async () => ({ data: [{ key: "builtin:pdf" }] }))
    const configList = mock(async () => ({ data: [{ key: "builtin:pdf" }] }))
    const install = mock(async () => ({ data: [] }))
    const update = mock(async () => ({ data: [] }))
    const remove = mock(async () => ({ data: [] }))
    const createClient = mock(() => ({
      plugin: { list, config: { list: configList, install, update, remove } },
    }))
    const client = pluginClient("C:\\workspace", { createClient } as never)

    expect((await client.list())[0]?.key).toBe("builtin:pdf")
    expect((await client.config())[0]?.key).toBe("builtin:pdf")
    await client.install("@scope/demo", "global")
    await client.setEnabled("builtin:pdf", false)
    await client.remove("npm:@scope/demo")

    expect(createClient).toHaveBeenCalledWith({ directory: "C:\\workspace", throwOnError: true })
    expect(install).toHaveBeenCalledWith({ scope: "global", spec: "@scope/demo" })
    expect(update).toHaveBeenCalledWith({ pluginKey: "builtin:pdf", enabled: false })
    expect(remove).toHaveBeenCalledWith({ pluginKey: "npm:@scope/demo" })
  })

  test("rejects an empty project directory", () => {
    expect(() => pluginClient("", { createClient: () => ({}) } as never)).toThrow("project directory")
  })
})

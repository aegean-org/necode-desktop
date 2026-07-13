import { expect, test } from "bun:test"
import { pluginStatusClass } from "./plugin-status-query"

const source = await Bun.file(new URL("./status-popover-body.tsx", import.meta.url)).text()

test("status popover renders the real plugin registry", () => {
  expect(source).not.toContain("sync().data.config.plugin")
  expect(source).not.toContain('class="size-1.5 rounded-full shrink-0 bg-icon-success-base"')
  expect(source).toContain("usePluginStatusQuery(props.shown)")
  expect(source).toContain('<x.DialogSettings defaultTab="plugins" />')
  expect(pluginStatusClass("active")).toContain("success")
  expect(pluginStatusClass("disabled")).toContain("weak")
  expect(pluginStatusClass("failed")).toContain("critical")
  expect(pluginStatusClass("incompatible")).toContain("critical")
})

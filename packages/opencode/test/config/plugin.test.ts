import { expect, test } from "bun:test"
import { pathToFileURL } from "url"
import path from "path"
import { ConfigPlugin } from "@/config/plugin"
import { Filesystem } from "@/util/filesystem"

test("creates stable keys for npm and local plugins", () => {
  const local = path.join(process.cwd(), "fixtures", "demo-plugin")

  expect(ConfigPlugin.key("@scope/demo@1.2.3")).toBe("npm:@scope/demo")
  expect(ConfigPlugin.key(pathToFileURL(local).href)).toBe(`file:${Filesystem.resolve(local)}`)
})

test("uses the package identity for tuple plugin specs", () => {
  expect(ConfigPlugin.key(["demo@2.0.0", { feature: true }])).toBe("npm:demo")
})

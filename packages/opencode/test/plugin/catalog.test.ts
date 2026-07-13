import { expect, test } from "bun:test"
import path from "path"
import { pathToFileURL } from "url"
import { PluginCatalog } from "@/plugin/catalog"
import { tmpdir } from "../fixture/fixture"

test("resolves local plugin metadata and skill roots", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(path.join(dir, "server.js"), "export default async () => ({ tool: {} })")
      await Bun.write(path.join(dir, "skills", "demo", "SKILL.md"), "---\nname: demo\n---\n")
      await Bun.write(
        path.join(dir, "package.json"),
        JSON.stringify({
          name: "demo-plugin",
          version: "1.2.3",
          exports: { "./server": "./server.js" },
          necode: {
            plugin: {
              id: "demo",
              name: "Demo Plugin",
              description: "Demo tools",
              skills: ["./skills"],
            },
          },
        }),
      )
    },
  })

  const entry = await PluginCatalog.resolveExternal({
    origin: { spec: pathToFileURL(tmp.path).href, source: "opencode.json", scope: "local" },
    enabled: true,
  })

  expect(entry).toMatchObject({
    key: `file:${tmp.path}`,
    source: "file",
    scope: "local",
    enabled: true,
    system: false,
    canDisable: true,
    canUninstall: true,
  })
  expect(entry.manifest).toMatchObject({ id: "demo", name: "Demo Plugin", skills: [path.join(tmp.path, "skills")] })
  expect(entry.resolved?.entry).toBe(pathToFileURL(path.join(tmp.path, "server.js")).href)
})

test("surfaces manifest paths that escape the plugin package", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(path.join(dir, "server.js"), "export default async () => ({})")
      await Bun.write(
        path.join(dir, "package.json"),
        JSON.stringify({
          name: "unsafe-plugin",
          exports: { "./server": "./server.js" },
          necode: { plugin: { id: "unsafe", name: "Unsafe", skills: ["../outside"] } },
        }),
      )
    },
  })

  const entry = await PluginCatalog.resolveExternal({
    origin: { spec: pathToFileURL(tmp.path).href, source: "opencode.json", scope: "local" },
    enabled: true,
  })

  expect(entry.failure?.stage).toBe("manifest")
  expect(entry.failure?.message).toContain("outside plugin directory")
})

import { describe, expect } from "bun:test"
import { Context, Effect, Layer } from "effect"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { ConfigPlugin } from "../../src/config/plugin"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import { InstancePaths } from "../../src/server/routes/instance/httpapi/groups/instance"
import { resetDatabase } from "../fixture/db"
import { TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const context = Context.empty() as Context.Context<unknown>
const state = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* Effect.promise(() => resetDatabase())
    yield* Effect.addFinalizer(() => Effect.promise(() => resetDatabase()).pipe(Effect.ignore))
  }),
)
const it = testEffect(state)

describe("skill HttpApi", () => {
  it.instance(
    "installs, verifies, lists, and removes managed skills",
    () =>
      Effect.gen(function* () {
        const tmp = yield* TestInstance
        const source = path.join(tmp.directory, "skill-source")
        yield* Effect.promise(() =>
          Bun.write(
            path.join(source, "demo", "SKILL.md"),
            `---\nname: demo\ndescription: Managed demo.\n---\n\n# Demo\n`,
          ),
        )
        const handler = HttpApiApp.webHandler()
        const installed = yield* request(handler, InstancePaths.skill, tmp.directory, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source, scope: "local", replace: false }),
        })
        expect(installed.status, yield* Effect.promise(() => installed.clone().text())).toBe(200)
        expect(
          (yield* json<Array<{ name: string; canUninstall?: boolean }>>(installed)).find(
            (item) => item.name === "demo",
          ),
        ).toMatchObject({ canUninstall: true })

        const removed = yield* request(handler, `${InstancePaths.skill}/${encodeURIComponent("demo")}`, tmp.directory, {
          method: "DELETE",
        })
        expect(removed.status).toBe(200)
        expect((yield* json<Array<{ name: string }>>(removed)).some((item) => item.name === "demo")).toBe(false)
      }),
    { git: true },
    15_000,
  )

  it.instance(
    "lets a managed skill shadow a same-named plugin skill until uninstall",
    () =>
      Effect.gen(function* () {
        const tmp = yield* TestInstance
        const plugin = path.join(tmp.directory, "skill-plugin")
        const spec = pathToFileURL(plugin).href
        const source = path.join(tmp.directory, "skill-source")
        yield* Effect.promise(async () => {
          await Bun.write(path.join(plugin, "server.js"), "export default async () => ({})")
          await Bun.write(
            path.join(plugin, "skills", "demo", "SKILL.md"),
            "---\nname: shared-skill\ndescription: Plugin skill.\n---\n\n# Plugin\n",
          )
          await Bun.write(
            path.join(plugin, "package.json"),
            JSON.stringify({
              name: "skill-plugin",
              exports: { "./server": "./server.js" },
              necode: { plugin: { id: "skill-plugin", name: "Skill Plugin", skills: ["./skills"] } },
            }),
          )
          await Bun.write(
            path.join(tmp.directory, "opencode.json"),
            JSON.stringify({ plugin: [spec], plugin_enabled: { [ConfigPlugin.key(spec)]: true } }),
          )
          await Bun.write(
            path.join(source, "demo", "SKILL.md"),
            "---\nname: shared-skill\ndescription: Managed skill.\n---\n\n# Managed\n",
          )
        })

        const handler = HttpApiApp.webHandler()
        const installed = yield* request(handler, InstancePaths.skill, tmp.directory, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source, scope: "local", replace: false }),
        })
        expect(installed.status, yield* Effect.promise(() => installed.clone().text())).toBe(200)
        expect(
          (yield* json<Array<{ name: string; source?: string; canUninstall?: boolean }>>(installed)).find(
            (item) => item.name === "shared-skill",
          ),
        ).toMatchObject({ source: "managed", canUninstall: true })

        const removed = yield* request(
          handler,
          `${InstancePaths.skill}/${encodeURIComponent("shared-skill")}`,
          tmp.directory,
          { method: "DELETE" },
        )
        expect(removed.status).toBe(200)
        expect(
          (yield* json<Array<{ name: string; source?: string; canUninstall?: boolean }>>(removed)).find(
            (item) => item.name === "shared-skill",
          ),
        ).toMatchObject({ source: "plugin", canUninstall: false })
      }),
    { git: true },
    15_000,
  )
})

type Handler = ReturnType<typeof HttpApiApp.webHandler>

const request = Effect.fnUntraced(function* (handler: Handler, route: string, directory: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set("x-opencode-directory", directory)
  return yield* Effect.promise(() =>
    Promise.resolve(handler.handler(new Request(`http://localhost${route}`, { ...init, headers }), context)),
  )
})

const json = <A>(response: Response) => Effect.promise(() => response.json() as Promise<A>)

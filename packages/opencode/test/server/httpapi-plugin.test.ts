import { describe, expect } from "bun:test"
import { Context, Effect, Layer } from "effect"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import { PluginPaths } from "../../src/server/routes/instance/httpapi/groups/plugin"
import { resetDatabase } from "../fixture/db"
import { TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const context = Context.empty() as Context.Context<unknown>
const testStateLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* Effect.promise(() => resetDatabase())
    yield* Effect.addFinalizer(() => Effect.promise(() => resetDatabase()).pipe(Effect.ignore))
  }),
)
const it = testEffect(testStateLayer)

type TestHandler = ReturnType<typeof HttpApiApp.webHandler>

const request = Effect.fnUntraced(function* (
  handler: TestHandler,
  route: string,
  directory: string,
  init?: RequestInit,
) {
  const headers = new Headers(init?.headers)
  headers.set("x-opencode-directory", directory)
  return yield* Effect.promise(() =>
    Promise.resolve(handler.handler(new Request(`http://localhost${route}`, { ...init, headers }), context)),
  )
})

const json = <A>(response: Response) => Effect.promise(() => response.json() as Promise<A>)

describe("plugin HttpApi", () => {
  it.instance(
    "serves runtime status and persistent install, enablement, and removal",
    () =>
      Effect.gen(function* () {
        const tmp = yield* TestInstance
        const handler = HttpApiApp.webHandler()
        const plugin = yield* createPlugin(tmp.directory)
        const installed = yield* request(handler, PluginPaths.config, tmp.directory, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scope: "local", spec: plugin }),
        })
        expect(installed.status, yield* Effect.promise(() => installed.clone().text())).toBe(200)
        const entries = yield* json<Array<{ key: string; enabled: boolean }>>(installed)
        const key = entries.find((item) => item.key.startsWith("file:"))!.key

        const disabled = yield* request(handler, `${PluginPaths.config}/${encodeURIComponent(key)}`, tmp.directory, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled: false }),
        })
        expect(disabled.status).toBe(200)
        expect((yield* json<Array<{ key: string; enabled: boolean }>>(disabled)).find((item) => item.key === key)?.enabled).toBe(false)

        const status = yield* request(handler, PluginPaths.status, tmp.directory)
        expect(status.status).toBe(200)
        const registry = yield* json<Array<{ key: string; status: string }>>(status)
        expect(registry.find((item) => item.key === key)?.status).toBe("disabled")
        expect(registry.some((item) => item.key === "builtin:necode")).toBe(true)

        const removed = yield* request(handler, `${PluginPaths.config}/${encodeURIComponent(key)}`, tmp.directory, {
          method: "DELETE",
        })
        expect(removed.status).toBe(200)
        expect((yield* json<Array<{ key: string }>>(removed)).some((item) => item.key === key)).toBe(false)

        const missing = yield* request(handler, `${PluginPaths.config}/npm%3Amissing`, tmp.directory, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled: false }),
        })
        expect(missing.status).toBe(404)

        const builtin = yield* request(handler, `${PluginPaths.config}/builtin%3Anecode`, tmp.directory, {
          method: "DELETE",
        })
        expect(builtin.status).toBe(400)
      }),
    { git: true },
  )
})

function createPlugin(root: string) {
  return Effect.gen(function* () {
    const dir = path.join(root, "managed-plugin")
    yield* Effect.promise(() => mkdir(dir, { recursive: true }))
    yield* Effect.promise(() =>
      Bun.write(
        path.join(dir, "package.json"),
        JSON.stringify({
          name: "managed-plugin",
          version: "1.0.0",
          type: "module",
          exports: { "./server": "./server.js" },
          necode: { plugin: { id: "managed-plugin", name: "Managed Plugin" } },
        }),
      ),
    )
    yield* Effect.promise(() => Bun.write(path.join(dir, "server.js"), "export default async () => ({})\n"))
    return dir
  })
}

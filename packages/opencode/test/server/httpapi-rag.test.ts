import { afterEach, describe, expect, test } from "bun:test"
import { rm, writeFile } from "node:fs/promises"
import { Context } from "effect"
import { Global } from "@opencode-ai/core/global"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import { RagPaths } from "../../src/server/routes/instance/httpapi/groups/rag"
import { resolveNeRagStorePath } from "../../src/ne/rag/context"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, tmpdir } from "../fixture/fixture"

const context = Context.empty() as Context.Context<unknown>

function request(route: string, directory: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set("x-opencode-directory", directory)
  return HttpApiApp.webHandler().handler(
    new Request(`http://localhost${route}`, {
      ...init,
      headers,
    }),
    context,
  )
}

function requestWithoutProject(route: string, init?: RequestInit) {
  return HttpApiApp.webHandler().handler(new Request(`http://localhost${route}`, init), context)
}

async function resetRagState() {
  await disposeAllInstances()
  await resetDatabase()
  await rm(resolveNeRagStorePath(), { force: true })
  await rm(`${resolveNeRagStorePath()}-wal`, { force: true })
  await rm(`${resolveNeRagStorePath()}-shm`, { force: true })
  await rm(`${Global.Path.data}/auth.json`, { force: true })
}

afterEach(resetRagState)

describe("rag HttpApi", () => {
  test("serves empty status when no documents are indexed", async () => {
    await using tmp = await tmpdir({ git: true })
    await resetRagState()

    const response = await requestWithoutProject(RagPaths.status)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      enabled: false,
      storePath: resolveNeRagStorePath(),
      documents: [],
      chunks: 0,
    })
  })

  test("rejects imports when NE credentials are missing", async () => {
    await using tmp = await tmpdir({ git: true })
    await resetRagState()
    const source = `${tmp.path}/paper.md`
    await writeFile(source, "content")

    const response = await request(RagPaths.import, tmp.path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: source }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      _tag: "RagCredentialRequiredError",
      message: "NE RAG import requires NE credentials.",
    })
  })
})

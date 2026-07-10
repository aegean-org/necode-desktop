import { describe, expect, test } from "bun:test"
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"

describe("persistent MCP client", () => {
  test("lists persistent MCP configuration", async () => {
    const recorder = createRequestRecorder()

    await recorder.client.mcp.config.list()

    expect(recorder.requests).toHaveLength(1)
    expect(recorder.requests[0].method).toBe("GET")
    expect(new URL(recorder.requests[0].url).pathname).toBe("/mcp/config")
  })

  test("creates persistent MCP configuration in the request body", async () => {
    const recorder = createRequestRecorder()

    await recorder.client.mcp.config.create({
      scope: "project",
      name: "demo",
      config: { type: "local", command: ["echo", "demo"] },
    })

    expect(recorder.requests[0].method).toBe("POST")
    expect(new URL(recorder.requests[0].url).pathname).toBe("/mcp/config")
    expect(await recorder.requests[0].clone().json()).toEqual({
      scope: "project",
      name: "demo",
      config: { type: "local", command: ["echo", "demo"] },
    })
  })

  test("updates a URL-safe MCP entry without duplicating its ID", async () => {
    const recorder = createRequestRecorder()
    const entryID = "project:config/demo name"

    await recorder.client.mcp.config.update({
      entryID,
      name: "renamed",
      config: { type: "local", command: ["echo", "updated"] },
    })

    const request = recorder.requests[0]
    const url = new URL(request.url)
    expect(request.method).toBe("PUT")
    expect(url.pathname).toBe(`/mcp/config/${encodeURIComponent(entryID)}`)
    expect(url.search).toBe("")
    expect(await request.clone().json()).toEqual({
      name: "renamed",
      config: { type: "local", command: ["echo", "updated"] },
    })
  })

  test("removes a URL-safe MCP entry without query or body data", async () => {
    const recorder = createRequestRecorder()
    const entryID = "project:config/demo name"

    await recorder.client.mcp.config.remove({ entryID })

    const request = recorder.requests[0]
    const url = new URL(request.url)
    expect(request.method).toBe("DELETE")
    expect(url.pathname).toBe(`/mcp/config/${encodeURIComponent(entryID)}`)
    expect(url.search).toBe("")
    expect(await request.clone().text()).toBe("")
  })
})

function createRequestRecorder() {
  const requests: Request[] = []
  const client = createOpencodeClient({
    baseUrl: "http://localhost",
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(input instanceof Request ? input : new Request(input, init))
      return Response.json([])
    }) as typeof fetch,
  })
  return { client, requests }
}

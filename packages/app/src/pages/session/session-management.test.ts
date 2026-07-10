import { describe, expect, test } from "bun:test"
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"
import { createSessionManagement } from "./session-management"

describe("session management", () => {
  test("shapes reversible archive and pin requests", async () => {
    const requests: Request[] = []
    const client = createOpencodeClient({
      baseUrl: "http://localhost",
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(input, init)
        requests.push(request)
        return Response.json(sessionResponse())
      }) as typeof fetch,
    })
    const actions = createSessionManagement({ client, directory: "D:/project/app" })

    await actions.pin("ses_1")
    await actions.unpin("ses_1")
    await actions.archive("ses_1")
    await actions.restore("ses_1")

    expect(await requestBody(requests[0])).toEqual({ time: { pinned: expect.any(Number) } })
    expect(await requestBody(requests[1])).toEqual({ time: { pinned: null } })
    expect(await requestBody(requests[2])).toEqual({ time: { archived: expect.any(Number) } })
    expect(await requestBody(requests[3])).toEqual({ time: { archived: null } })
    expect(requests.every((request) => new URL(request.url).searchParams.get("directory") === "D:/project/app")).toBe(
      true,
    )
  })

  test("uses the permanent session delete endpoint", async () => {
    let request: Request | undefined
    const client = createOpencodeClient({
      baseUrl: "http://localhost",
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        request = input instanceof Request ? input : new Request(input, init)
        return Response.json(true)
      }) as typeof fetch,
    })

    await createSessionManagement({ client, directory: "D:/project/app" }).remove("ses_1")

    expect(request?.method).toBe("DELETE")
    expect(new URL(request!.url).pathname).toBe("/session/ses_1")
  })
})

async function requestBody(request: Request | undefined) {
  return request?.clone().json()
}

function sessionResponse() {
  return {
    id: "ses_1",
    slug: "session",
    projectID: "global",
    directory: "D:/project/app",
    title: "Session",
    version: "1",
    time: { created: 1, updated: 1 },
  }
}

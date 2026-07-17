import { describe, expect, test } from "bun:test"
import type { Session } from "@opencode-ai/sdk/v2/client"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { createWorkflowSession, insertWorkflowSession } from "./workflow-new-session"

describe("workflow new session", () => {
  test("wires home and session workflow actions to direct creation", async () => {
    const home = await Bun.file(new URL("../home.tsx", import.meta.url)).text()
    const session = await Bun.file(new URL("../session.tsx", import.meta.url)).text()

    expect(home).toContain("createWorkflowSession({")
    expect(home).toContain("ctx.sdk.createClient({ directory, throwOnError: true }).session.create()")
    expect(session).toContain("createWorkflowSession({")
    expect(session).toContain("serverSDK().createClient({ directory, throwOnError: true }).session.create()")
    expect(session).toContain('navigate("/")')
    expect(session).not.toContain("navigateToWorkflowNewSession")
  })

  test("creates a session instead of opening the legacy empty page when switching to an empty project", async () => {
    const layout = await Bun.file(new URL("../layout.tsx", import.meta.url)).text()
    const projectNavigation = layout.slice(
      layout.indexOf("async function navigateToProject"),
      layout.indexOf("function navigateToSession"),
    )

    expect(projectNavigation).toContain("createWorkflowSession({")
    expect(projectNavigation).toContain(
      "serverSDK().createClient({ directory: root, throwOnError: true }).session.create()",
    )
    expect(projectNavigation).not.toContain('navigateWithSidebarReset(`/${base64Encode(root)}/session`)')
  })

  test("opens the latest project session from the workflow session sidebar", async () => {
    const session = await Bun.file(new URL("../session.tsx", import.meta.url)).text()
    const projectSwitch = session.slice(
      session.indexOf("const openWorkflowProject ="),
      session.indexOf("const creatingWorkflowSessions"),
    )

    expect(projectSwitch).toContain("latestRootSession(")
    expect(projectSwitch).toContain("client.session.list({ directory: item })")
    expect(projectSwitch).toContain("openWorkflowSession(latest)")
    expect(projectSwitch).not.toContain('navigate(`/${base64Encode(directory)}`)')
  })

  test("creates, seeds, and navigates directly to the created session", async () => {
    const session = { id: "ses_created" } as Session
    const calls: string[] = []

    const created = await createWorkflowSession({
      directory: "D:/project/example",
      create: async () => {
        calls.push("create")
        return { data: session }
      },
      seed: (value) => calls.push(`seed:${value.id}`),
      navigate: (href) => calls.push(`navigate:${href}`),
    })

    expect(created).toBe(session)
    expect(calls).toEqual([
      "create",
      "seed:ses_created",
      `navigate:/${base64Encode("D:/project/example")}/session/ses_created`,
    ])
  })

  test("rejects a create response without session data", async () => {
    await expect(
      createWorkflowSession({
        directory: "D:/project/example",
        create: async () => ({ data: undefined }),
        seed: () => undefined,
        navigate: () => undefined,
      }),
    ).rejects.toThrow("Session create response missing data")
  })

  test("inserts sessions in id order and replaces an existing session", () => {
    const first = { id: "ses_a", title: "old" } as Session
    const last = { id: "ses_c" } as Session
    const inserted = { id: "ses_b" } as Session
    const replacement = { id: "ses_a", title: "new" } as Session

    expect(insertWorkflowSession([first, last], inserted).map((session) => session.id)).toEqual([
      "ses_a",
      "ses_b",
      "ses_c",
    ])
    expect(insertWorkflowSession([first, last], replacement)).toEqual([replacement, last])
  })
})

import type { ToolContext, ToolResult } from "@opencode-ai/plugin"
import { normalizeExtractedText } from "@necode-ai/plugin-artifacts"
import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { PresentationTools, readPresentation, validatePresentation } from "../src"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("presentations plugin", () => {
  test("creates and reopens a real Chinese PPTX", async () => {
    const fixture = await createFixture()
    const created = requireObject(
      await PresentationTools.presentation_create.execute(
        {
          title: "季度总结",
          slides: [
            { layout: "title", title: "季度总结", subtitle: "第一季度" },
            { layout: "title-and-content", title: "第一季度", bullets: ["收入增长", "成本下降"] },
          ],
        },
        fixture.context,
      ),
    )
    const filePath = fileURLToPath(requireAttachment(created).url)

    expect(await validatePresentation(filePath)).toContain("ppt/presentation.xml")
    const text = normalizeExtractedText(await readPresentation(filePath))
    expect(text).toContain("季度总结")
    expect(text).toContain("第一季度")
    expect(text.indexOf("收入增长")).toBeLessThan(text.indexOf("成本下降"))
  })

  test("revises an accessible source by regenerating complete slide input", async () => {
    const fixture = await createFixture()
    const source = await createPresentation(fixture.context)
    const revised = requireObject(
      await PresentationTools.presentation_revise.execute(
        { sourcePath: source, title: "新版", slides: [{ layout: "section", title: "新版章节", subtitle: "重新生成" }] },
        fixture.context,
      ),
    )
    expect(normalizeExtractedText(await readPresentation(fileURLToPath(requireAttachment(revised).url)))).toContain(
      "新版章节 重新生成",
    )
  })

  test("rejects empty slides and corrupted sources", async () => {
    const fixture = await createFixture()
    await expect(
      PresentationTools.presentation_create.execute({ title: "空", slides: [] }, fixture.context),
    ).rejects.toThrow("slide")
    const broken = path.join(fixture.worktree, "broken.pptx")
    await Bun.write(broken, "not a presentation")
    await expect(
      PresentationTools.presentation_revise.execute(
        { sourcePath: broken, title: "新版", slides: [{ title: "内容", layout: "title" }] },
        fixture.context,
      ),
    ).rejects.toThrow()
  })
})

async function createPresentation(context: ToolContext) {
  const result = requireObject(
    await PresentationTools.presentation_create.execute(
      { title: "原稿", slides: [{ layout: "title", title: "原始内容" }] },
      context,
    ),
  )
  return fileURLToPath(requireAttachment(result).url)
}

function requireObject(result: ToolResult) {
  if (typeof result === "string") throw new Error("Expected structured tool result")
  return result
}

function requireAttachment(result: Exclude<ToolResult, string>) {
  const attachment = result.attachments?.[0]
  if (!attachment) throw new Error("Expected presentation attachment")
  return attachment
}

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "necode-plugin-presentations-"))
  roots.push(root)
  const worktree = path.join(root, "worktree")
  const artifacts = path.join(root, "artifacts")
  await Promise.all([mkdir(worktree, { recursive: true }), mkdir(artifacts, { recursive: true })])
  const context = {
    sessionID: "session",
    messageID: "message",
    agent: "agent",
    directory: worktree,
    worktree,
    abort: new AbortController().signal,
    metadata: () => undefined,
    ask: async () => undefined,
    artifact: async (filename) => ({
      path: path.join(artifacts, filename),
      url: pathToFileURL(path.join(artifacts, filename)).href,
    }),
  } satisfies ToolContext
  return { context, worktree }
}

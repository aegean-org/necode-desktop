import type { ToolContext, ToolResult } from "@opencode-ai/plugin"
import { normalizeExtractedText } from "@necode-ai/plugin-artifacts"
import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { DocumentTools, readDocument } from "../src"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("documents plugin", () => {
  test("creates and reopens a real Chinese DOCX", async () => {
    const fixture = await createFixture()
    const result = requireObject(
      await DocumentTools.document_create.execute(
        { title: "测试报告", content: "# 第一章\n\n正文内容\n\n- 要点一\n- 要点二" },
        fixture.context,
      ),
    )
    const attachment = requireAttachment(result)

    expect(attachment.mime).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    expect(normalizeExtractedText(await readDocument(fileURLToPath(attachment.url)))).toContain(
      "第一章 正文内容 要点一 要点二",
    )
  })

  test("reads and revises an accessible source into a verified new file", async () => {
    const fixture = await createFixture()
    const created = requireObject(
      await DocumentTools.document_create.execute({ title: "原稿", content: "原始内容" }, fixture.context),
    )
    const sourcePath = fileURLToPath(requireAttachment(created).url)
    const read = requireObject(await DocumentTools.document_read.execute({ sourcePath }, fixture.context))
    const revised = requireObject(
      await DocumentTools.document_revise.execute({ sourcePath, content: "# 新版本\n\n替换后的正文" }, fixture.context),
    )

    expect(read.output).toContain("原始内容")
    expect(normalizeExtractedText(await readDocument(fileURLToPath(requireAttachment(revised).url)))).toContain(
      "新版本 替换后的正文",
    )
  })

  test("surfaces a missing source file", async () => {
    const fixture = await createFixture()
    await expect(
      DocumentTools.document_read.execute({ sourcePath: path.join(fixture.worktree, "missing.docx") }, fixture.context),
    ).rejects.toThrow("does not exist")
  })
})

function requireObject(result: ToolResult) {
  if (typeof result === "string") throw new Error("Expected structured tool result")
  return result
}

function requireAttachment(result: Exclude<ToolResult, string>) {
  const attachment = result.attachments?.[0]
  if (!attachment) throw new Error("Expected document attachment")
  return attachment
}

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "necode-plugin-documents-"))
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

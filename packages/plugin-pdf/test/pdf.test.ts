import type { ToolContext, ToolResult } from "@opencode-ai/plugin"
import { normalizeExtractedText } from "@necode-ai/plugin-artifacts"
import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { PDFDocument } from "pdf-lib"
import { PdfTools, readPdfText } from "../src"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("pdf plugin", () => {
  test("creates and reopens a Chinese PDF", async () => {
    const fixture = await createFixture()
    const created = requireObject(
      await PdfTools.pdf_create.execute({ title: "中文报告", content: "# 第一页\n\n这是正文内容" }, fixture.context),
    )
    const attachment = requireAttachment(created)
    const filePath = fileURLToPath(attachment.url)

    expect(attachment.mime).toBe("application/pdf")
    expect((await PDFDocument.load(await Bun.file(filePath).arrayBuffer())).getPageCount()).toBe(1)
    expect(normalizeExtractedText(await readPdfText(filePath))).toContain("第一页 这是正文内容")
  })

  test("merges in order and splits one-based page ranges", async () => {
    const fixture = await createFixture()
    const first = await createPdf(fixture.context, "甲", "第一页甲")
    const second = await createPdf(fixture.context, "乙", "第二页乙")
    const merged = requireObject(
      await PdfTools.pdf_merge.execute({ sourcePaths: [first, second], filename: "合并.pdf" }, fixture.context),
    )
    const mergedPath = fileURLToPath(requireAttachment(merged).url)
    const split = requireObject(
      await PdfTools.pdf_split.execute(
        {
          sourcePath: mergedPath,
          ranges: [
            { start: 1, end: 1 },
            { start: 2, end: 2 },
          ],
        },
        fixture.context,
      ),
    )

    expect((await PDFDocument.load(await Bun.file(mergedPath).arrayBuffer())).getPageCount()).toBe(2)
    const mergedText = normalizeExtractedText(await readPdfText(mergedPath))
    expect(mergedText.indexOf("第一页甲")).toBeLessThan(mergedText.indexOf("第二页乙"))
    expect(split.attachments).toHaveLength(2)
  })

  test("rejects invalid ranges and corrupted inputs", async () => {
    const fixture = await createFixture()
    const broken = path.join(fixture.worktree, "broken.pdf")
    await Bun.write(broken, "not a pdf")

    await expect(PdfTools.pdf_read.execute({ sourcePath: broken }, fixture.context)).rejects.toThrow()
    const source = await createPdf(fixture.context, "单页", "只有一页")
    await expect(
      PdfTools.pdf_split.execute({ sourcePath: source, ranges: [{ start: 2, end: 2 }] }, fixture.context),
    ).rejects.toThrow("range")
  })
})

async function createPdf(context: ToolContext, title: string, content: string) {
  const result = requireObject(await PdfTools.pdf_create.execute({ title, content }, context))
  return fileURLToPath(requireAttachment(result).url)
}

function requireObject(result: ToolResult) {
  if (typeof result === "string") throw new Error("Expected structured tool result")
  return result
}

function requireAttachment(result: Exclude<ToolResult, string>) {
  const attachment = result.attachments?.[0]
  if (!attachment) throw new Error("Expected PDF attachment")
  return attachment
}

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "necode-plugin-pdf-"))
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

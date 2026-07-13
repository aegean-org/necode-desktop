import type { ToolContext } from "@opencode-ai/plugin"
import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
  artifactAttachment,
  normalizeExtractedText,
  requireExpectedText,
  requireReadableInput,
  resolveArtifactOutput,
} from "../src"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("plugin artifact boundaries", () => {
  test("allocates safe session output and creates file attachments", async () => {
    const fixture = await createFixture()
    const output = await resolveArtifactOutput(fixture.context, { filename: "报告.docx" })

    expect(output.path).toBe(path.join(fixture.artifacts, "报告.docx"))
    expect(fileURLToPath(output.url)).toBe(output.path)
    expect(artifactAttachment(output, "application/test")).toEqual({
      type: "file",
      mime: "application/test",
      url: pathToFileURL(output.path).href,
      filename: "报告.docx",
    })
    await expect(resolveArtifactOutput(fixture.context, { filename: "../escape.docx" })).rejects.toThrow("filename")
  })

  test("requests explicit output and external-directory permissions", async () => {
    const fixture = await createFixture()
    const target = path.join(path.dirname(fixture.worktree), "outside", "report.pdf")
    const output = await resolveArtifactOutput(fixture.context, { filename: "report.pdf", outputPath: target })

    expect(output.path).toBe(path.resolve(target))
    expect(fixture.permissions).toEqual([
      { permission: "edit", patterns: [path.resolve(target)] },
      { permission: "external_directory", patterns: [path.resolve(target)] },
    ])
  })

  test("requires readable real input and normalizes extracted text", async () => {
    const fixture = await createFixture()
    const source = path.join(fixture.worktree, "source.docx")
    await Bun.write(source, "content")

    expect((await requireReadableInput(fixture.context, source)).path).toBe(source)
    expect(normalizeExtractedText("  第一章\n 正文  ")).toBe("第一章 正文")
    expect(requireExpectedText("第一章 正文", "# 第一章\n\n正文")).toBeUndefined()
    await expect(requireReadableInput(fixture.context, path.join(fixture.worktree, "missing.docx"))).rejects.toThrow(
      "does not exist",
    )
  })
})

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "necode-plugin-artifacts-"))
  roots.push(root)
  const worktree = path.join(root, "worktree")
  const artifacts = path.join(root, "artifacts")
  await Promise.all([mkdir(worktree, { recursive: true }), mkdir(artifacts, { recursive: true })])
  const permissions: Array<{ permission: string; patterns: string[] }> = []
  const context = {
    sessionID: "session",
    messageID: "message",
    agent: "agent",
    directory: worktree,
    worktree,
    abort: new AbortController().signal,
    metadata: () => undefined,
    ask: async (input) => {
      permissions.push({ permission: input.permission, patterns: input.patterns })
    },
    artifact: async (filename) => ({
      path: path.join(artifacts, filename),
      url: pathToFileURL(path.join(artifacts, filename)).href,
    }),
  } satisfies ToolContext
  return { context, worktree, artifacts, permissions }
}

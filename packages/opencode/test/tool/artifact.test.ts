import { expect, test } from "bun:test"
import path from "path"
import { fileURLToPath } from "url"
import { ToolArtifact } from "@/tool/artifact"
import { tmpdir } from "../fixture/fixture"

test("allocates a session-scoped artifact path without creating the file", async () => {
  await using tmp = await tmpdir()
  const artifact = await ToolArtifact.allocate("session-123", "报告.docx", tmp.path)

  expect(artifact.path).toBe(path.join(tmp.path, "artifacts", "session-123", "报告.docx"))
  expect(fileURLToPath(artifact.url)).toBe(artifact.path)
  expect(await Bun.file(artifact.path).exists()).toBe(false)
})

test("rejects filenames that escape the artifact directory", async () => {
  await using tmp = await tmpdir()

  await expect(ToolArtifact.allocate("session-123", "../escape.docx", tmp.path)).rejects.toThrow("filename")
})

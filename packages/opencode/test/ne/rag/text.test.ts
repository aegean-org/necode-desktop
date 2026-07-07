import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { extractNeRagText, isNeRagSupportedFile } from "../../../src/ne/rag/text"
import { buildTextPdf } from "./pdf-fixture"

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

function makeDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "opencode-rag-text-"))
  dirs.push(dir)
  return dir
}

describe("NE RAG text extraction", () => {
  test("supports PDF files case-insensitively", () => {
    expect(isNeRagSupportedFile("paper.PDF")).toBe(true)
  })

  test("extracts text from PDF files", async () => {
    const filePath = path.join(makeDir(), "paper.pdf")
    writeFileSync(filePath, buildTextPdf("Hello NE PDF RAG"), "binary")

    await expect(extractNeRagText(filePath)).resolves.toContain("Hello NE PDF RAG")
  })

  test("rejects aborted PDF extraction", async () => {
    const filePath = path.join(makeDir(), "paper.pdf")
    writeFileSync(filePath, buildTextPdf("Hello NE PDF RAG"), "binary")
    const controller = new AbortController()
    controller.abort()

    await expect(extractNeRagText(filePath, controller.signal)).rejects.toMatchObject({ name: "AbortError" })
  })
})

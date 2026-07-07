import { afterEach, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

function makeDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "opencode-rag-node-bundle-"))
  dirs.push(dir)
  return dir
}

test("NE RAG vector store node bundle does not import Bun-only protocols", async () => {
  const outdir = makeDir()
  const result = await Bun.build({
    target: "node",
    entrypoints: ["./src/ne/rag/vector-store.ts"],
    outdir,
    format: "esm",
  })

  expect(result.success).toBe(true)
  expect(await readFile(path.join(outdir, "vector-store.js"), "utf8")).not.toContain("bun:")
})

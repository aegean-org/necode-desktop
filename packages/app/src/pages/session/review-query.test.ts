import { expect, test } from "bun:test"

const source = await Bun.file(new URL("../session.tsx", import.meta.url)).text()

test("loads review diffs with bounded context", () => {
  expect(source).toContain("const REVIEW_DIFF_CONTEXT_LINES = 3")
  expect(source).toContain("queryKey: [...vcsKey(), mode, REVIEW_DIFF_CONTEXT_LINES] as const")
  expect(source).toContain(".client.vcs.diff({ mode, context: REVIEW_DIFF_CONTEXT_LINES })")
})

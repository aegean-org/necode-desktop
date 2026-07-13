import type { ToolContext, ToolResult } from "@opencode-ai/plugin"
import { afterEach, expect, test } from "bun:test"
import ExcelJS from "exceljs"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { renderChart, SpreadsheetTools } from "../src"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

test("renders and embeds a verified spreadsheet chart image", async () => {
  const png = await renderChart({
    type: "bar",
    title: "销量",
    labels: ["一月", "二月"],
    values: [3, 5],
    range: "D2:K18",
  })
  expect(png.subarray(1, 4).toString()).toBe("PNG")

  const fixture = await createFixture()
  const created = requireObject(
    await SpreadsheetTools.spreadsheet_create.execute(
      {
        filename: "chart.xlsx",
        sheets: [
          {
            name: "数据",
            cells: [{ address: "A1", value: "销量" }],
            charts: [{ type: "line", title: "趋势", labels: ["一月", "二月"], values: [3, 5], range: "D2:K18" }],
          },
        ],
      },
      fixture.context,
    ),
  )
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(fileURLToPath(requireAttachment(created).url))
  expect(workbook.getWorksheet("数据")?.getImages()).toHaveLength(1)

  await expect(
    renderChart({ type: "pie", title: "错误", labels: ["一月"], values: [1, 2], range: "D2:K18" }),
  ).rejects.toThrow("same length")
})

function requireObject(result: ToolResult) {
  if (typeof result === "string") throw new Error("Expected structured tool result")
  return result
}

function requireAttachment(result: Exclude<ToolResult, string>) {
  const attachment = result.attachments?.[0]
  if (!attachment) throw new Error("Expected spreadsheet attachment")
  return attachment
}

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "necode-plugin-chart-"))
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
  return { context }
}

import type { ToolContext, ToolResult } from "@opencode-ai/plugin"
import { afterEach, describe, expect, test } from "bun:test"
import ExcelJS from "exceljs"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { SpreadsheetTools } from "../src"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("spreadsheets plugin", () => {
  test("creates, reopens, and reads a structured workbook", async () => {
    const fixture = await createFixture()
    const created = requireObject(
      await SpreadsheetTools.spreadsheet_create.execute(
        {
          filename: "销售.xlsx",
          sheets: [
            {
              name: "数据",
              cells: [
                { address: "A1", value: "月份" },
                { address: "B1", value: "销售额" },
                { address: "A2", value: "一月" },
                { address: "B2", value: 42, numberFormat: "0.00" },
                { address: "C2", value: true },
                { address: "D2", formula: "B2*2" },
              ],
            },
          ],
        },
        fixture.context,
      ),
    )
    const filePath = fileURLToPath(requireAttachment(created).url)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filePath)
    const sheet = workbook.getWorksheet("数据")

    expect(sheet?.getCell("B2").value).toBe(42)
    expect(sheet?.getCell("B2").numFmt).toBe("0.00")
    expect(sheet?.getCell("D2").value).toEqual(expect.objectContaining({ formula: "B2*2" }))
    const read = requireObject(
      await SpreadsheetTools.spreadsheet_read.execute(
        { sourcePath: filePath, sheet: "数据", range: "A1:B2" },
        fixture.context,
      ),
    )
    expect(read.output).toContain('"address":"B2"')
    expect(read.output).toContain('"value":42')
  })

  test("updates an accessible source into a new verified workbook", async () => {
    const fixture = await createFixture()
    const source = await createWorkbook(fixture.context)
    const updated = requireObject(
      await SpreadsheetTools.spreadsheet_update.execute(
        { sourcePath: source, sheets: [{ name: "数据", cells: [{ address: "B2", value: 99 }] }] },
        fixture.context,
      ),
    )
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(fileURLToPath(requireAttachment(updated).url))
    expect(workbook.getWorksheet("数据")?.getCell("B2").value).toBe(99)
  })

  test("rejects ambiguous and invalid workbook inputs", async () => {
    const fixture = await createFixture()
    await expect(
      SpreadsheetTools.spreadsheet_create.execute(
        {
          filename: "bad.xlsx",
          sheets: [
            { name: "重复", cells: [] },
            { name: "重复", cells: [] },
          ],
        },
        fixture.context,
      ),
    ).rejects.toThrow("Duplicate")
    await expect(
      SpreadsheetTools.spreadsheet_create.execute(
        { filename: "bad.xlsx", sheets: [{ name: "数据", cells: [{ address: "bad", value: 1 }] }] },
        fixture.context,
      ),
    ).rejects.toThrow("A1")
    await expect(
      SpreadsheetTools.spreadsheet_create.execute(
        { filename: "bad.xlsx", sheets: [{ name: "数据", cells: [{ address: "A1", value: 1, formula: "1+1" }] }] },
        fixture.context,
      ),
    ).rejects.toThrow("value and formula")
  })
})

async function createWorkbook(context: ToolContext) {
  const result = requireObject(
    await SpreadsheetTools.spreadsheet_create.execute(
      { filename: "source.xlsx", sheets: [{ name: "数据", cells: [{ address: "B2", value: 42 }] }] },
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
  if (!attachment) throw new Error("Expected spreadsheet attachment")
  return attachment
}

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "necode-plugin-spreadsheets-"))
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

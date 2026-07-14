import type { Plugin, PluginManifest } from "@opencode-ai/plugin"
import { fileURLToPath } from "node:url"
import { SpreadsheetTools } from "./server.ts"

/** Package root used to resolve bundled spreadsheet skills. */
export const SpreadsheetsRoot = fileURLToPath(new URL("..", import.meta.url))

/** Metadata displayed by NeCode's plugin management surface. */
export const SpreadsheetsManifest = {
  id: "spreadsheets",
  name: "Spreadsheets",
  description: "创建、读取和更新 Excel 工作簿",
  skills: ["./skills/"],
} satisfies PluginManifest

/** First-party Spreadsheets plugin entrypoint. */
export const SpreadsheetsPlugin: Plugin = async () => ({ tool: SpreadsheetTools })

export { renderChart, validateChart, type ChartInput } from "./chart.ts"
export { readWorkbook } from "./read.ts"
export {
  CellInputSchema,
  ChartInputSchema,
  SheetInputSchema,
  validateSheets,
  type CellInput,
  type SheetInput,
} from "./schema.ts"
export { SpreadsheetTools } from "./server.ts"
export { updateWorkbook, writeWorkbook } from "./write.ts"

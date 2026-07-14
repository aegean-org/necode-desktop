import { tool, type ToolContext } from "@opencode-ai/plugin"
import { artifactAttachment, requireReadableInput, resolveArtifactOutput } from "@necode-ai/plugin-artifacts"
import path from "node:path"
import { readWorkbook } from "./read.ts"
import { SheetInputSchema, type SheetInput } from "./schema.ts"
import { updateWorkbook, writeWorkbook } from "./write.ts"

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

/** Spreadsheet tools contributed by the first-party Spreadsheets plugin. */
export const SpreadsheetTools = {
  spreadsheet_read: tool({
    description: "Read XLSX worksheet metadata or an explicit A1 range.",
    args: {
      sourcePath: tool.schema.string(),
      sheet: tool.schema.string().optional(),
      range: tool.schema.string().optional(),
    },
    async execute(args, context) {
      const source = await requireReadableInput(context, args.sourcePath)
      return { title: path.basename(source.path), output: await readWorkbook(source.path, args) }
    },
  }),
  spreadsheet_create: tool({
    description: "Create a verified XLSX workbook from explicit worksheet and cell inputs.",
    args: {
      filename: tool.schema.string(),
      sheets: tool.schema.array(SheetInputSchema),
      outputPath: tool.schema.string().optional(),
    },
    execute: (args, context) => createSpreadsheet(args, context),
  }),
  spreadsheet_update: tool({
    description: "Open an XLSX source, apply explicit cell operations, and write a verified new workbook.",
    args: {
      sourcePath: tool.schema.string(),
      sheets: tool.schema.array(SheetInputSchema),
      outputPath: tool.schema.string().optional(),
    },
    execute: (args, context) => updateSpreadsheet(args, context),
  }),
} as const

async function createSpreadsheet(
  args: { filename: string; sheets: SheetInput[]; outputPath?: string },
  context: ToolContext,
) {
  const filename = requireFilename(args.filename)
  const output = await resolveArtifactOutput(context, { filename, outputPath: args.outputPath })
  await writeWorkbook(output.path, args.sheets)
  return { title: filename, output: `Created ${output.path}`, attachments: [artifactAttachment(output, XLSX_MIME)] }
}

async function updateSpreadsheet(
  args: { sourcePath: string; sheets: SheetInput[]; outputPath?: string },
  context: ToolContext,
) {
  const source = await requireReadableInput(context, args.sourcePath)
  const filename = `${path.basename(source.path, path.extname(source.path))}-updated.xlsx`
  const output = await resolveArtifactOutput(context, { filename, outputPath: args.outputPath })
  await updateWorkbook(source.path, output.path, args.sheets)
  return { title: filename, output: `Updated ${output.path}`, attachments: [artifactAttachment(output, XLSX_MIME)] }
}

function requireFilename(value: string) {
  const filename = value.trim()
  if (!filename.toLowerCase().endsWith(".xlsx")) throw new Error("Spreadsheet filename must end with .xlsx")
  return filename
}

import { tool, type ToolContext } from "@opencode-ai/plugin"
import {
  artifactAttachment,
  requireExpectedText,
  requireReadableInput,
  resolveArtifactOutput,
} from "@necode-ai/plugin-artifacts"
import path from "node:path"
import { createPdf } from "./layout.ts"
import { mergePdfFiles, type PageRange, validatePdf, writePdfRange } from "./operations.ts"
import { readPdfText } from "./read.ts"

const PDF_MIME = "application/pdf"

/** PDF tools contributed by the first-party PDF plugin. */
export const PdfTools = {
  pdf_read: tool({
    description: "Read text from a PDF document.",
    args: { sourcePath: tool.schema.string() },
    async execute(args, context) {
      const source = await requireReadableInput(context, args.sourcePath)
      return { title: path.basename(source.path), output: await readPdfText(source.path) }
    },
  }),
  pdf_create: tool({
    description: "Create a verified PDF with embedded Simplified Chinese font support.",
    args: { title: tool.schema.string(), content: tool.schema.string(), outputPath: tool.schema.string().optional() },
    execute: (args, context) => createPdfTool(args, context),
  }),
  pdf_merge: tool({
    description: "Merge PDF files in the declared order and verify the combined output.",
    args: {
      sourcePaths: tool.schema.array(tool.schema.string()),
      filename: tool.schema.string().optional(),
      outputPath: tool.schema.string().optional(),
    },
    execute: (args, context) => mergePdfTool(args, context),
  }),
  pdf_split: tool({
    description: "Split a PDF into verified one-based inclusive page ranges.",
    args: {
      sourcePath: tool.schema.string(),
      ranges: tool.schema.array(tool.schema.object({ start: tool.schema.number(), end: tool.schema.number() })),
      outputDirectory: tool.schema.string().optional(),
    },
    execute: (args, context) => splitPdfTool(args, context),
  }),
} as const

async function createPdfTool(args: { title: string; content: string; outputPath?: string }, context: ToolContext) {
  const title = requireText(args.title, "title")
  const content = requireText(args.content, "content")
  const output = await resolveArtifactOutput(context, {
    filename: `${safeName(title)}.pdf`,
    outputPath: args.outputPath,
  })
  await createPdf(output.path, { title, content })
  await validatePdf(output.path)
  requireExpectedText(await readPdfText(output.path), content)
  return { title, output: `Created ${output.path}`, attachments: [artifactAttachment(output, PDF_MIME)] }
}

async function mergePdfTool(
  args: { sourcePaths: string[]; filename?: string; outputPath?: string },
  context: ToolContext,
) {
  if (args.sourcePaths.length < 2) throw new Error("PDF merge requires at least two source files")
  const sources = await Promise.all(args.sourcePaths.map((sourcePath) => requireReadableInput(context, sourcePath)))
  const filename = args.filename?.trim() || "merged.pdf"
  const output = await resolveArtifactOutput(context, { filename, outputPath: args.outputPath })
  await mergePdfFiles(
    sources.map((source) => source.path),
    output.path,
  )
  const expected = (await Promise.all(sources.map((source) => readPdfText(source.path)))).join(" ")
  requireExpectedText(await readPdfText(output.path), expected)
  return { title: filename, output: `Merged ${output.path}`, attachments: [artifactAttachment(output, PDF_MIME)] }
}

async function splitPdfTool(
  args: { sourcePath: string; ranges: PageRange[]; outputDirectory?: string },
  context: ToolContext,
) {
  if (args.ranges.length === 0) throw new Error("PDF split requires at least one page range")
  const source = await requireReadableInput(context, args.sourcePath)
  await validatePdf(source.path)
  const base = path.basename(source.path, path.extname(source.path))
  const attachments = []
  for (const range of args.ranges) {
    const filename = `${base}-pages-${range.start}-${range.end}.pdf`
    const outputPath = args.outputDirectory ? path.join(args.outputDirectory, filename) : undefined
    const output = await resolveArtifactOutput(context, { filename, outputPath })
    await writePdfRange(source.path, output.path, range)
    attachments.push(artifactAttachment(output, PDF_MIME))
  }
  return { title: base, output: `Created ${attachments.length} split PDF files`, attachments }
}

function requireText(value: string, field: string) {
  const text = value.trim()
  if (!text) throw new Error(`PDF ${field} is required`)
  return text
}

function safeName(value: string) {
  const filename = value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim()
  if (!filename) throw new Error("PDF title cannot produce an empty filename")
  return filename
}

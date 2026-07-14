import { tool, type ToolContext } from "@opencode-ai/plugin"
import {
  artifactAttachment,
  requireExpectedText,
  requireReadableInput,
  resolveArtifactOutput,
} from "@necode-ai/plugin-artifacts"
import path from "node:path"
import { readDocument } from "./read.ts"
import { writeDocument } from "./write.ts"

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

/** Document tools contributed by the first-party Documents plugin. */
export const DocumentTools = {
  document_read: tool({
    description: "Read a DOCX document as Markdown text.",
    args: { sourcePath: tool.schema.string() },
    async execute(args, context) {
      const source = await requireReadableInput(context, args.sourcePath)
      return { title: path.basename(source.path), output: await readDocument(source.path) }
    },
  }),
  document_create: tool({
    description: "Create a verified DOCX document from Markdown content.",
    args: {
      title: tool.schema.string(),
      content: tool.schema.string(),
      outputPath: tool.schema.string().optional(),
    },
    execute: (args, context) => createDocument(args, context),
  }),
  document_revise: tool({
    description:
      "Create a new verified DOCX from complete replacement content; complex formatting is not preserved losslessly.",
    args: {
      sourcePath: tool.schema.string(),
      content: tool.schema.string(),
      outputPath: tool.schema.string().optional(),
    },
    execute: (args, context) => reviseDocument(args, context),
  }),
} as const

async function createDocument(args: { title: string; content: string; outputPath?: string }, context: ToolContext) {
  const title = requireText(args.title, "title")
  const content = requireText(args.content, "content")
  const output = await resolveArtifactOutput(context, {
    filename: `${safeName(title)}.docx`,
    outputPath: args.outputPath,
  })
  await writeDocument(output.path, { title, content })
  requireExpectedText(await readDocument(output.path), content)
  return { title, output: `Created ${output.path}`, attachments: [artifactAttachment(output, DOCX_MIME)] }
}

async function reviseDocument(
  args: { sourcePath: string; content: string; outputPath?: string },
  context: ToolContext,
) {
  const source = await requireReadableInput(context, args.sourcePath)
  await readDocument(source.path)
  const content = requireText(args.content, "content")
  const filename = `${path.basename(source.path, path.extname(source.path))}-revised.docx`
  const output = await resolveArtifactOutput(context, { filename, outputPath: args.outputPath })
  await writeDocument(output.path, { title: path.basename(filename, ".docx"), content })
  requireExpectedText(await readDocument(output.path), content)
  return { title: filename, output: `Revised ${output.path}`, attachments: [artifactAttachment(output, DOCX_MIME)] }
}

function requireText(value: string, field: string) {
  const text = value.trim()
  if (!text) throw new Error(`Document ${field} is required`)
  return text
}

function safeName(value: string) {
  const filename = value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim()
  if (!filename) throw new Error("Document title cannot produce an empty filename")
  return filename
}

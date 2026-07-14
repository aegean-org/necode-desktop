import { tool, type ToolContext } from "@opencode-ai/plugin/tool"
import {
  artifactAttachment,
  requireExpectedText,
  requireReadableInput,
  resolveArtifactOutput,
} from "@necode-ai/plugin-artifacts"
import path from "node:path"
import { readPresentation } from "./read.ts"
import { SlideInputSchema, type SlideInput } from "./schema.ts"
import { validatePresentation } from "./validate.ts"
import { writePresentation } from "./write.ts"

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

/** Presentation tools contributed by the first-party Presentations plugin. */
export const PresentationTools = {
  presentation_read: tool({
    description: "Read a PPTX presentation as Markdown text.",
    args: { sourcePath: tool.schema.string() },
    async execute(args, context) {
      const source = await requireReadableInput(context, args.sourcePath)
      await validatePresentation(source.path)
      return { title: path.basename(source.path), output: await readPresentation(source.path) }
    },
  }),
  presentation_create: tool({
    description: "Create a verified PPTX presentation from structured slide input.",
    args: {
      title: tool.schema.string(),
      slides: tool.schema.array(SlideInputSchema),
      outputPath: tool.schema.string().optional(),
    },
    execute: (args, context) => createPresentation(args, context),
  }),
  presentation_revise: tool({
    description:
      "Regenerate a new verified PPTX from complete slide input; arbitrary themes are not preserved losslessly.",
    args: {
      sourcePath: tool.schema.string(),
      title: tool.schema.string(),
      slides: tool.schema.array(SlideInputSchema),
      outputPath: tool.schema.string().optional(),
    },
    execute: (args, context) => revisePresentation(args, context),
  }),
} as const

async function createPresentation(
  args: { title: string; slides: SlideInput[]; outputPath?: string },
  context: ToolContext,
) {
  const title = requireTitle(args.title)
  const output = await resolveArtifactOutput(context, {
    filename: `${safeName(title)}.pptx`,
    outputPath: args.outputPath,
  })
  await writeAndVerify(output.path, { title, slides: args.slides })
  return { title, output: `Created ${output.path}`, attachments: [artifactAttachment(output, PPTX_MIME)] }
}

async function revisePresentation(
  args: { sourcePath: string; title: string; slides: SlideInput[]; outputPath?: string },
  context: ToolContext,
) {
  const source = await requireReadableInput(context, args.sourcePath)
  await validatePresentation(source.path)
  await readPresentation(source.path)
  const title = requireTitle(args.title)
  const filename = `${path.basename(source.path, path.extname(source.path))}-revised.pptx`
  const output = await resolveArtifactOutput(context, { filename, outputPath: args.outputPath })
  await writeAndVerify(output.path, { title, slides: args.slides })
  return { title, output: `Revised ${output.path}`, attachments: [artifactAttachment(output, PPTX_MIME)] }
}

async function writeAndVerify(filePath: string, input: { title: string; slides: SlideInput[] }) {
  await writePresentation(filePath, input)
  await validatePresentation(filePath)
  const reopened = await readPresentation(filePath)
  input.slides.forEach((slide) => {
    if (slide.title.trim()) requireExpectedText(reopened, slide.title)
    if (slide.subtitle?.trim()) requireExpectedText(reopened, slide.subtitle)
    slide.bullets?.forEach((bullet) => requireExpectedText(reopened, bullet))
  })
}

function requireTitle(value: string) {
  const title = value.trim()
  if (!title) throw new Error("Presentation title is required")
  return title
}

function safeName(value: string) {
  const filename = value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim()
  if (!filename) throw new Error("Presentation title cannot produce an empty filename")
  return filename
}

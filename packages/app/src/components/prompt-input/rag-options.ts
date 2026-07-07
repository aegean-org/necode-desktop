import type { RagDocument } from "@opencode-ai/sdk/v2/client"
import type { AtOption } from "./slash-popover"

type RagAtOption = Extract<AtOption, { type: "rag" }>

type CreateRagAtOptionsInput = {
  readonly documents: readonly RagDocument[]
  readonly title: string
  readonly allDocuments: string
  readonly allDocumentsDescription: string
}

const quoteScope = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')

const readNumber = (value: RagDocument["chunks"]) => (typeof value === "number" && Number.isFinite(value) ? value : 0)

/**
 * Builds the literal mention text consumed by the NE RAG backend for a scoped document.
 */
export function ragMentionText(title?: string) {
  if (!title) return "@doc"
  return `@doc:"${quoteScope(title)}"`
}

/**
 * Converts indexed RAG documents into @ mention options for the prompt composer.
 */
export function createRagAtOptions(input: CreateRagAtOptionsInput): RagAtOption[] {
  return [
    {
      type: "rag",
      name: "doc",
      display: `doc ${input.allDocuments} ${input.title} documents`,
      insertText: `${ragMentionText()} `,
      label: `${ragMentionText()} ${input.allDocuments}`,
      description: input.allDocumentsDescription,
    },
    ...input.documents.map((document) => ({
      type: "rag" as const,
      name: "doc" as const,
      display: `doc ${document.title} ${document.filePath}`,
      insertText: `${ragMentionText(document.title)} `,
      description: `${document.filePath} - ${readNumber(document.chunks)} chunks`,
      title: document.title,
    })),
  ]
}

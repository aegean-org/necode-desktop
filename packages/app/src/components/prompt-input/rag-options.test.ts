import { describe, expect, test } from "bun:test"
import { createRagAtOptions, ragMentionText } from "./rag-options"

describe("prompt input RAG options", () => {
  test("creates a global option plus indexed document options", () => {
    const options = createRagAtOptions({
      documents: [
        {
          id: 1,
          title: 'Paper "One".pdf',
          filePath: "D:/papers/paper-one.pdf",
          chunks: 12,
        },
      ],
      title: "Documents",
      allDocuments: "All documents",
      allDocumentsDescription: "Search all indexed documents",
    })

    expect(options.map((option) => option.insertText)).toEqual(['@doc ', '@doc:"Paper \\"One\\".pdf" '])
    expect(options[0]).toMatchObject({
      type: "rag",
      label: "@doc All documents",
      description: "Search all indexed documents",
    })
    expect(options[1]).toMatchObject({
      type: "rag",
      title: 'Paper "One".pdf',
      display: 'doc Paper "One".pdf D:/papers/paper-one.pdf',
      description: "D:/papers/paper-one.pdf - 12 chunks",
    })
  })

  test("formats bare and scoped mention text", () => {
    expect(ragMentionText()).toBe("@doc")
    expect(ragMentionText("paper.pdf")).toBe('@doc:"paper.pdf"')
  })
})

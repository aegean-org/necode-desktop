import { describe, expect, test } from "bun:test"
import type { AgentPart, FileAttachmentPart, RagAttachmentPart } from "@/context/prompt"
import { createPromptPill, isPromptPillElement, readPromptPill } from "./prompt-pill"

describe("prompt input pills", () => {
  test("creates and reads RAG document pills", () => {
    const part: RagAttachmentPart = {
      type: "rag",
      name: "doc",
      title: "paper.pdf",
      content: '@doc:"paper.pdf"',
      start: 0,
      end: 16,
    }

    const pill = createPromptPill(part)

    expect(pill.textContent).toBe('@doc:"paper.pdf"')
    expect(pill.dataset.type).toBe("rag")
    expect(pill.dataset.name).toBe("doc")
    expect(pill.dataset.title).toBe("paper.pdf")
    expect(pill.getAttribute("contenteditable")).toBe("false")
    expect(isPromptPillElement(pill)).toBe(true)
    expect(readPromptPill(pill, 3)).toEqual({ ...part, start: 3, end: 19 })
  })

  test("creates and reads file and agent pills", () => {
    const file: FileAttachmentPart = {
      type: "file",
      path: "src/app.ts",
      content: "@src/app.ts",
      start: 0,
      end: 11,
    }
    const agent: AgentPart = {
      type: "agent",
      name: "planner",
      content: "@planner",
      start: 0,
      end: 8,
    }

    expect(readPromptPill(createPromptPill(file), 1)).toEqual({ ...file, start: 1, end: 12 })
    expect(readPromptPill(createPromptPill(agent), 2)).toEqual({ ...agent, start: 2, end: 10 })
  })
})

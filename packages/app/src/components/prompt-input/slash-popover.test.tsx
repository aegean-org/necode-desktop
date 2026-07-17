import { describe, expect, test } from "bun:test"
import type { AtOption } from "./slash-popover"
import { describeAtOption } from "./slash-popover"

describe("prompt popover @ options", () => {
  test("describes the NE RAG document option as a text mention candidate", () => {
    expect(
      describeAtOption({
        type: "rag",
        name: "doc",
        display: "doc documents",
        insertText: "@doc ",
        label: "@doc All documents",
        description: "Search indexed documents",
      } as AtOption),
    ).toEqual({
      label: "@doc All documents",
      description: "Search indexed documents",
    })
  })

  test("describes scoped NE RAG document options with the document title", () => {
    expect(
      describeAtOption({
        type: "rag",
        name: "doc",
        display: "doc paper.pdf D:/papers/paper.pdf",
        insertText: '@doc:"paper.pdf" ',
        description: "D:/papers/paper.pdf - 3 chunks",
        title: "paper.pdf",
      } as AtOption),
    ).toEqual({
      label: '@doc:"paper.pdf"',
      description: "D:/papers/paper.pdf - 3 chunks",
    })
  })

  test("describes Computer Use as a capability instead of an agent mention", () => {
    expect(
      describeAtOption({
        type: "capability",
        id: "computer-use",
        display: "电脑 Computer Use",
        label: "@电脑 Computer Use",
        description: "控制桌面应用",
        available: true,
        entry: {} as never,
      }),
    ).toEqual({ label: "@电脑 Computer Use", description: "控制桌面应用" })
  })
})

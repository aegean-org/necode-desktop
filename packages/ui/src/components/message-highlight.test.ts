import { describe, expect, test } from "bun:test"
import { findRagMentions } from "./message-highlight"

describe("findRagMentions", () => {
  test("finds bare and scoped RAG mentions in sent user messages", () => {
    expect(findRagMentions('@doc analyze @doc:"paper one.pdf" and @\u6587\u732e')).toEqual([
      { start: 0, end: 4, type: "rag" },
      { start: 13, end: 33, type: "rag" },
      { start: 38, end: 41, type: "rag" },
    ])
  })
})

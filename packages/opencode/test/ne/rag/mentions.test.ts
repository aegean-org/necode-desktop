import { describe, expect, test } from "bun:test"
import { isNeRagMentionToken, parseNeRagMentions } from "../../../src/ne/rag/mentions"

describe("NE RAG mentions", () => {
  test("parses bare @doc as an enabled RAG directive", () => {
    expect(parseNeRagMentions("summarize @doc")).toEqual({
      cleanPrompt: "summarize",
      enabled: true,
      mentions: [],
    })
  })

  test("parses scoped English and Chinese document mentions", () => {
    expect(parseNeRagMentions('compare @文献:"Paper One" and @doc:paper-two')).toEqual({
      cleanPrompt: "compare and",
      enabled: true,
      mentions: ["Paper One", "paper-two"],
    })
  })

  test("does not treat longer @doc words as RAG directives", () => {
    expect(parseNeRagMentions("open @document and @docs")).toEqual({
      cleanPrompt: "open @document and @docs",
      enabled: false,
      mentions: [],
    })
  })

  test("detects reserved RAG mention tokens", () => {
    expect(isNeRagMentionToken("doc")).toBe(true)
    expect(isNeRagMentionToken("doc:paper")).toBe(true)
    expect(isNeRagMentionToken("doc：paper")).toBe(true)
    expect(isNeRagMentionToken("文献")).toBe(true)
    expect(isNeRagMentionToken("文献:paper")).toBe(true)
    expect(isNeRagMentionToken("文献：paper")).toBe(true)
    expect(isNeRagMentionToken("document")).toBe(false)
  })
})

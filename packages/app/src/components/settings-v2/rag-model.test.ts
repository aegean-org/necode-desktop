import { describe, expect, test } from "bun:test"
import { formatRagFileSize, pickedRagPaths, ragStatusSummary } from "./rag-model"

describe("settings RAG model", () => {
  test("normalizes selected file and folder picker results into importable paths", () => {
    expect(pickedRagPaths(null)).toEqual([])
    expect(pickedRagPaths("D:/docs")).toEqual(["D:/docs"])
    expect(pickedRagPaths(["D:/a", "D:/b"])).toEqual(["D:/a", "D:/b"])
    expect(pickedRagPaths([{ path: "D:/paper.pdf", name: "paper.pdf", size: 21 }])).toEqual(["D:/paper.pdf"])
  })

  test("formats imported file sizes for the document picker confirmation", () => {
    expect(formatRagFileSize(0)).toBe("0 B")
    expect(formatRagFileSize(1024)).toBe("1 KB")
    expect(formatRagFileSize(1536)).toBe("1.5 KB")
    expect(formatRagFileSize(2 * 1024 * 1024)).toBe("2 MB")
  })

  test("summarizes indexed document and chunk counts", () => {
    expect(ragStatusSummary({ documents: [], chunks: 0 })).toEqual({ documents: 0, chunks: 0 })
    expect(ragStatusSummary({ documents: [{ chunks: 3 }, { chunks: 4 }], chunks: 7 })).toEqual({
      documents: 2,
      chunks: 7,
    })
  })
})

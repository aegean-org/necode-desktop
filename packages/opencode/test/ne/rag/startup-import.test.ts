import { expect, test } from "bun:test"

type GlobalWithMuPdf = typeof globalThis & {
  $libmupdf_wasm_Module?: unknown
}

test("loading NE RAG text helpers does not initialize the PDF converter", async () => {
  const globalWithMuPdf = globalThis as GlobalWithMuPdf
  delete globalWithMuPdf.$libmupdf_wasm_Module

  await import("../../../src/ne/rag/text")

  expect(globalWithMuPdf.$libmupdf_wasm_Module).toBeUndefined()
})

test("loading the Markit wrapper does not initialize MuPDF", async () => {
  const globalWithMuPdf = globalThis as GlobalWithMuPdf
  delete globalWithMuPdf.$libmupdf_wasm_Module

  await import("../../../src/ne/rag/markit")

  expect(globalWithMuPdf.$libmupdf_wasm_Module).toBeUndefined()
})

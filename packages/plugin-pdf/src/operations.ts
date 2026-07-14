import { readFile, writeFile } from "node:fs/promises"

export type PageRange = { start: number; end: number }

/** Merges PDF inputs in declared order and returns the verified page count. */
export async function mergePdfFiles(sourcePaths: readonly string[], outputPath: string) {
  const { PDFDocument } = await import("pdf-lib")
  const output = await PDFDocument.create()
  for (const sourcePath of sourcePaths) {
    const source = await PDFDocument.load(await readFile(sourcePath))
    const pages = await output.copyPages(source, source.getPageIndices())
    pages.forEach((page) => output.addPage(page))
  }
  await writeFile(outputPath, await output.save())
  return validatePdf(outputPath)
}

/** Writes and verifies one one-based inclusive page range. */
export async function writePdfRange(sourcePath: string, outputPath: string, range: PageRange) {
  const { PDFDocument } = await import("pdf-lib")
  const source = await PDFDocument.load(await readFile(sourcePath))
  requireRange(range, source.getPageCount())
  const output = await PDFDocument.create()
  const indices = Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start - 1 + index)
  const pages = await output.copyPages(source, indices)
  pages.forEach((page) => output.addPage(page))
  await writeFile(outputPath, await output.save())
  return validatePdf(outputPath)
}

/** Reopens a PDF and returns its page count. */
export async function validatePdf(filePath: string) {
  const { PDFDocument } = await import("pdf-lib")
  return (await PDFDocument.load(await readFile(filePath))).getPageCount()
}

function requireRange(range: PageRange, pageCount: number) {
  if (!Number.isInteger(range.start) || !Number.isInteger(range.end)) throw new Error("PDF page range must be integers")
  if (range.start < 1 || range.end < range.start || range.end > pageCount) {
    throw new Error(`PDF page range ${range.start}-${range.end} exceeds 1-${pageCount}`)
  }
}

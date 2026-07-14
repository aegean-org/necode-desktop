/** Reopens a PDF through the independent Markit conversion path. */
export async function readPdfText(filePath: string) {
  const { Markit } = await import("markit-ai")
  const result = await new Markit().convertFile(filePath)
  if (!result.markdown.trim()) throw new Error(`PDF conversion produced no text: ${filePath}`)
  return result.markdown
}

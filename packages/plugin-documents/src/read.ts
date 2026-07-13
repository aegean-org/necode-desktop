/** Reopens a DOCX through the independent Markit conversion path. */
export async function readDocument(filePath: string) {
  const { Markit } = await import("markit-ai")
  const result = await new Markit().convertFile(filePath)
  if (!result.markdown.trim()) throw new Error(`Document conversion produced no text: ${filePath}`)
  return result.markdown
}

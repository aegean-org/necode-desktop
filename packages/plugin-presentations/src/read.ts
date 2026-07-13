/** Reopens a PPTX through the independent Markit conversion path. */
export async function readPresentation(filePath: string) {
  const { Markit } = await import("markit-ai")
  const result = await new Markit().convertFile(filePath)
  if (!result.markdown.trim()) throw new Error(`Presentation conversion produced no text: ${filePath}`)
  return result.markdown
}

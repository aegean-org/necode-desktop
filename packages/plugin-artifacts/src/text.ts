/** Collapses extracted document whitespace for deterministic validation. */
export function normalizeExtractedText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

/** Requires reopened text to contain the meaningful plain-text Markdown content. */
export function requireExpectedText(actual: string, expected: string) {
  const excerpt = normalizeExtractedText(stripMarkdown(expected))
  if (!excerpt) throw new Error("Expected text is empty")
  if (!normalizeExtractedText(actual).includes(excerpt)) {
    throw new Error(`Reopened artifact does not contain expected text: ${excerpt}`)
  }
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[^\n]*\n([\s\S]*?)```/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, "")
    .replace(/[|*_~`>]/g, " ")
}

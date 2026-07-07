const RAG_MENTION_PATTERN =
  /(^|[\s([{<"'`])@(doc|文献)(?=$|[\s),.;!?，。；、）】}]|[:：])(?:[:：](?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s@),.;!?，。；、）】}]+)))?/giu

export interface NeRagMentionParseResult {
  readonly cleanPrompt: string
  readonly enabled: boolean
  readonly mentions: readonly string[]
}

export function isNeRagMentionToken(token: string) {
  const lower = token.toLowerCase()
  return (
    lower === "doc" ||
    lower.startsWith("doc:") ||
    lower.startsWith("doc：") ||
    token === "文献" ||
    token.startsWith("文献:") ||
    token.startsWith("文献：")
  )
}

export function parseNeRagMentions(promptText: string): NeRagMentionParseResult {
  const matches = Array.from(promptText.matchAll(RAG_MENTION_PATTERN))
  return {
    cleanPrompt: stripNeRagMentions(promptText),
    enabled: matches.length > 0,
    mentions: matches.map(getMentionText).filter((value) => value.length > 0),
  }
}

function stripNeRagMentions(promptText: string) {
  return promptText
    .replace(RAG_MENTION_PATTERN, (_match, prefix: string) => prefix)
    .replace(/\s+/g, " ")
    .trim()
}

function getMentionText(match: RegExpMatchArray) {
  return unescapeQuotedMention(match[3] ?? match[4] ?? match[5] ?? "").trim()
}

function unescapeQuotedMention(value: string) {
  return value.replace(/\\(["'\\])/gu, "$1")
}

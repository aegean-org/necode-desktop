const RAG_MENTION_PATTERN =
  /(^|[\s([{<"'`])@(doc|\u6587\u732e)(?=$|[\s),.;!?\uff0c\u3002\uff1b\u3001\uff09\u3011}]|[:\uff1a])(?:[:\uff1a](?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s@),.;!?\uff0c\u3002\uff1b\u3001\uff09\u3011}]+))?/giu

export type MessageHighlight = { start: number; end: number; type: "rag" }

export function findRagMentions(text: string): MessageHighlight[] {
  return Array.from(text.matchAll(RAG_MENTION_PATTERN)).map((match) => ({
    start: match.index + (match[1]?.length ?? 0),
    end: match.index + match[0].length,
    type: "rag",
  }))
}

import type { AgentPart, FileAttachmentPart, RagAttachmentPart } from "@/context/prompt"

export type PromptPillPart = FileAttachmentPart | AgentPart | RagAttachmentPart

/**
 * Creates the non-editable inline attachment chip used inside the prompt editor.
 */
export function createPromptPill(part: PromptPillPart) {
  const pill = document.createElement("span")
  pill.textContent = part.content
  pill.setAttribute("data-type", part.type)
  if (part.type === "file") pill.setAttribute("data-path", part.path)
  if (part.type === "agent") pill.setAttribute("data-name", part.name)
  if (part.type === "rag") {
    pill.setAttribute("data-name", part.name)
    if (part.title) pill.setAttribute("data-title", part.title)
  }
  pill.setAttribute("contenteditable", "false")
  pill.style.userSelect = "text"
  pill.style.cursor = "default"
  return pill
}

export function isPromptPillElement(element: HTMLElement) {
  return element.dataset.type === "file" || element.dataset.type === "agent" || element.dataset.type === "rag"
}

export function readPromptPill(element: HTMLElement, start: number): PromptPillPart | undefined {
  const content = element.textContent ?? ""
  const end = start + content.length
  if (element.dataset.type === "file") {
    return { type: "file", path: element.dataset.path!, content, start, end }
  }
  if (element.dataset.type === "agent") {
    return { type: "agent", name: element.dataset.name!, content, start, end }
  }
  if (element.dataset.type === "rag") {
    return { type: "rag", name: "doc", title: element.dataset.title, content, start, end }
  }
}

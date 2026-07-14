import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const PAGE = { width: 595.28, height: 841.89, margin: 56, fontSize: 11, titleSize: 18, lineHeight: 18 } as const
const FONT_FILE = fileURLToPath(new URL("../assets/NotoSansCJKsc-Regular.otf", import.meta.url))

/** Creates a CJK-capable PDF with measured line wrapping and page breaks. */
export async function createPdf(filePath: string, input: { title: string; content: string }) {
  const { PDFDocument } = await import("pdf-lib")
  const fontkit = await import("@pdf-lib/fontkit")
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit.default)
  const font = await document.embedFont(await readFile(FONT_FILE))
  renderText(document, font, input)
  await writeFile(filePath, await document.save())
}

function renderText(
  document: import("pdf-lib").PDFDocument,
  font: import("pdf-lib").PDFFont,
  input: { title: string; content: string },
) {
  const state = { page: document.addPage([PAGE.width, PAGE.height]), y: PAGE.height - PAGE.margin }
  state.page.drawText(input.title, { x: PAGE.margin, y: state.y, size: PAGE.titleSize, font })
  state.y -= PAGE.titleSize + PAGE.lineHeight
  for (const paragraph of plainLines(input.content)) {
    const lines = paragraph ? wrapText(font, paragraph, PAGE.fontSize, PAGE.width - PAGE.margin * 2) : [""]
    for (const line of lines) {
      if (state.y < PAGE.margin + PAGE.lineHeight) {
        state.page = document.addPage([PAGE.width, PAGE.height])
        state.y = PAGE.height - PAGE.margin
      }
      if (line) state.page.drawText(line, { x: PAGE.margin, y: state.y, size: PAGE.fontSize, font })
      state.y -= PAGE.lineHeight
    }
  }
}

function wrapText(font: import("pdf-lib").PDFFont, text: string, size: number, width: number) {
  const lines: string[] = []
  let current = ""
  for (const character of Array.from(text)) {
    const next = current + character
    if (current && font.widthOfTextAtSize(next, size) > width) {
      lines.push(current)
      current = character
      continue
    }
    current = next
  }
  if (current) lines.push(current)
  return lines
}

function plainLines(content: string) {
  return content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s*(?:[-+*]|\d+[.)])\s+/, "")
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[*_~`]/g, "")
        .trim(),
    )
}

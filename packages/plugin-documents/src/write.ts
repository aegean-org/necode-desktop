import { writeFile } from "node:fs/promises"

type Docx = typeof import("docx")
type FileChild = import("docx").FileChild
type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; text: string; ordered: boolean }
  | { kind: "table"; rows: string[][] }

/** Writes a deterministic DOCX from a small Markdown block subset. */
export async function writeDocument(filePath: string, input: { title: string; content: string }) {
  const docx = await import("docx")
  const children = parseMarkdown(input.content).map((block) => renderBlock(docx, block))
  const document = new docx.Document({ title: input.title, sections: [{ children }] })
  await writeFile(filePath, await docx.Packer.toBuffer(document))
}

function parseMarkdown(content: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n")
  const blocks: Block[] = []
  const paragraph: string[] = []
  const flush = () => {
    const text = paragraph.splice(0).join(" ").trim()
    if (text) blocks.push({ kind: "paragraph", text })
  }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? ""
    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    const list = /^\s*(?:(\d+)[.)]|[-+*])\s+(.+)$/.exec(line)
    if (heading) {
      flush()
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] })
      continue
    }
    if (list) {
      flush()
      blocks.push({ kind: "list", ordered: !!list[1], text: list[2] })
      continue
    }
    if (isTableStart(lines, index)) {
      flush()
      const table = readTable(lines, index)
      blocks.push({ kind: "table", rows: table.rows })
      index = table.end
      continue
    }
    if (!line.trim()) flush()
    else paragraph.push(line.trim())
  }
  flush()
  return blocks
}

function renderBlock(docx: Docx, block: Block): FileChild {
  if (block.kind === "heading") {
    return new docx.Paragraph({ text: plainText(block.text), heading: headingLevel(docx, block.level) })
  }
  if (block.kind === "list") {
    const text = block.ordered ? `1. ${plainText(block.text)}` : plainText(block.text)
    return new docx.Paragraph({ text, bullet: block.ordered ? undefined : { level: 0 } })
  }
  if (block.kind === "table") return renderTable(docx, block.rows)
  return new docx.Paragraph({ children: [new docx.TextRun(plainText(block.text))] })
}

function renderTable(docx: Docx, rows: string[][]) {
  return new docx.Table({
    width: { size: 100, type: docx.WidthType.PERCENTAGE },
    rows: rows.map(
      (cells) =>
        new docx.TableRow({
          children: cells.map(
            (cell) => new docx.TableCell({ children: [new docx.Paragraph({ text: plainText(cell) })] }),
          ),
        }),
    ),
  })
}

function isTableStart(lines: readonly string[], index: number) {
  return splitTableRow(lines[index] ?? "").length > 1 && /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*$/.test(lines[index + 1] ?? "")
}

function readTable(lines: readonly string[], start: number) {
  const rows = [splitTableRow(lines[start] ?? "")]
  let end = start + 1
  for (let index = start + 2; index < lines.length; index++) {
    const cells = splitTableRow(lines[index] ?? "")
    if (cells.length <= 1) break
    rows.push(cells)
    end = index
  }
  return { rows, end }
}

function splitTableRow(line: string) {
  return line
    .replace(/^\s*\||\|\s*$/g, "")
    .split("|")
    .map((cell) => cell.trim())
}

function headingLevel(docx: Docx, level: number) {
  const levels = [
    docx.HeadingLevel.HEADING_1,
    docx.HeadingLevel.HEADING_2,
    docx.HeadingLevel.HEADING_3,
    docx.HeadingLevel.HEADING_4,
    docx.HeadingLevel.HEADING_5,
    docx.HeadingLevel.HEADING_6,
  ]
  return levels[Math.min(Math.max(level, 1), levels.length) - 1]
}

function plainText(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]/g, "")
}

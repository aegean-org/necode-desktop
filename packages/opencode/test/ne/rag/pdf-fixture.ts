const PDF_PAGE_WIDTH = 612
const PDF_PAGE_HEIGHT = 792
const PDF_TEXT_X = 72
const PDF_TEXT_Y = 720
const PDF_FONT_SIZE = 24

export function buildTextPdf(text: string) {
  const escaped = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
  const content = `BT /F1 ${PDF_FONT_SIZE} Tf ${PDF_TEXT_X} ${PDF_TEXT_Y} Td (${escaped}) Tj ET`
  const stream = `${content}\n`
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    [
      "3 0 obj\n",
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] `,
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\n",
      "endobj\n",
    ].join(""),
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}endstream\nendobj\n`,
  ]
  return serializePdf(objects)
}

function serializePdf(objects: readonly string[]) {
  const offsets = objects.reduce(
    (state, object) => ({
      body: state.body + object,
      offsets: [...state.offsets, Buffer.byteLength(state.body, "binary")],
    }),
    { body: "%PDF-1.4\n", offsets: [] as number[] },
  )
  const xref = Buffer.byteLength(offsets.body, "binary")
  return [
    offsets.body,
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`,
    offsets.offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join(""),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  ].join("")
}

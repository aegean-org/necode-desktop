/** Reads workbook sheet metadata and an optional explicit cell range. */
export async function readWorkbook(filePath: string, input: { sheet?: string; range?: string }) {
  const ExcelJS = (await import("exceljs")).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  if (!input.sheet) return JSON.stringify({ sheets: workbook.worksheets.map(sheetSummary) })
  const sheet = workbook.getWorksheet(input.sheet)
  if (!sheet) throw new Error(`Worksheet not found: ${input.sheet}`)
  if (!input.range) return JSON.stringify({ sheet: sheetSummary(sheet) })
  const bounds = requireRange(input.range)
  const cells = []
  for (let row = bounds.startRow; row <= bounds.endRow; row++) {
    for (let column = bounds.startColumn; column <= bounds.endColumn; column++) {
      const cell = sheet.getCell(row, column)
      cells.push(cellOutput(cell))
    }
  }
  return JSON.stringify({ sheet: sheet.name, range: input.range, cells })
}

function sheetSummary(sheet: import("exceljs").Worksheet) {
  return { name: sheet.name, rows: sheet.rowCount, columns: sheet.columnCount }
}

function cellOutput(cell: import("exceljs").Cell) {
  const value = cell.value
  if (value && typeof value === "object" && "formula" in value) {
    return { address: cell.address, formula: value.formula, result: value.result, numberFormat: cell.numFmt }
  }
  return { address: cell.address, value, numberFormat: cell.numFmt }
}

function requireRange(value: string) {
  const match = /^([A-Z]{1,3})([1-9]\d*):([A-Z]{1,3})([1-9]\d*)$/i.exec(value.trim())
  if (!match) throw new Error(`Invalid A1 range: ${value}`)
  const bounds = {
    startColumn: columnNumber(match[1]),
    startRow: Number(match[2]),
    endColumn: columnNumber(match[3]),
    endRow: Number(match[4]),
  }
  if (bounds.endColumn < bounds.startColumn || bounds.endRow < bounds.startRow) {
    throw new Error(`Invalid A1 range order: ${value}`)
  }
  return bounds
}

function columnNumber(value: string) {
  return Array.from(value.toUpperCase()).reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0)
}

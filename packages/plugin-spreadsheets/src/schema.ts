import { tool } from "@opencode-ai/plugin"

export type CellInput = {
  address: string
  value?: string | number | boolean
  formula?: string
  numberFormat?: string
}

export type SheetInput = { name: string; cells: CellInput[] }

/** Cell mutation schema accepted by create and update tools. */
export const CellInputSchema = tool.schema.object({
  address: tool.schema.string(),
  value: tool.schema.union([tool.schema.string(), tool.schema.number(), tool.schema.boolean()]).optional(),
  formula: tool.schema.string().optional(),
  numberFormat: tool.schema.string().optional(),
})

/** Worksheet mutation schema accepted by create and update tools. */
export const SheetInputSchema = tool.schema.object({
  name: tool.schema.string(),
  cells: tool.schema.array(CellInputSchema),
})

/** Validates workbook operations before any file is written. */
export function validateSheets(sheets: readonly SheetInput[]) {
  if (sheets.length === 0) throw new Error("At least one worksheet is required")
  const names = new Set<string>()
  for (const sheet of sheets) {
    const name = sheet.name.trim()
    if (!name) throw new Error("Worksheet name is required")
    if (names.has(name)) throw new Error(`Duplicate worksheet name: ${name}`)
    names.add(name)
    sheet.cells.forEach(validateCell)
  }
}

function validateCell(cell: CellInput) {
  if (!/^[A-Z]{1,3}[1-9]\d*$/i.test(cell.address)) throw new Error(`Invalid A1 cell address: ${cell.address}`)
  if (cell.value !== undefined && cell.formula !== undefined) {
    throw new Error(`Cell ${cell.address} cannot define both value and formula`)
  }
  if (cell.formula !== undefined && !cell.formula.trim()) throw new Error(`Cell ${cell.address} formula is empty`)
}

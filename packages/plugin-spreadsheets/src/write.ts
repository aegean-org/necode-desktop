import type { CellInput, SheetInput } from "./schema.js"
import { validateSheets } from "./schema.js"

type Workbook = import("exceljs").Workbook

/** Creates and verifies a new XLSX workbook. */
export async function writeWorkbook(filePath: string, sheets: readonly SheetInput[]) {
  validateSheets(sheets)
  const workbook = await newWorkbook()
  sheets.forEach((sheet) => applySheet(workbook, sheet))
  await workbook.xlsx.writeFile(filePath)
  await verifyWorkbook(filePath, sheets)
}

/** Applies explicit cell operations to a source workbook and verifies the new file. */
export async function updateWorkbook(sourcePath: string, outputPath: string, sheets: readonly SheetInput[]) {
  validateSheets(sheets)
  const workbook = await loadWorkbook(sourcePath)
  sheets.forEach((sheet) => applySheet(workbook, sheet))
  await workbook.xlsx.writeFile(outputPath)
  await verifyWorkbook(outputPath, sheets)
}

async function newWorkbook() {
  const ExcelJS = (await import("exceljs")).default
  return new ExcelJS.Workbook()
}

async function loadWorkbook(filePath: string) {
  const workbook = await newWorkbook()
  await workbook.xlsx.readFile(filePath)
  return workbook
}

function applySheet(workbook: Workbook, input: SheetInput) {
  const name = input.name.trim()
  const sheet = workbook.getWorksheet(name) ?? workbook.addWorksheet(name)
  input.cells.forEach((cell) => applyCell(sheet, cell))
}

function applyCell(sheet: import("exceljs").Worksheet, input: CellInput) {
  const cell = sheet.getCell(input.address.toUpperCase())
  if (input.formula !== undefined) cell.value = { formula: input.formula }
  else if (input.value !== undefined) cell.value = input.value
  if (input.numberFormat !== undefined) cell.numFmt = input.numberFormat
}

async function verifyWorkbook(filePath: string, sheets: readonly SheetInput[]) {
  const workbook = await loadWorkbook(filePath)
  for (const sheetInput of sheets) {
    const sheet = workbook.getWorksheet(sheetInput.name.trim())
    if (!sheet) throw new Error(`Reopened workbook is missing worksheet: ${sheetInput.name}`)
    sheetInput.cells.forEach((cell) => verifyCell(sheet, cell))
  }
}

function verifyCell(sheet: import("exceljs").Worksheet, input: CellInput) {
  const cell = sheet.getCell(input.address.toUpperCase())
  if (input.formula !== undefined && formulaOf(cell.value) !== input.formula) {
    throw new Error(`Reopened workbook formula mismatch at ${sheet.name}!${input.address}`)
  }
  if (input.value !== undefined && cell.value !== input.value) {
    throw new Error(`Reopened workbook value mismatch at ${sheet.name}!${input.address}`)
  }
  if (input.numberFormat !== undefined && cell.numFmt !== input.numberFormat) {
    throw new Error(`Reopened workbook format mismatch at ${sheet.name}!${input.address}`)
  }
}

function formulaOf(value: import("exceljs").CellValue) {
  if (!value || typeof value !== "object" || !("formula" in value)) return undefined
  return value.formula
}

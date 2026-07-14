import { readFile } from "node:fs/promises"

const REQUIRED_ENTRIES = ["[Content_Types].xml", "ppt/presentation.xml"] as const

/** Reopens a PPTX as ZIP and requires its core presentation entries. */
export async function validatePresentation(filePath: string) {
  const { Uint8ArrayReader, ZipReader } = await import("@zip.js/zip.js")
  const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(await readFile(filePath))))
  const names = (await reader.getEntries()).map((entry) => entry.filename)
  await reader.close()
  REQUIRED_ENTRIES.forEach((required) => {
    if (!names.includes(required)) throw new Error(`Presentation archive is missing ${required}`)
  })
  return names
}

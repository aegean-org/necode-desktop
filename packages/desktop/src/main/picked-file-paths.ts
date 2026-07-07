import { stat } from "node:fs/promises"
import { basename } from "node:path"

type StatFile = (filePath: string) => Promise<{ readonly size: number }>

export type PickedFilePath = {
  readonly path: string
  readonly name: string
  readonly size: number
}

/** Returns metadata for selected local paths without reading file contents. */
export async function describePickedFilePaths(
  filePaths: readonly string[],
  statFile: StatFile = stat,
): Promise<PickedFilePath[]> {
  return Promise.all(
    filePaths.map(async (filePath) => ({
      path: filePath,
      name: basename(filePath),
      size: (await statFile(filePath)).size,
    })),
  )
}

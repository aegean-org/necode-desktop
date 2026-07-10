/** Returns the top-level generated migration directory for either path separator. */
export function migrationDirectoryName(file: string) {
  return file.split(/[\\/]/)[0]
}

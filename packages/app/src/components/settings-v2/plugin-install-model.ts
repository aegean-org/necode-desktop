type PickedFile = { readonly path: string; readonly name: string; readonly size: number }

/** Trims and validates an npm plugin package specification. */
export function normalizeNpmSpec(value: string) {
  const spec = value.trim()
  if (!spec) throw new Error("Plugin package name is required")
  return spec
}

/** Trims and validates a native local plugin path. */
export function normalizeLocalSpec(value: string) {
  const spec = value.trim()
  if (!spec) throw new Error("Plugin path is required")
  return spec
}

/** Returns the first path selected by the native directory picker. */
export function firstPickedDirectory(value: string | string[] | null) {
  if (Array.isArray(value)) return value[0]
  return value ?? undefined
}

/** Returns the first path selected by the native file picker. */
export function firstPickedFile(value: readonly PickedFile[] | null) {
  return value?.[0]?.path
}

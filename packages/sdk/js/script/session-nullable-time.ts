const UPDATE_TIME = /archived\?: number(;?)(\r?\n)(\s+)pinned\?: number(;?)/

/** Patches the generated Session update payload to preserve OpenAPI nullability. */
export function patchNullableSessionTime(source: string) {
  if (!UPDATE_TIME.test(source)) throw new Error("Generated Session update time block was not found")
  return source.replace(UPDATE_TIME, "archived?: number | null$1$2$3pinned?: number | null$4")
}

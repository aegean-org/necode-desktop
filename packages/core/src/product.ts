export * as Product from "./product"

/** System-level naming rules for user-visible product references. */
export const NamingGuidance = [
  'Call the product "NeCode" in user-facing responses.',
  "Preserve technical identifiers such as `opencode.json`, `.opencode/`, and `OPENCODE_*` exactly.",
].join("\n")

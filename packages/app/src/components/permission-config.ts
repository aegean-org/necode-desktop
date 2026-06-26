import type { PermissionActionConfig, PermissionConfig, PermissionRuleConfig } from "@opencode-ai/sdk/v2/client"

/**
 * Display states supported by the permissions settings row.
 */
export type PermissionSelection = PermissionActionConfig | "custom" | undefined

function isPermissionObject(value: PermissionConfig | undefined): value is Exclude<PermissionConfig, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function ruleSelection(value: PermissionRuleConfig | undefined): PermissionSelection {
  if (!value) return
  if (typeof value === "string") return value
  return "custom"
}

/**
 * Resolves the user-configured selection for a tool permission.
 */
export function permissionToolSelection(permission: PermissionConfig | undefined, tool: string): PermissionSelection {
  if (typeof permission === "string") return permission
  if (!isPermissionObject(permission)) return
  return ruleSelection(permission[tool]) ?? ruleSelection(permission["*"])
}

/**
 * Returns a new permission config with a concrete action override for a tool.
 */
export function setPermissionToolAction(
  permission: PermissionConfig | undefined,
  tool: string,
  action: PermissionActionConfig,
): Exclude<PermissionConfig, string> {
  if (typeof permission === "string") return { "*": permission, [tool]: action }
  if (!isPermissionObject(permission)) return { [tool]: action }
  return { ...permission, [tool]: action }
}

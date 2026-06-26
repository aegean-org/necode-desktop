import { describe, expect, test } from "bun:test"
import { permissionToolSelection, setPermissionToolAction } from "./permission-config"

describe("permission config helpers", () => {
  test("uses global string config for every tool", () => {
    expect(permissionToolSelection("allow", "edit")).toBe("allow")
  })

  test("uses wildcard object config when a tool has no override", () => {
    expect(permissionToolSelection({ "*": "deny", edit: "ask" }, "read")).toBe("deny")
    expect(permissionToolSelection({ "*": "deny", edit: "ask" }, "edit")).toBe("ask")
  })

  test("marks pattern rules as custom", () => {
    expect(permissionToolSelection({ read: { "*": "allow", "*.env": "ask" } }, "read")).toBe("custom")
  })

  test("preserves global string config when adding a tool override", () => {
    expect(setPermissionToolAction("allow", "edit", "ask")).toEqual({ "*": "allow", edit: "ask" })
  })

  test("returns immutable object updates", () => {
    const before = { "*": "allow" as const }
    const after = setPermissionToolAction(before, "bash", "deny")
    expect(after).toEqual({ "*": "allow", bash: "deny" })
    expect(before).toEqual({ "*": "allow" })
  })
})

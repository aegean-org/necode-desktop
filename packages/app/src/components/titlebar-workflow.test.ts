import { describe, expect, test } from "bun:test"
import { shouldUseTitlebarSessionTabs } from "./titlebar-workflow"

describe("shouldUseTitlebarSessionTabs", () => {
  test("disables titlebar session tabs in the workflow layout", () => {
    expect(shouldUseTitlebarSessionTabs({ workflowLayout: true })).toBe(false)
  })

  test("keeps legacy titlebar session tabs outside the workflow layout", () => {
    expect(shouldUseTitlebarSessionTabs({ workflowLayout: false })).toBe(true)
  })
})


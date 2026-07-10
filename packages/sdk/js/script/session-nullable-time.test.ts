import { describe, expect, test } from "bun:test"
import { patchNullableSessionTime } from "./session-nullable-time"

describe("patchNullableSessionTime", () => {
  test("makes only session update timestamps nullable", () => {
    const source = `export type SessionUpdateData = {
  body?: {
    time?: {
      archived?: number
      pinned?: number
    }
  }
}
export type Session = { time: { pinned?: number; archived?: number } }
`

    expect(patchNullableSessionTime(source)).toContain("archived?: number | null\n      pinned?: number | null")
    expect(patchNullableSessionTime(source)).toContain("time: { pinned?: number; archived?: number }")
    expect(patchNullableSessionTime("archived?: number;\n  pinned?: number;")).toBe(
      "archived?: number | null;\n  pinned?: number | null;",
    )
  })
})

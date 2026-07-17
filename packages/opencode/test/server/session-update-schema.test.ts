import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { ComputerUsePayload, ComputerUseResult, SessionPaths, UpdatePayload } from "@/server/routes/instance/httpapi/groups/session"

describe("session update payload", () => {
  test("accepts setting and clearing archive and pin timestamps", () => {
    const decode = Schema.decodeUnknownSync(UpdatePayload)

    expect(decode({ time: { archived: 100, pinned: 200 } })).toEqual({
      time: { archived: 100, pinned: 200 },
    })
    expect(decode({ time: { archived: null, pinned: null } })).toEqual({
      time: { archived: null, pinned: null },
    })
  })
})

describe("session computer use payload", () => {
  test("declares the activation endpoint and response", () => {
    expect(SessionPaths.computerUse).toBe("/session/:sessionID/computer-use")
    expect(Schema.decodeUnknownSync(ComputerUsePayload)({ enabled: true })).toEqual({ enabled: true })
    expect(Schema.decodeUnknownSync(ComputerUseResult)({ enabled: false, error: "cleanup failed" })).toEqual({
      enabled: false,
      error: "cleanup failed",
    })
  })
})

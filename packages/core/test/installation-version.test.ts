import { describe, expect, test } from "bun:test"
import { isLocalInstallation } from "../src/installation/version"

describe("installation version", () => {
  test("treats a local build version as local on the dev channel", () => {
    expect(isLocalInstallation("local", "dev")).toBe(true)
    expect(isLocalInstallation("1.2.3", "dev")).toBe(false)
    expect(isLocalInstallation("1.2.3", "local")).toBe(true)
  })
})

import { describe, expect, test } from "bun:test"
import { migrationDirectoryName } from "./migration-path"

describe("migrationDirectoryName", () => {
  test("extracts migration directories from Windows and POSIX paths", () => {
    expect(migrationDirectoryName("20260710041929_add_session_pinned\\migration.sql")).toBe(
      "20260710041929_add_session_pinned",
    )
    expect(migrationDirectoryName("20260710041929_add_session_pinned/migration.sql")).toBe(
      "20260710041929_add_session_pinned",
    )
  })
})

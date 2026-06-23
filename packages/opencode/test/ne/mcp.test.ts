import { expect, test } from "bun:test"
import { withNeDefaultMcp } from "../../src/ne/mcp"

test("withNeDefaultMcp adds NoteExpress and Qingti servers", () => {
  const result = withNeDefaultMcp({}, "win32", "x64")

  expect(result.noteexpress).toEqual({
    type: "local",
    command: ["npx", "-y", "@aegean-org/ne-mcp"],
  })
  expect(result.qingtibase).toEqual({
    type: "local",
    command: [
      "npx",
      "-y",
      "--package",
      "@aegean-org/qt-mcp",
      "--package",
      "@aegean-org/qt-mcp-win32-x64",
      "qt-mcp",
      "-transport",
      "stdio",
    ],
  })
})

test("withNeDefaultMcp does not overwrite user-defined servers", () => {
  const result = withNeDefaultMcp(
    {
      noteexpress: {
        type: "local",
        command: ["custom-ne"],
      },
    },
    "win32",
    "x64",
  )

  expect(result.noteexpress).toEqual({
    type: "local",
    command: ["custom-ne"],
  })
  expect(result.qingtibase).toBeDefined()
})

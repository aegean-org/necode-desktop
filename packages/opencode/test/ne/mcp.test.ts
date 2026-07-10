import { expect, test } from "bun:test"
import { BUILTIN_MCP_NAMES, isBuiltinMcp, withNeDefaultMcp } from "../../src/ne/mcp"

test("exports the stable builtin MCP names", () => {
  expect(BUILTIN_MCP_NAMES).toEqual(["noteexpress", "qingtibase"])
  expect(isBuiltinMcp("noteexpress")).toBe(true)
  expect(isBuiltinMcp("qingtibase")).toBe(true)
  expect(isBuiltinMcp("custom")).toBe(false)
})

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

test("withNeDefaultMcp preserves user server order before missing builtins", () => {
  const result = withNeDefaultMcp({ custom: { type: "local", command: ["custom"] } }, "win32", "x64")

  expect(Object.keys(result)).toEqual(["custom", "noteexpress", "qingtibase"])
})

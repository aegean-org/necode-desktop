import { expect, test } from "bun:test"
import { PluginManifest } from "../src/manifest"
import { Schema } from "effect"

test("decodes plugin display metadata and skill roots", () => {
  const manifest = Schema.decodeUnknownSync(PluginManifest)({
    id: "documents",
    name: "Documents",
    description: "Create Word documents",
    icon: "./assets/icon.svg",
    skills: ["./skills/"],
  })

  expect(manifest).toEqual({
    id: "documents",
    name: "Documents",
    description: "Create Word documents",
    icon: "./assets/icon.svg",
    skills: ["./skills/"],
  })
})

test("rejects malformed plugin metadata", () => {
  expect(() => Schema.decodeUnknownSync(PluginManifest)({ id: "documents", name: "" })).toThrow()
  expect(() => Schema.decodeUnknownSync(PluginManifest)({ id: "documents", name: "Documents", skills: [1] })).toThrow()
})

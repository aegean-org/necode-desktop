import { expect, test } from "bun:test"
import { Config } from "@opencode-ai/core/config"
import { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import { Schema } from "effect"

test("accepts plugin enablement in v1 and v2 config", () => {
  const input = { plugin_enabled: { "builtin:pdf": false, "npm:@scope/demo": true } }

  expect(Schema.decodeUnknownSync(ConfigV1.Info)(input).plugin_enabled).toEqual(input.plugin_enabled)
  expect(Schema.decodeUnknownSync(Config.Info)(input).plugin_enabled).toEqual(input.plugin_enabled)
})

test("preserves prototype-sensitive plugin keys as own properties", () => {
  const input = JSON.parse('{"plugin_enabled":{"__proto__":false,"constructor":true,"toString":false}}')
  const decoded = Schema.decodeUnknownSync(ConfigV1.Info)(input).plugin_enabled!

  expect(Object.hasOwn(decoded, "__proto__")).toBe(true)
  expect(Object.hasOwn(decoded, "constructor")).toBe(true)
  expect(Object.hasOwn(decoded, "toString")).toBe(true)
})

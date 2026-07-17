import { describe, expect, test } from "bun:test"
import { promptPlaceholder } from "./placeholder"

const promptInputSource = await Bun.file(new URL("../prompt-input.tsx", import.meta.url)).text()
const enSource = await Bun.file(new URL("../../i18n/en.ts", import.meta.url)).text()
const zhSource = await Bun.file(new URL("../../i18n/zh.ts", import.meta.url)).text()
const zhtSource = await Bun.file(new URL("../../i18n/zht.ts", import.meta.url)).text()

describe("promptPlaceholder", () => {
  const t = (key: string, params?: Record<string, string>) => `${key}${params?.example ? `:${params.example}` : ""}`

  test("returns shell placeholder in shell mode", () => {
    const value = promptPlaceholder({
      mode: "shell",
      commentCount: 0,
      example: "example",
      suggest: true,
      t,
    })
    expect(value).toBe("prompt.placeholder.shell:example")
  })

  test("returns summarize placeholders for comment context", () => {
    expect(promptPlaceholder({ mode: "normal", commentCount: 1, example: "example", suggest: true, t })).toBe(
      "prompt.placeholder.summarizeComment",
    )
    expect(promptPlaceholder({ mode: "normal", commentCount: 2, example: "example", suggest: true, t })).toBe(
      "prompt.placeholder.summarizeComments",
    )
  })

  test("returns default placeholder with example when suggestions enabled", () => {
    const value = promptPlaceholder({
      mode: "normal",
      commentCount: 0,
      example: "translated-example",
      suggest: true,
      t,
    })
    expect(value).toBe("prompt.placeholder.normal:translated-example")
  })

  test("returns simple placeholder when suggestions disabled", () => {
    const value = promptPlaceholder({
      mode: "normal",
      commentCount: 0,
      example: "translated-example",
      suggest: false,
      t,
    })
    expect(value).toBe("prompt.placeholder.simple")
  })

  test("localizes the workflow composer placeholder", () => {
    const source = promptInputSource.slice(promptInputSource.indexOf("const designPlaceholder"), promptInputSource.indexOf("const modelControlState"))

    expect(source).toContain('language.t("prompt.placeholder.design")')
    expect(source).not.toContain("Ask anything, / for commands, @ for context...")
    expect(enSource).toContain('"prompt.placeholder.design"')
    expect(zhSource).toContain('"prompt.placeholder.design"')
    expect(zhtSource).toContain('"prompt.placeholder.design"')
  })

  test("provides the workflow placeholder in every supported app locale", async () => {
    const locales = ["en", "zh", "zht", "ko", "de", "es", "fr", "da", "ja", "pl", "ru", "uk", "ar", "no", "br", "th", "bs", "tr"]
    const sources = await Promise.all(
      locales.map((locale) => Bun.file(new URL(`../../i18n/${locale}.ts`, import.meta.url)).text()),
    )

    expect(sources.every((source) => source.includes('"prompt.placeholder.design"'))).toBe(true)
  })
})

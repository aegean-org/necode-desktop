import { afterEach, describe, expect, test } from "bun:test"
import { render } from "solid-js/web"
import { Icon, type IconProps } from "./icon"

const disposers: Array<() => void> = []

afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose())
  document.body.replaceChildren()
})

describe("v2 Icon", () => {
  test("renders every supported literal without falling back to plus", () => {
    const root = document.createElement("div")
    document.body.append(root)
    disposers.push(render(() => <Icon name="copy" />, root))

    expect(root.querySelector("use")?.getAttribute("href")).toBe("#opencode-v2-icon-copy")
  })

  test("throws for an unknown runtime name", () => {
    const root = document.createElement("div")
    expect(() => render(() => <Icon name={"missing" as IconProps["name"]} />, root)).toThrow("Unknown v2 icon: missing")
    expect(root.querySelector('use[href="#opencode-v2-icon-plus"]')).toBeNull()
  })
})

type AssertFalse<Value extends false> = Value
const iconNamesAreClosed: AssertFalse<string extends IconProps["name"] ? true : false> = false
expect(iconNamesAreClosed).toBeFalse()

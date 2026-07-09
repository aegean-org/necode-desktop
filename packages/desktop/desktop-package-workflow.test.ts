import { expect, test } from "bun:test"

const workflowText = async () => {
  const file = Bun.file(new URL("../../.github/workflows/desktop-package.yml", import.meta.url))
  if (!(await file.exists())) return ""
  return file.text()
}

const builderConfigText = () => Bun.file(new URL("./electron-builder.config.ts", import.meta.url)).text()

const expectIncludes = (text: string, values: readonly string[]) => {
  values.forEach((value) => expect(text).toContain(value))
}

test("desktop package workflow builds unsigned Windows and macOS artifacts manually", async () => {
  expectIncludes(await workflowText(), [
    "name: desktop-package",
    "workflow_dispatch:",
    "platform:",
    "- all",
    "- windows",
    "- macos",
    "mac_signing:",
    "- unsigned",
    "- signed",
    "package-windows:",
    "runs-on: windows-latest",
    "NECODE_SKIP_CODE_SIGNING: \"true\"",
    "CSC_IDENTITY_AUTO_DISCOVERY: \"false\"",
    "bun run build",
    "bun run package:win",
    "name: necode-desktop-windows",
    "package-macos:",
    "runs-on: macos-latest",
    "Validate Apple signing secrets",
    "APPLE_CERTIFICATE:",
    "APPLE_API_KEY_CONTENT:",
    "Write Apple notarization API key",
    "Package macOS unsigned",
    "OPENCODE_CHANNEL: \"prod\"",
    "bun x --no-install electron-builder --mac --publish never --config electron-builder.config.ts",
    "-c.mac.identity=null",
    "-c.mac.notarize=false",
    "-c.dmg.sign=false",
    "Package macOS signed",
    "APPLE_API_KEY: ${{ runner.temp }}/apple-api-key.p8",
    "APPLE_API_KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}",
    "APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}",
    "Notarize and staple macOS DMG",
    "xcrun notarytool submit",
    "xcrun stapler staple",
    "Verify signed macOS package",
    "codesign --verify --deep --strict --verbose=2",
    "spctl --assess --type execute --verbose",
    "xcrun stapler validate",
    "name: necode-desktop-macos",
  ])
})

test("electron builder exposes an explicit unsigned CI switch", async () => {
  expectIncludes(await builderConfigText(), [
    "const shouldSkipCodeSigning = process.env.NECODE_SKIP_CODE_SIGNING === \"true\"",
    "notarize: shouldSkipCodeSigning ? false : true",
    "sign: shouldSkipCodeSigning ? false : true",
    "signtoolOptions: shouldSkipCodeSigning ? undefined : {",
  ])
})

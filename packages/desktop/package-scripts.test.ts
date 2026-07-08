import { expect, test } from "bun:test"

const packageJson = () => Bun.file(new URL("./package.json", import.meta.url)).json()
const envText = (name: string) => Bun.file(new URL(name, import.meta.url)).text()

test("defines explicit desktop channel env files", async () => {
  expect((await envText(".env.dev")).trim()).toBe("OPENCODE_CHANNEL=dev")
  expect((await envText(".env.prod")).trim()).toBe("OPENCODE_CHANNEL=prod")
})

test("loads desktop channel env files from package scripts", async () => {
  const pkg = await packageJson()
  const scripts = pkg.scripts as Record<string, string>

  expect(scripts.predev).toBe("OPENCODE_CHANNEL=dev bun --env-file=.env.dev ./scripts/predev.ts")
  expect(scripts.dev).toBe("OPENCODE_CHANNEL=dev bun --env-file=.env.dev x --no-install electron-vite dev")
  expect(scripts.prebuild).toBe("OPENCODE_CHANNEL=prod bun --env-file=.env.prod ./scripts/prebuild.ts")
  expect(scripts.build).toBe("OPENCODE_CHANNEL=prod bun --env-file=.env.prod x --no-install electron-vite build")
  expect(scripts.preview).toBe("OPENCODE_CHANNEL=prod bun --env-file=.env.prod x --no-install electron-vite preview")
  expect(scripts.package).toBe(
    "OPENCODE_CHANNEL=prod bun --env-file=.env.prod x --no-install electron-builder --config electron-builder.config.ts",
  )
  expect(scripts["package:mac"]).toBe(
    "OPENCODE_CHANNEL=prod bun --env-file=.env.prod x --no-install electron-builder --mac --config electron-builder.config.ts",
  )
  expect(scripts["package:win"]).toBe(
    "OPENCODE_CHANNEL=prod bun --env-file=.env.prod x --no-install electron-builder --win --config electron-builder.config.ts",
  )
  expect(scripts["package:linux"]).toBe(
    "OPENCODE_CHANNEL=prod bun --env-file=.env.prod x --no-install electron-builder --linux --config electron-builder.config.ts",
  )
  expect(scripts["package:win:dir"]).toBe(
    "OPENCODE_CHANNEL=prod bun --env-file=.env.prod x --no-install electron-builder --win --dir --config electron-builder.config.ts",
  )
})

import { describe, expect, test } from "bun:test"
import electron from "electron"
import { fileURLToPath } from "node:url"
import { verifyProductivityRuntime } from "../../scripts/productivity-runtime"

const MARKIT_AI_VERSION = "0.5.3"
const PRODUCTIVITY_DEPENDENCIES = {
  "@necode-ai/plugin-artifacts": "workspace:*",
  "@necode-ai/plugin-documents": "workspace:*",
  "@necode-ai/plugin-pdf": "workspace:*",
  "@necode-ai/plugin-presentations": "workspace:*",
  "@necode-ai/plugin-spreadsheets": "workspace:*",
  "@pdf-lib/fontkit": "1.1.1",
  docx: "9.5.1",
  exceljs: "4.4.0",
  "pdf-lib": "1.17.1",
  pptxgenjs: "4.0.1",
  sharp: "0.33.5",
} as const

describe("desktop server bundle runtime dependencies", () => {
  test("declares the dynamic RAG PDF converter dependency", async () => {
    const pkg = (await Bun.file(new URL("../../package.json", import.meta.url)).json()) as {
      dependencies?: Record<string, string>
    }

    expect(pkg.dependencies?.["markit-ai"]).toBe(MARKIT_AI_VERSION)
  })

  test("declares productivity plugin packages and dynamic format dependencies", async () => {
    const pkg = (await Bun.file(new URL("../../package.json", import.meta.url)).json()) as {
      dependencies?: Record<string, string>
    }
    Object.entries(PRODUCTIVITY_DEPENDENCIES).forEach(([name, version]) => {
      expect(pkg.dependencies?.[name]).toBe(version)
    })
  })

  test("packages plugin skills and the licensed PDF font asset", async () => {
    expect(verifyProductivityRuntime()).toBeUndefined()
    const pdfRoot = new URL("../../../plugin-pdf/", import.meta.url)
    const packageJson = (await Bun.file(new URL("package.json", pdfRoot)).json()) as { files?: string[] }
    expect(packageJson.files).toContain("skills")
    expect(packageJson.files).toContain("assets")
    expect(await Bun.file(new URL("assets/NotoSansCJKsc-Regular.otf", pdfRoot)).exists()).toBe(true)
    expect(await Bun.file(new URL("assets/OFL.txt", pdfRoot)).text()).toContain("SIL Open Font License")
  })

  test("loads productivity plugins in the Electron Node sidecar runtime", async () => {
    const specs = [
      "@necode-ai/plugin-documents",
      "@necode-ai/plugin-pdf",
      "@necode-ai/plugin-presentations",
      "@necode-ai/plugin-spreadsheets",
    ]
    const child = Bun.spawn(
      [
        electron,
        "--preserve-symlinks",
        "--input-type=module",
        "--eval",
        `await Promise.all(${JSON.stringify(specs)}.map((spec) => import(spec)))`,
      ],
      {
        cwd: fileURLToPath(new URL("../..", import.meta.url)),
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
        stderr: "pipe",
      },
    )
    const error = await new Response(child.stderr).text()

    expect(await child.exited, error).toBe(0)
  })

  test("keeps Skill source hashing compatible with the Electron Node sidecar", async () => {
    const sources = await Promise.all(
      ["../../../opencode/src/skill/managed.ts", "../../../core/src/skill/discovery.ts"].map((file) =>
        Bun.file(new URL(file, import.meta.url)).text(),
      ),
    )

    expect(sources.every((source) => source.includes("Hash.fast"))).toBe(true)
    expect(sources.every((source) => !source.includes("Bun.hash"))).toBe(true)
  })
})

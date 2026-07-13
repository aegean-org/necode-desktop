# Documents and PDF Plugins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This project must use one inline agent; do not dispatch subagents.

**Goal:** Deliver real Documents and PDF first-party plugins with session artifact output, explicit permissions, plugin skills, and reopen-based file validation.

**Architecture:** A small shared artifact package owns output resolution, permission requests, filename validation, and attachment creation. Each plugin dynamically imports its heavy format library inside tool execution and validates every generated file with an independent read path before returning an attachment.

**Tech Stack:** `@opencode-ai/plugin`, Bun, `docx@9.5.1`, `markit-ai@0.5.3`, `pdf-lib@1.17.1`, `@pdf-lib/fontkit@1.1.1`, bundled Noto Sans CJK SC font.

## Global Constraints

- Execute after plugin platform and config/API plans.
- Packages are `@necode-ai/plugin-artifacts`, `@necode-ai/plugin-documents`, and `@necode-ai/plugin-pdf`.
- Heavy libraries must use dynamic imports inside tool execution.
- Default output uses `ToolContext.artifact`; explicit paths require existing permission APIs.
- Never return an attachment until the produced file reopens successfully.
- Do not execute document macros or embedded scripts.
- Keep source files below 300 lines and functions below 50 lines.

All three new packages declare dev dependencies `@tsconfig/node22: catalog:`, `@types/node: catalog:`, and `@typescript/native-preview: catalog:` and use this `tsconfig.json`:

```json
{
  "extends": "@tsconfig/node22/tsconfig.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist", "module": "nodenext", "moduleResolution": "nodenext", "declaration": true, "lib": ["es2022", "dom"] },
  "include": ["src"]
}
```

---

### Task 1: Shared Artifact Output and Validation Package

**Files:**
- Create: `packages/plugin-artifacts/package.json`
- Create: `packages/plugin-artifacts/tsconfig.json`
- Create: `packages/plugin-artifacts/src/output.ts`
- Create: `packages/plugin-artifacts/src/text.ts`
- Create: `packages/plugin-artifacts/src/index.ts`
- Test: `packages/plugin-artifacts/test/output.test.ts`

**Interfaces:**
- Produces: `resolveArtifactOutput`, `requireReadableInput`, `artifactAttachment`, `normalizeExtractedText`, `requireExpectedText`.

- [ ] **Step 1: Write failing output tests**

```ts
expect(await resolveArtifactOutput(ctx, { filename: "报告.docx" })).toEqual({
  path: "D:/data/artifacts/session/报告.docx",
  url: "file:///D:/data/artifacts/session/%E6%8A%A5%E5%91%8A.docx",
})
await expect(resolveArtifactOutput(ctx, { filename: "../escape.docx" })).rejects.toThrow("filename")
expect(requireExpectedText("  第一章\n正文 ", "第一章 正文")).toBeUndefined()
```

- [ ] **Step 2: Run tests and verify failure**

Run: `bun test` from `packages/plugin-artifacts`.
Expected: FAIL because the package does not exist.

- [ ] **Step 3: Implement output and permission boundaries**

Use this package contract:

```json
{
  "name": "@necode-ai/plugin-artifacts",
  "private": true,
  "type": "module",
  "scripts": { "test": "bun test", "typecheck": "tsgo --noEmit" },
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@opencode-ai/plugin": "workspace:*" },
  "devDependencies": { "@tsconfig/node22": "catalog:", "@types/node": "catalog:", "@typescript/native-preview": "catalog:" }
}
```

```ts
export async function resolveArtifactOutput(context: ToolContext, input: OutputInput) {
  if (!input.outputPath) return context.artifact(requireFilename(input.filename))
  const target = path.resolve(input.outputPath)
  await context.ask({ permission: "edit", patterns: [target], always: [], metadata: {} })
  const relative = path.relative(context.worktree, target)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    await context.ask({ permission: "external_directory", patterns: [target], always: [], metadata: {} })
  }
  return { path: target, url: pathToFileURL(target).href }
}
```

`requireReadableInput` requests `read` permission and `external_directory` permission when required. `artifactAttachment` returns `{ type: "file", mime, url, filename }`. Text comparison collapses whitespace and requires the normalized expected excerpt to occur in reopened content.

- [ ] **Step 4: Run tests and typecheck**

Run: `bun test && bun typecheck` from `packages/plugin-artifacts`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-artifacts package.json bun.lock
git commit -m "feat(plugin): add artifact output helpers"
```

### Task 2: Documents Plugin Tools and Skill

**Files:**
- Create: `packages/plugin-documents/package.json`
- Create: `packages/plugin-documents/tsconfig.json`
- Create: `packages/plugin-documents/src/read.ts`
- Create: `packages/plugin-documents/src/write.ts`
- Create: `packages/plugin-documents/src/server.ts`
- Create: `packages/plugin-documents/src/index.ts`
- Create: `packages/plugin-documents/skills/documents/SKILL.md`
- Test: `packages/plugin-documents/test/documents.test.ts`

**Interfaces:**
- Produces tools: `document_read`, `document_create`, `document_revise`.
- Produces: `DocumentsPlugin`, `DocumentsManifest`, `DocumentsRoot`, manifest ID `documents`.

- [ ] **Step 1: Write failing real DOCX tests**

```ts
const created = await tools.document_create.execute({ title: "测试报告", content: "# 第一章\n正文" }, ctx)
expect(created.attachments?.[0]?.mime).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
const reopened = await readDocument(fileURLToPath(created.attachments![0].url))
expect(normalizeExtractedText(reopened)).toContain("第一章 正文")
```

- [ ] **Step 2: Run tests and verify failure**

Run: `bun test` from `packages/plugin-documents`.
Expected: FAIL because the plugin package does not exist.

- [ ] **Step 3: Implement read and create paths**

Use this package contract:

```json
{
  "name": "@necode-ai/plugin-documents", "private": true, "type": "module",
  "scripts": { "test": "bun test", "typecheck": "tsgo --noEmit" },
  "exports": { ".": "./src/index.ts", "./server": "./src/server.ts" },
  "files": ["src", "skills"],
  "necode": { "plugin": { "id": "documents", "name": "Documents", "description": "创建和读取 Word 文档", "skills": ["./skills/"] } },
  "dependencies": { "@opencode-ai/plugin": "workspace:*", "@necode-ai/plugin-artifacts": "workspace:*", "docx": "9.5.1", "markit-ai": "0.5.3" },
  "devDependencies": { "@tsconfig/node22": "catalog:", "@types/node": "catalog:", "@typescript/native-preview": "catalog:" }
}
```

```ts
export const documentCreate = tool({
  description: "Create a verified DOCX document from Markdown content.",
  args: { title: tool.schema.string(), content: tool.schema.string(), outputPath: tool.schema.string().optional() },
  async execute(args, context) {
    const output = await resolveArtifactOutput(context, { filename: `${safeName(args.title)}.docx`, outputPath: args.outputPath })
    await writeDocument(output.path, args)
    requireExpectedText(await readDocument(output.path), args.content)
    return { output: `Created ${output.path}`, attachments: [artifactAttachment(output, DOCX_MIME)] }
  },
})
```

`readDocument` dynamically imports `markit-ai`; `writeDocument` dynamically imports `docx`. Split Markdown block conversion into focused paragraph, heading, list, and table functions.

Export the package root with `export const DocumentsRoot = fileURLToPath(new URL("..", import.meta.url))` so built-in skill paths resolve in workspace and packaged layouts.

- [ ] **Step 4: Implement explicit revision semantics**

`document_revise` accepts `sourcePath`, complete replacement `content`, and optional `outputPath`. It reads the source to prove accessibility, writes a new DOCX, and states in its description that complex third-party formatting is not preserved losslessly.

- [ ] **Step 5: Add the skill**

```markdown
---
name: documents
description: Create, read, and revise DOCX files with verified output.
---

Use document_read before revising an existing file. Use document_create for new files. document_revise creates a new verified version and does not promise lossless preservation of arbitrary third-party formatting.
```

- [ ] **Step 6: Run tests and typecheck**

Run: `bun test && bun typecheck` from `packages/plugin-documents`.
Expected: PASS with a real DOCX reopened through `markit-ai`.

- [ ] **Step 7: Commit**

```bash
git add packages/plugin-documents package.json bun.lock
git commit -m "feat(plugin): add documents capability"
```

### Task 3: PDF Plugin Tools, Font Asset, and Skill

**Files:**
- Create: `packages/plugin-pdf/package.json`
- Create: `packages/plugin-pdf/tsconfig.json`
- Create: `packages/plugin-pdf/src/read.ts`
- Create: `packages/plugin-pdf/src/layout.ts`
- Create: `packages/plugin-pdf/src/server.ts`
- Create: `packages/plugin-pdf/src/index.ts`
- Create: `packages/plugin-pdf/assets/NotoSansCJKsc-Regular.otf`
- Create: `packages/plugin-pdf/assets/OFL.txt`
- Create: `packages/plugin-pdf/skills/pdf/SKILL.md`
- Test: `packages/plugin-pdf/test/pdf.test.ts`

**Interfaces:**
- Produces tools: `pdf_read`, `pdf_create`, `pdf_merge`, `pdf_split`.
- Produces: `PdfPlugin`, `PdfManifest`, `PdfRoot`, manifest ID `pdf`.

- [ ] **Step 1: Add the licensed font asset**

Download `NotoSansCJKsc-Regular.otf` from `https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf` and the matching OFL license. Verify both files are included in the package `files` list.

- [ ] **Step 2: Write failing real PDF tests**

```ts
const result = await tools.pdf_create.execute({ title: "中文报告", content: "第一页内容" }, ctx)
const bytes = await Bun.file(fileURLToPath(result.attachments![0].url)).arrayBuffer()
expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
expect(normalizeExtractedText(await readPdfText(fileURLToPath(result.attachments![0].url)))).toContain("第一页内容")
```

- [ ] **Step 3: Run tests and verify failure**

Run: `bun test` from `packages/plugin-pdf`.
Expected: FAIL because the PDF package does not exist.

- [ ] **Step 4: Implement layout and creation**

Use this package contract:

```json
{
  "name": "@necode-ai/plugin-pdf", "private": true, "type": "module",
  "scripts": { "test": "bun test", "typecheck": "tsgo --noEmit" },
  "exports": { ".": "./src/index.ts", "./server": "./src/server.ts" },
  "files": ["src", "skills", "assets"],
  "necode": { "plugin": { "id": "pdf", "name": "PDF", "description": "读取、生成、合并和拆分 PDF", "skills": ["./skills/"] } },
  "dependencies": { "@opencode-ai/plugin": "workspace:*", "@necode-ai/plugin-artifacts": "workspace:*", "pdf-lib": "1.17.1", "@pdf-lib/fontkit": "1.1.1", "markit-ai": "0.5.3" },
  "devDependencies": { "@tsconfig/node22": "catalog:", "@types/node": "catalog:", "@typescript/native-preview": "catalog:" }
}
```

```ts
const PAGE = { width: 595.28, height: 841.89, margin: 56, fontSize: 11, lineHeight: 16 } as const

export async function createPdf(input: CreateInput) {
  const { PDFDocument } = await import("pdf-lib")
  const fontkit = await import("@pdf-lib/fontkit")
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit.default)
  const font = await doc.embedFont(await Bun.file(FONT_FILE).arrayBuffer())
  return renderPages(doc, font, input)
}
```

Layout wraps text by measured width, starts a new page before crossing the bottom margin, and uses named page constants.

Export `PdfRoot = fileURLToPath(new URL("..", import.meta.url))` with `PdfManifest` and `PdfPlugin`.

- [ ] **Step 5: Implement read, merge, split, and verification**

`pdf_read` uses `markit-ai`. Merge copies all pages in input order. Split validates one-based page ranges and returns one attachment per requested range. Generated/merged/split outputs reopen with `PDFDocument.load`; generated text also reopens through `markit-ai`.

- [ ] **Step 6: Add the skill and run verification**

The skill names all four tools and requires explicit output paths only when the user asks. Run `bun test && bun typecheck` from `packages/plugin-pdf`.
Expected: PASS with Chinese text extraction, merge order, split ranges, and corrupted-input errors covered.

- [ ] **Step 7: Commit**

```bash
git add packages/plugin-pdf package.json bun.lock
git commit -m "feat(plugin): add pdf capability"
```

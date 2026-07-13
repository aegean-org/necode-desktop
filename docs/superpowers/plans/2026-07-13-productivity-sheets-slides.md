# Spreadsheets and Presentations Plugins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This project must use one inline agent; do not dispatch subagents.

**Goal:** Deliver verified XLSX and PPTX first-party plugins with structured creation, explicit update semantics, embedded spreadsheet chart images, and plugin skills.

**Architecture:** Spreadsheet tools use ExcelJS workbooks and a small SVG-to-PNG chart renderer. Presentation tools use PptxGenJS for deterministic slide creation and `markit-ai` for content extraction; revision produces a new presentation from complete structured slide input rather than claiming lossless arbitrary editing.

**Tech Stack:** `exceljs@4.4.0`, `sharp@0.33.5`, `pptxgenjs@4.0.1`, `markit-ai@0.5.3`, shared `@necode-ai/plugin-artifacts`.

## Global Constraints

- Execute after `2026-07-13-productivity-documents-pdf.md` Task 1 creates shared artifact helpers.
- Packages are `@necode-ai/plugin-spreadsheets` and `@necode-ai/plugin-presentations`.
- Heavy dependencies load dynamically inside tool execution.
- Spreadsheet charts are embedded PNG images, not native Excel chart objects.
- Presentation revision creates a new verified file and does not promise lossless preservation of arbitrary third-party themes.
- Generated files must reopen successfully before returning attachments.
- Keep source files below 300 lines and functions below 50 lines.

Both packages declare dev dependencies `@tsconfig/node22: catalog:`, `@types/node: catalog:`, and `@typescript/native-preview: catalog:` and use this `tsconfig.json`:

```json
{
  "extends": "@tsconfig/node22/tsconfig.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist", "module": "nodenext", "moduleResolution": "nodenext", "declaration": true, "lib": ["es2022", "dom"] },
  "include": ["src"]
}
```

---

### Task 1: Spreadsheets Plugin Workbook Tools

**Files:**
- Create: `packages/plugin-spreadsheets/package.json`
- Create: `packages/plugin-spreadsheets/tsconfig.json`
- Create: `packages/plugin-spreadsheets/src/schema.ts`
- Create: `packages/plugin-spreadsheets/src/read.ts`
- Create: `packages/plugin-spreadsheets/src/write.ts`
- Create: `packages/plugin-spreadsheets/src/server.ts`
- Create: `packages/plugin-spreadsheets/src/index.ts`
- Test: `packages/plugin-spreadsheets/test/workbook.test.ts`

**Interfaces:**
- Produces tools: `spreadsheet_read`, `spreadsheet_create`, `spreadsheet_update`.
- Produces: `SpreadsheetsPlugin`, `SpreadsheetsManifest`, `SpreadsheetsRoot`, manifest ID `spreadsheets`.

- [ ] **Step 1: Write failing real XLSX tests**

```ts
const result = await tools.spreadsheet_create.execute({
  filename: "销售.xlsx",
  sheets: [{ name: "数据", cells: [{ address: "A1", value: "月份" }, { address: "B2", value: 42 }] }],
}, ctx)
const workbook = new ExcelJS.Workbook()
await workbook.xlsx.readFile(fileURLToPath(result.attachments![0].url))
expect(workbook.getWorksheet("数据")?.getCell("B2").value).toBe(42)
```

- [ ] **Step 2: Run tests and verify failure**

Run: `bun test` from `packages/plugin-spreadsheets`.
Expected: FAIL because the package does not exist.

- [ ] **Step 3: Define explicit workbook input schemas**

Use this package contract:

```json
{
  "name": "@necode-ai/plugin-spreadsheets", "private": true, "type": "module",
  "scripts": { "test": "bun test", "typecheck": "tsgo --noEmit" },
  "exports": { ".": "./src/index.ts", "./server": "./src/server.ts" },
  "files": ["src", "skills"],
  "necode": { "plugin": { "id": "spreadsheets", "name": "Spreadsheets", "description": "创建和分析 Excel 工作簿", "skills": ["./skills/"] } },
  "dependencies": { "@opencode-ai/plugin": "workspace:*", "@necode-ai/plugin-artifacts": "workspace:*", "exceljs": "4.4.0", "sharp": "0.33.5" },
  "devDependencies": { "@tsconfig/node22": "catalog:", "@types/node": "catalog:", "@typescript/native-preview": "catalog:" }
}
```

```ts
const CellInput = tool.schema.object({
  address: tool.schema.string(),
  value: tool.schema.union([tool.schema.string(), tool.schema.number(), tool.schema.boolean()]).optional(),
  formula: tool.schema.string().optional(),
  numberFormat: tool.schema.string().optional(),
})
```

Reject duplicate sheet names, invalid A1 addresses, simultaneous `value` and `formula`, and missing source files with direct errors.

- [ ] **Step 4: Implement read, create, and update**

`spreadsheet_read` returns sheet names, dimensions, formulas, and bounded requested ranges. `spreadsheet_create` creates a new workbook. `spreadsheet_update` opens a source workbook, applies complete cell/style operations, and writes a new output file.

Export `SpreadsheetsRoot = fileURLToPath(new URL("..", import.meta.url))` with `SpreadsheetsManifest` and `SpreadsheetsPlugin`.

- [ ] **Step 5: Reopen and validate**

After writing, reopen with a new `ExcelJS.Workbook`, confirm every requested sheet and cell/formula, then return MIME `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

- [ ] **Step 6: Run tests and typecheck**

Run: `bun test && bun typecheck` from `packages/plugin-spreadsheets`.
Expected: PASS for text, numeric, boolean, formula, formatting, update, corrupted input, and unwritable output cases.

- [ ] **Step 7: Commit**

```bash
git add packages/plugin-spreadsheets package.json bun.lock
git commit -m "feat(plugin): add spreadsheet workbook tools"
```

### Task 2: Spreadsheet Chart Images and Skill

**Files:**
- Create: `packages/plugin-spreadsheets/src/chart.ts`
- Modify: `packages/plugin-spreadsheets/src/schema.ts`
- Modify: `packages/plugin-spreadsheets/src/write.ts`
- Create: `packages/plugin-spreadsheets/skills/spreadsheets/SKILL.md`
- Test: `packages/plugin-spreadsheets/test/chart.test.ts`

**Interfaces:**
- Adds chart inputs to create/update: `bar`, `line`, and `pie`.

- [ ] **Step 1: Write failing chart tests**

```ts
const png = await renderChart({ type: "bar", title: "销量", labels: ["一月", "二月"], values: [3, 5] })
expect(png.subarray(1, 4).toString()).toBe("PNG")
expect(workbook.getImages()).toHaveLength(1)
```

- [ ] **Step 2: Run tests and verify failure**

Run: `bun test test/chart.test.ts` from `packages/plugin-spreadsheets`.
Expected: FAIL because chart rendering is absent.

- [ ] **Step 3: Render deterministic SVG and convert with Sharp**

```ts
export async function renderChart(input: ChartInput) {
  const sharp = (await import("sharp")).default
  return sharp(Buffer.from(chartSvg(input))).png().toBuffer()
}
```

Use named width, height, padding, and palette constants. Escape all labels before inserting them into SVG.

- [ ] **Step 4: Embed and verify chart images**

Add the PNG with `workbook.addImage`, place it using the declared worksheet anchor, reopen the XLSX, and assert `getImages()` contains the expected number of images.

- [ ] **Step 5: Add skill and verify package**

The skill states that charts are embedded images and names the three workbook tools. Run `bun test && bun typecheck` from `packages/plugin-spreadsheets`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-spreadsheets
git commit -m "feat(plugin): add spreadsheet chart output"
```

### Task 3: Presentations Plugin Tools and Skill

**Files:**
- Create: `packages/plugin-presentations/package.json`
- Create: `packages/plugin-presentations/tsconfig.json`
- Create: `packages/plugin-presentations/src/schema.ts`
- Create: `packages/plugin-presentations/src/read.ts`
- Create: `packages/plugin-presentations/src/write.ts`
- Create: `packages/plugin-presentations/src/server.ts`
- Create: `packages/plugin-presentations/src/index.ts`
- Create: `packages/plugin-presentations/skills/presentations/SKILL.md`
- Test: `packages/plugin-presentations/test/presentations.test.ts`

**Interfaces:**
- Produces tools: `presentation_read`, `presentation_create`, `presentation_revise`.
- Produces: `PresentationsPlugin`, `PresentationsManifest`, `PresentationsRoot`, manifest ID `presentations`.

- [ ] **Step 1: Write failing real PPTX tests**

```ts
const result = await tools.presentation_create.execute({
  title: "季度总结",
  slides: [{ title: "第一季度", bullets: ["收入增长", "成本下降"] }],
}, ctx)
const reopened = await readPresentation(fileURLToPath(result.attachments![0].url))
expect(normalizeExtractedText(reopened)).toContain("第一季度 收入增长 成本下降")
```

- [ ] **Step 2: Run tests and verify failure**

Run: `bun test` from `packages/plugin-presentations`.
Expected: FAIL because the package does not exist.

- [ ] **Step 3: Define structured slide inputs**

```ts
const SlideInput = tool.schema.object({
  title: tool.schema.string(),
  subtitle: tool.schema.string().optional(),
  bullets: tool.schema.array(tool.schema.string()).optional(),
  notes: tool.schema.string().optional(),
})
```

Keep layouts explicit: title, title-and-content, section, and blank. Reject empty slide arrays and unsupported layout names.

- [ ] **Step 4: Implement read, create, and revise**

Use this package contract:

```json
{
  "name": "@necode-ai/plugin-presentations", "private": true, "type": "module",
  "scripts": { "test": "bun test", "typecheck": "tsgo --noEmit" },
  "exports": { ".": "./src/index.ts", "./server": "./src/server.ts" },
  "files": ["src", "skills"],
  "necode": { "plugin": { "id": "presentations", "name": "Presentations", "description": "创建和读取 PowerPoint 演示文稿", "skills": ["./skills/"] } },
  "dependencies": { "@opencode-ai/plugin": "workspace:*", "@necode-ai/plugin-artifacts": "workspace:*", "pptxgenjs": "4.0.1", "markit-ai": "0.5.3", "@zip.js/zip.js": "2.7.62" },
  "devDependencies": { "@tsconfig/node22": "catalog:", "@types/node": "catalog:", "@typescript/native-preview": "catalog:" }
}
```

`presentation_read` uses `markit-ai`. Creation dynamically imports PptxGenJS, applies named layout constants, writes a new PPTX, then reopens it. Revision reads the source to prove accessibility and produces a new deck from complete `slides` input.

Export `PresentationsRoot = fileURLToPath(new URL("..", import.meta.url))` with `PresentationsManifest` and `PresentationsPlugin`.

- [ ] **Step 5: Validate package structure and text**

Open the output as ZIP, require `[Content_Types].xml` and `ppt/presentation.xml`, then require extracted text to contain each slide title and non-empty bullet.

- [ ] **Step 6: Add skill and run verification**

The skill explicitly says revision is regeneration, not lossless arbitrary editing. Run `bun test && bun typecheck` from `packages/plugin-presentations`.
Expected: PASS with Chinese titles, multiple slides, revision, invalid input, and corrupted source covered.

- [ ] **Step 7: Commit**

```bash
git add packages/plugin-presentations package.json bun.lock
git commit -m "feat(plugin): add presentations capability"
```

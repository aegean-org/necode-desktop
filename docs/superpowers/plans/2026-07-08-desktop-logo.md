# Desktop Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace desktop and renderer OpenCode logo surfaces with the NeCode mobile logo, including startup loading.

**Architecture:** Keep `packages/desktop/icons/<channel>` as the source of truth for package icons and keep renderer brand marks centralized in `packages/ui/src/components/logo.tsx`. Generate image assets from the iOS NeCode icon instead of hand-editing binary files. Add focused tests that fail against the old OpenCode mark and empty favicon files.

**Tech Stack:** Electron, electron-builder, SolidJS, Bun tests, Python Pillow for one-time image generation.

## Global Constraints

- Do not touch docs, web, console, marketing assets, or unrelated layout/RAG/build logic.
- Update `dev`, `beta`, and `prod` desktop icon folders together.
- Use `D:\project\litter\apps\ios\Sources\Litter\Assets.xcassets\AppIcon.appiconset\Icon-1024.png` as the system icon source.
- Use `D:\project\litter\apps\ios\Sources\Litter\AppIcon.icon\Assets\necode-icon-layer.svg` as the in-app vector mark source.
- Keep failures explicit; do not introduce fallback branding paths.

---

### Task 1: Add Failing Logo And Favicon Tests

**Files:**
- Create: `packages/ui/src/components/logo.test.tsx`
- Modify: `packages/desktop/src/renderer/html.test.ts`

**Interfaces:**
- Consumes: `Mark`, `Splash`, and `Logo` from `packages/ui/src/components/logo.tsx`.
- Produces: tests that require NeCode logo slots and non-empty renderer favicon files.

- [ ] **Step 1: Add the logo render test**

```tsx
import { describe, expect, test } from "bun:test"
import { renderToString } from "solid-js/web"
import { Logo, Mark, Splash } from "./logo"

describe("NeCode logo components", () => {
  test("render the NeCode mark instead of the old OpenCode square", () => {
    const output = [renderToString(() => <Mark />), renderToString(() => <Splash />), renderToString(() => <Logo />)].join("\n")

    expect(output).toContain('data-slot="necode-mark-diagonal"')
    expect(output).toContain("#FF6B4A")
    expect(output).toContain("#FFB86B")
    expect(output).not.toContain('data-slot="logo-logo-mark-o"')
  })
})
```

- [ ] **Step 2: Extend the renderer HTML test**

Add a test to `packages/desktop/src/renderer/html.test.ts` that parses favicon `href` values from `index.html`, resolves them through the configured renderer `publicDir`, and asserts each referenced favicon file exists and has size greater than zero.

- [ ] **Step 3: Verify red**

Run: `bun test src/components/logo.test.tsx` from `packages/ui`.

Expected: fail because the old logo component does not render `data-slot="necode-mark-diagonal"`.

Run: `bun test src/renderer/html.test.ts` from `packages/desktop`.

Expected: fail because `packages/app/public/favicon-96x96-v3.png` and related favicon files are currently empty.

### Task 2: Replace In-App Logo Components

**Files:**
- Modify: `packages/ui/src/components/logo.tsx`

**Interfaces:**
- Consumes: NeCode vector paths from the iOS app icon layer.
- Produces: `Mark`, `Splash`, and `Logo` components with NeCode mark output.

- [ ] **Step 1: Replace old SVG paths**

Use a shared internal `NeCodeMark` helper with `viewBox="0 0 1024 1024"`, background `#080E1C`, orange vertical strokes `#FF6B4A`, and diagonal stroke `#FFB86B`.

- [ ] **Step 2: Verify green for logo test**

Run: `bun test src/components/logo.test.tsx` from `packages/ui`.

Expected: pass.

### Task 3: Generate Desktop And Favicon Image Assets

**Files:**
- Modify binary assets under `packages/desktop/icons/dev`, `packages/desktop/icons/beta`, and `packages/desktop/icons/prod`.
- Modify binary assets under `packages/app/public`.
- Modify text assets under `packages/app/public`: `favicon.svg`, `favicon-v3.svg`, and `site.webmanifest`.

**Interfaces:**
- Consumes: iOS `Icon-1024.png`.
- Produces: non-empty Electron, Windows, macOS, Linux, and renderer favicon assets.

- [ ] **Step 1: Generate assets with Pillow**

Use the bundled runtime Python executable and Pillow to generate:

`icon.png`, `dock.png`, `icon.ico`, `icon.icns`, `32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png`, `StoreLogo.png`, each `Square*Logo.png`, nested `ios/AppIcon-*`, nested `android/mipmap-*/ic_launcher*.png`, `favicon-96x96*.png`, `apple-touch-icon*.png`, `web-app-manifest-*.png`, and `favicon*.ico`.

- [ ] **Step 2: Populate SVG and manifest assets**

Set `favicon.svg` and `favicon-v3.svg` to a compact NeCode SVG using the same N paths. Set `site.webmanifest` to reference `/web-app-manifest-192x192.png` and `/web-app-manifest-512x512.png`.

- [ ] **Step 3: Verify green for renderer favicon test**

Run: `bun test src/renderer/html.test.ts` from `packages/desktop`.

Expected: pass.

### Task 4: Full Verification

**Files:**
- No additional source files.

**Interfaces:**
- Consumes: changed assets and logo components.
- Produces: verified build/package output.

- [ ] **Step 1: Run package checks**

Run from `packages/ui`: `bun typecheck`.

Run from `packages/app`: `bun typecheck`.

Run from `packages/desktop`: `bun typecheck`.

- [ ] **Step 2: Run focused tests**

Run from `packages/ui`: `bun test src/components/logo.test.tsx`.

Run from `packages/desktop`: `bun test src/renderer/html.test.ts package-scripts.test.ts electron-builder.config.test.ts`.

- [ ] **Step 3: Build and package**

Run from `packages/desktop`: `bun run build`.

Run from `packages/desktop`: `bun run package:win:dir`.

- [ ] **Step 4: Inspect packaged output**

Confirm `packages/desktop/dist/win-unpacked/resources/icons/icon.ico` exists and is non-empty. Confirm renderer favicon files in `packages/desktop/dist/win-unpacked/resources/app.asar` or unpacked renderer output are non-empty.


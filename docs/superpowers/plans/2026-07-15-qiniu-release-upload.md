# NeCode Desktop Qiniu Release Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload the exact NeCode Desktop GitHub Release assets to Qiniu under `downloads/` and refresh their CDN URLs.

**Architecture:** Add one repository-owned Python entrypoint that validates environment configuration, uploads every regular file under a supplied directory through the official Qiniu SDK, and refreshes the resulting CDN URLs. Invoke it from the existing `publish-release` job only after `gh release upload` succeeds.

**Tech Stack:** Python 3, Qiniu Python SDK, GitHub Actions, Bun tests.

## Global Constraints

- Do not modify Windows signing behavior.
- Read `QINIU_ACCESS_KEY` and `QINIU_SECRET_KEY` only from GitHub Actions Secrets.
- Read `QINIU_BUCKET`, `QINIU_PREFIX`, and `QINIU_CDN_BASE` from GitHub Actions Variables.
- Upload objects as `<QINIU_PREFIX>/<relative file path>`; current prefix is exactly `downloads`.
- Any missing configuration, missing upload file, upload failure, or CDN refresh failure must terminate with a non-zero status.
- Never write real Qiniu credentials into the repository or workflow logs.

---

### Task 1: Lock the workflow contract with a failing test

**Files:**
- Modify: `packages/desktop/desktop-package-workflow.test.ts`

**Interfaces:**
- Consumes: the text of `.github/workflows/desktop-package.yml`
- Produces: assertions for Python setup, Qiniu dependency installation, secret/variable injection, and `release-assets` upload invocation

- [x] **Step 1: Add the failing workflow assertions**

Add these required strings to the existing desktop workflow test:

```ts
expectIncludes(text, [
  "actions/setup-python",
  'python-version: "3.12"',
  "pip install qiniu==7.17.0",
  "Upload release assets to Qiniu",
  "QINIU_ACCESS_KEY: ${{ secrets.QINIU_ACCESS_KEY }}",
  "QINIU_SECRET_KEY: ${{ secrets.QINIU_SECRET_KEY }}",
  "QINIU_BUCKET: ${{ vars.QINIU_BUCKET }}",
  "QINIU_PREFIX: ${{ vars.QINIU_PREFIX }}",
  "QINIU_CDN_BASE: ${{ vars.QINIU_CDN_BASE }}",
  "python script/upload-qiniu.py release-assets",
])
```

- [x] **Step 2: Run the focused test and verify failure**

Run from `packages/desktop`:

```bash
bun test desktop-package-workflow.test.ts
```

Expected: FAIL because the workflow does not yet contain the Qiniu setup and upload step.

### Task 2: Implement the Qiniu uploader

**Files:**
- Create: `script/upload-qiniu.py`

**Interfaces:**
- Consumes: one positional directory argument and environment variables `QINIU_ACCESS_KEY`, `QINIU_SECRET_KEY`, `QINIU_BUCKET`, `QINIU_PREFIX`, `QINIU_CDN_BASE`
- Produces: Qiniu objects and a CDN refresh request; exits zero only after both operations succeed

- [x] **Step 1: Implement configuration and input validation**

Create a Python script that uses `argparse`, requires every named environment variable through direct indexed access, rejects a non-directory input, recursively selects regular files, and rejects an empty directory. Normalize `QINIU_PREFIX` to exclude leading/trailing slashes and require it to remain non-empty. Normalize `QINIU_CDN_BASE` to end with `/`.

- [x] **Step 2: Implement upload and CDN refresh**

Import `Auth`, `CdnManager`, and `put_file` from `qiniu` after validation. For each sorted file, construct the object key with POSIX separators, call `put_file`, and require `info.status_code == 200`. Collect URL-encoded CDN URLs using `urllib.parse.quote(relative_path.as_posix())` with `/` preserved. Call `CdnManager(Auth(...)).refresh_urls(urls)` once and require a 200 response. Raise `RuntimeError` containing the object key or refresh error when an operation fails.

- [x] **Step 3: Verify Python syntax and explicit validation failure**

Run:

```powershell
python -m py_compile script/upload-qiniu.py
python script/upload-qiniu.py missing-directory
```

Expected: compilation succeeds; execution exits non-zero with a clear missing configuration or directory error and never reports success.

### Task 3: Integrate uploading after GitHub Release publication

**Files:**
- Modify: `.github/workflows/desktop-package.yml`

**Interfaces:**
- Consumes: `release-assets` populated by `actions/download-artifact`
- Produces: objects under the configured Qiniu `downloads/` prefix after GitHub Release upload succeeds

- [x] **Step 1: Add Python setup before publication commands**

In `publish-release`, add `actions/setup-python` pinned by commit with Python `3.12`, then install exactly `qiniu==7.17.0`.

- [x] **Step 2: Add the Qiniu upload step after `gh release upload`**

Add a shell step named `Upload release assets to Qiniu` immediately after the GitHub Release step. Inject the two secrets and three variables without echoing them, then run:

```bash
python script/upload-qiniu.py release-assets
```

- [x] **Step 3: Run the focused workflow test**

Run from `packages/desktop`:

```bash
bun test desktop-package-workflow.test.ts
```

Expected: PASS.

### Task 4: Final focused verification

**Files:**
- Verify: `script/upload-qiniu.py`
- Verify: `.github/workflows/desktop-package.yml`
- Verify: `packages/desktop/desktop-package-workflow.test.ts`

**Interfaces:**
- Consumes: completed implementation
- Produces: evidence that syntax, workflow contract, and repository hygiene pass

- [x] **Step 1: Run all focused checks**

```powershell
python -m py_compile script/upload-qiniu.py
bun test desktop-package-workflow.test.ts
git diff --check
```

Run the Bun test from `packages/desktop`; run the other commands from the repository root. Expected: all commands exit zero.

- [x] **Step 2: Inspect the final diff for credentials and scope**

Run:

```powershell
git diff -- .github/workflows/desktop-package.yml script/upload-qiniu.py packages/desktop/desktop-package-workflow.test.ts
git status --short
```

Expected: only the uploader, workflow integration, test update, and plan documentation are changed; no credential values are present.

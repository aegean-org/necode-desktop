# Skill Hot Reload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make newly added local skills available to the runtime, settings page, and slash commands from the next user message without restarting NeCode.

**Architecture:** Treat local skill directories as live sources and rescan them at runtime access boundaries while retaining caching for remote URL sources. The legacy registry refreshes its instance-scoped discovery before reads, and legacy commands merge the current skill list instead of freezing skills during command initialization. The settings page refetches its runtime list when mounted, and the built-in customization guidance requires post-install registration verification before reporting success.

**Tech Stack:** TypeScript, Effect, Bun test, Solid Query.

## Global Constraints

- Keep changes limited to skill discovery, skill-backed commands, settings refresh, and installation guidance.
- Preserve existing V1 and V2 session behavior and permission filtering.
- Run tests from package directories, never from the repository root.

---

### Task 1: Refresh V2 local skill sources

**Files:**

- Modify: `packages/core/test/skill.test.ts`
- Modify: `packages/core/src/skill.ts`

**Interfaces:**

- Consumes: existing `SkillV2.Service.list()` and registered `DirectorySource` values.
- Produces: `SkillV2.Service.list()` that observes additions, edits, and removals in directory sources on every call while URL sources remain cached.

- [ ] Add a regression test that lists an empty directory source, writes `SKILL.md`, then lists again and expects the new skill.
- [ ] Run `bun test test/skill.test.ts` from `packages/core` and confirm the new test fails because the directory source is cached.
- [ ] Change `SkillV2.list()` so only URL sources use the cache; directory and embedded sources load directly.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Refresh legacy skills and skill-backed commands

**Files:**

- Modify: `packages/opencode/test/skill/skill.test.ts`
- Modify: `packages/opencode/src/skill/index.ts`
- Modify: `packages/opencode/src/command/index.ts`

**Interfaces:**

- Consumes: `Skill.Service.get`, `require`, `all`, `dirs`, and `available`.
- Produces: legacy skill reads that rescan before returning and command reads that merge current skills without caching stale skill commands.

- [ ] Add a regression test that initializes `Skill.Service`, creates a local skill afterward, and expects the next `all()` call to find it.
- [ ] Run `bun test test/skill/skill.test.ts` from `packages/opencode` and confirm the new test fails with the skill absent.
- [ ] Invalidate the legacy state and discovery instance caches before each public registry read.
- [ ] Remove skill commands from command initialization and merge current skills in `get()` and `list()`, preserving command/MCP precedence.
- [ ] Re-run the focused legacy skill and tool tests.

### Task 3: Refresh settings and make installation reporting truthful

**Files:**

- Modify: `packages/app/src/components/settings-v2/skills.tsx`
- Modify: `packages/app/src/components/settings-v2/plugin-page.test.ts`
- Modify: `packages/core/src/plugin/skill/customize-necode.md`
- Modify: `packages/opencode/test/skill/skill.test.ts`

**Interfaces:**

- Consumes: settings runtime query and the built-in `customize-necode` content.
- Produces: settings remount refetch and guidance that distinguishes file writes from verified runtime registration.

- [ ] Add assertions that the settings Skill query always refetches on mount and that built-in guidance no longer requires restart for skill-only file changes.
- [ ] Run the focused app and legacy skill tests and confirm the assertions fail.
- [ ] Set `refetchOnMount: "always"` for the runtime Skill query.
- [ ] Update the built-in guidance to verify the installed skill through the runtime registry and report success only after verification; tell users it is available from the next message.
- [ ] Re-run focused tests.

### Task 4: Verification

**Files:**

- Verify only.

**Interfaces:**

- Consumes: all changes from Tasks 1-3.
- Produces: fresh evidence for runtime behavior and type safety.

- [ ] Run focused core Skill tests from `packages/core`.
- [ ] Run focused legacy Skill and Skill tool tests from `packages/opencode`.
- [ ] Run focused settings tests and `bun typecheck` from `packages/app`.
- [ ] Run `bun typecheck` from `packages/core` and `packages/opencode` if those packages expose the script.
- [ ] Review `git diff --check` and the scoped diff for unrelated changes.

#!/usr/bin/env bun
import { $ } from "bun"

import { resolveChannel } from "./utils"
import { verifyProductivityRuntime } from "./productivity-runtime"

const channel = resolveChannel()
await $`bun ./scripts/build-productivity-runtime.ts`
verifyProductivityRuntime()
await $`bun ./scripts/copy-icons.ts ${channel}`
await $`bun ./scripts/copy-metainfo.ts ${channel}`

await $`cd ../opencode && bun script/build-node.ts`

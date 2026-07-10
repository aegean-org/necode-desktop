import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260710042031_add_session_pinned",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`session\` ADD \`time_pinned\` integer;`)
    })
  },
} satisfies DatabaseMigration.Migration

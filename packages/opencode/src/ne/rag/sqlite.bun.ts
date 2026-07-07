import { Database } from "bun:sqlite"
import type { NeRagSqliteDatabase, NeRagSqliteStatement } from "./sqlite-types"

export function openNeRagSqlite(dbPath: string): NeRagSqliteDatabase {
  const db = new Database(dbPath)
  return {
    prepare: (sql) => db.prepare(sql) as unknown as NeRagSqliteStatement,
    exec: (sql) => db.exec(sql),
    transaction: (task) => db.transaction(task)(),
    close: () => db.close(),
  }
}

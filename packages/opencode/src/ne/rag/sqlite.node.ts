import { DatabaseSync, type SQLInputValue } from "node:sqlite"
import type { NeRagSqliteDatabase, NeRagSqliteStatement } from "./sqlite-types"

const TX_BEGIN = "BEGIN IMMEDIATE"
const TX_COMMIT = "COMMIT"
const TX_ROLLBACK = "ROLLBACK"

export function openNeRagSqlite(dbPath: string): NeRagSqliteDatabase {
  const db = new DatabaseSync(dbPath)
  return {
    prepare: (sql) => adaptStatement(db.prepare(sql)),
    exec: (sql) => db.exec(sql),
    transaction: (task) => runTransaction(db, task),
    close: () => db.close(),
  }
}

function adaptStatement(statement: ReturnType<DatabaseSync["prepare"]>): NeRagSqliteStatement {
  return {
    get: (...params) => statement.get(...toSqlInputValues(params)),
    all: (...params) => statement.all(...toSqlInputValues(params)),
    run: (...params) => statement.run(...toSqlInputValues(params)),
    finalize: () => undefined,
  }
}

function runTransaction<T>(db: DatabaseSync, task: () => T) {
  db.exec(TX_BEGIN)
  try {
    const result = task()
    db.exec(TX_COMMIT)
    return result
  } catch (error) {
    db.exec(TX_ROLLBACK)
    throw error
  }
}

function toSqlInputValues(params: readonly unknown[]) {
  return params as SQLInputValue[]
}

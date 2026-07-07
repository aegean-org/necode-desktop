export interface NeRagSqliteStatement {
  readonly get: (...params: unknown[]) => unknown
  readonly all: (...params: unknown[]) => unknown[]
  readonly run: (...params: unknown[]) => unknown
  readonly finalize: () => void
}

export interface NeRagSqliteDatabase {
  readonly prepare: (sql: string) => NeRagSqliteStatement
  readonly exec: (sql: string) => void
  readonly transaction: <T>(task: () => T) => T
  readonly close: () => void
}

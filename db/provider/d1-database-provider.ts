import {
  assertSafeStatement,
  type DatabaseExecutionResult,
  type DatabaseProvider,
  type DatabaseStatement,
} from "./database-provider.ts";

export class D1DatabaseProvider implements DatabaseProvider {
  readonly kind = "d1" as const;
  private readonly database: D1Database;

  constructor(database: D1Database) {
    this.database = database;
  }

  async query<Row extends Record<string, unknown>>(
    statement: DatabaseStatement,
  ) {
    assertSafeStatement(statement);
    const result = await bind(this.database, statement).all<Row>();
    const rows = result.results ?? [];
    return {
      rows,
      rowCount: rows.length,
      metadata: { provider: this.kind },
    };
  }

  async queryOne<Row extends Record<string, unknown>>(
    statement: DatabaseStatement,
  ) {
    assertSafeStatement(statement);
    return (await bind(this.database, statement).first<Row>()) ?? null;
  }

  async execute(
    statement: DatabaseStatement,
  ): Promise<DatabaseExecutionResult> {
    assertSafeStatement(statement);
    const result = await bind(this.database, statement).run();
    return {
      affectedRows: Number(result.meta.changes ?? 0),
      returnedRows: [],
      metadata: { provider: this.kind },
    };
  }

  async transaction(statements: readonly DatabaseStatement[]) {
    for (const statement of statements) assertSafeStatement(statement);
    if (statements.length === 0) return [];
    const results = await this.database.batch(
      statements.map((statement) => bind(this.database, statement)),
    );
    return results.map((result) => ({
      affectedRows: Number(result.meta.changes ?? 0),
      returnedRows: [],
      metadata: { provider: this.kind },
    }));
  }

  async healthCheck() {
    const row = await this.queryOne<{ ok: number }>({
      sql: "SELECT 1 AS ok",
    });
    return row?.ok === 1;
  }
}

function bind(database: D1Database, statement: DatabaseStatement) {
  const prepared = database.prepare(statement.sql);
  return statement.parameters?.length
    ? prepared.bind(...statement.parameters)
    : prepared;
}

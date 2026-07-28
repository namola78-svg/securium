import type {
  DatabaseExecutionResult,
  DatabaseProvider,
  DatabaseQueryResult,
  DatabaseStatement,
} from "../provider/database-provider.ts";
import { RepositorySqlDialect } from "./sql-dialect.ts";

export type RepositoryTransaction = {
  execute(statement: DatabaseStatement): void;
};

export class RepositoryContext {
  readonly provider: DatabaseProvider;
  readonly dialect: RepositorySqlDialect;
  readonly requestId?: string;

  constructor(provider: DatabaseProvider, requestId?: string) {
    this.provider = provider;
    this.dialect = new RepositorySqlDialect(provider.kind);
    this.requestId = requestId;
  }

  query<Row extends Record<string, unknown>>(statement: DatabaseStatement) {
    return this.provider.query<Row>(statement);
  }

  queryOne<Row extends Record<string, unknown>>(statement: DatabaseStatement) {
    return this.provider.queryOne<Row>(statement);
  }

  execute(statement: DatabaseStatement) {
    return this.provider.execute(statement);
  }

  async transaction<T>(
    callback: (transaction: RepositoryTransaction) => T | Promise<T>,
  ): Promise<{ value: T; results: DatabaseExecutionResult[] }> {
    const statements: DatabaseStatement[] = [];
    const value = await callback({
      execute(statement) {
        statements.push(statement);
      },
    });
    const results = await this.provider.transaction(statements);
    return { value, results };
  }

  async paginate<Row extends Record<string, unknown>>(input: {
    data: DatabaseStatement;
    count: DatabaseStatement;
    page: number;
    pageSize: number;
  }): Promise<{
    result: DatabaseQueryResult<Row>;
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  }> {
    const [result, countRow] = await Promise.all([
      this.query<Row>(input.data),
      this.queryOne<{ total: number | string }>(input.count),
    ]);
    const total = Number(countRow?.total ?? 0);
    return {
      result,
      total,
      page: input.page,
      pageSize: input.pageSize,
      hasMore: input.page * input.pageSize < total,
    };
  }
}

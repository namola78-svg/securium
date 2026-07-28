import { AppError } from "../../lib/errors.ts";
import {
  createPostgreSqlConnectionPlan,
  type PostgreSqlConnectionEnvironment,
  type PostgreSqlConnectionPlan,
} from "./connection-config.ts";
import {
  normalizeDatabaseError,
  type DatabaseProviderError,
} from "../provider/database-error.ts";
import type { DatabaseValue } from "../provider/database-provider.ts";
import type {
  PostgresExecutor,
  PostgresQueryResult,
  PostgresTransactionExecutor,
} from "../provider/postgres-database-provider.ts";

type PostgresJsResult<Row extends Record<string, unknown>> = Row[] & {
  count?: number | null;
};

type PostgresJsPendingQuery<Row extends Record<string, unknown>> =
  PromiseLike<PostgresJsResult<Row>> & {
    cancel?: () => void;
  };

export type PostgresJsClient = {
  unsafe<Row extends Record<string, unknown>>(
    sql: string,
    parameters: readonly DatabaseValue[],
  ): PostgresJsPendingQuery<Row>;
  begin<T>(callback: (client: PostgresJsClient) => Promise<T>): Promise<T>;
  end(options?: { timeout?: number }): Promise<void>;
};

export type PostgresJsFactory = (
  connectionString: string,
  options: {
    max: number;
    idle_timeout: number;
    connect_timeout: number;
    prepare: false;
    ssl: false | true | "require";
    onnotice: false;
    debug: false;
    connection: {
      application_name: string;
    };
  },
) => PostgresJsClient;

export type PostgresJsModuleLoader = () => Promise<{
  default: PostgresJsFactory;
}>;

export class PostgresJsExecutor implements PostgresExecutor {
  private readonly client: PostgresJsClient;
  private readonly queryTimeoutMs: number;

  constructor(client: PostgresJsClient, queryTimeoutMs: number) {
    this.client = client;
    this.queryTimeoutMs = queryTimeoutMs;
  }

  async query<Row extends Record<string, unknown>>(
    sql: string,
    parameters: readonly DatabaseValue[],
  ): Promise<PostgresQueryResult<Row>> {
    return this.queryWithClient<Row>(this.client, sql, parameters);
  }

  async queryOne<Row extends Record<string, unknown>>(
    sql: string,
    parameters: readonly DatabaseValue[],
  ) {
    const result = await this.query<Row>(sql, parameters);
    return result.rows[0] ?? null;
  }

  async execute(
    sql: string,
    parameters: readonly DatabaseValue[],
  ): Promise<PostgresQueryResult<Record<string, unknown>>> {
    return this.query<Record<string, unknown>>(sql, parameters);
  }

  async transaction<T>(
    callback: (executor: PostgresTransactionExecutor) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.client.begin(async (transactionClient) =>
        callback({
          query: <Row extends Record<string, unknown>>(
            sql: string,
            parameters: readonly DatabaseValue[],
          ) => this.queryWithClient<Row>(transactionClient, sql, parameters),
        }),
      );
    } catch (error) {
      throw normalizeDatabaseError(error, "transaction");
    }
  }

  async healthCheck() {
    try {
      const result = await this.query<{ ok: number }>("SELECT 1 AS ok", []);
      return result.rows[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  async close() {
    try {
      await this.client.end({ timeout: 5 });
    } catch (error) {
      throw normalizeDatabaseError(error, "connection");
    }
  }

  private async queryWithClient<Row extends Record<string, unknown>>(
    client: PostgresJsClient,
    sql: string,
    parameters: readonly DatabaseValue[],
  ): Promise<PostgresQueryResult<Row>> {
    try {
      const pending = client.unsafe<Row>(sql, parameters);
      const rows = await withQueryTimeout(pending, this.queryTimeoutMs);
      return {
        rows: Array.from(rows),
        rowCount:
          typeof rows.count === "number" ? rows.count : rows.length,
      };
    } catch (error) {
      throw normalizeDatabaseError(error, "query");
    }
  }
}

let runtimeExecutorPromise: Promise<PostgresJsExecutor> | undefined;

export async function getRuntimePostgresExecutor(
  environment: PostgreSqlConnectionEnvironment,
  loader: PostgresJsModuleLoader = loadPostgresJs,
) {
  runtimeExecutorPromise ??= createPostgresJsExecutor(environment, loader).catch(
    (error) => {
      runtimeExecutorPromise = undefined;
      throw error;
    },
  );
  return runtimeExecutorPromise;
}

export async function createPostgresJsExecutor(
  environment: PostgreSqlConnectionEnvironment,
  loader: PostgresJsModuleLoader = loadPostgresJs,
) {
  const plan = createPostgreSqlConnectionPlan(environment, "RUNTIME");
  let factory: PostgresJsFactory;
  try {
    factory = (await loader()).default;
  } catch {
    throw new AppError(
      "The server PostgreSQL driver is unavailable.",
      500,
      "POSTGRES_DRIVER_UNAVAILABLE",
    );
  }
  const client = factory(plan.url, postgresJsOptions(plan));
  return new PostgresJsExecutor(client, plan.queryTimeoutMs);
}

export async function disconnectRuntimePostgresExecutor() {
  const executorPromise = runtimeExecutorPromise;
  runtimeExecutorPromise = undefined;
  if (executorPromise) await (await executorPromise).close();
}

function postgresJsOptions(plan: PostgreSqlConnectionPlan) {
  return {
    max: plan.maxConnectionsPerInstance,
    idle_timeout: plan.idleTimeoutSeconds,
    connect_timeout: plan.connectTimeoutSeconds,
    prepare: false as const,
    ssl:
      plan.sslMode === "disable"
        ? (false as const)
        : plan.sslMode === "verify-full"
          ? (true as const)
          : ("require" as const),
    // NOTICE and debug callbacks are disabled so driver details, SQL text, and
    // parameters are not accidentally written to application logs.
    onnotice: false as const,
    debug: false as const,
    connection: {
      application_name: "integrated-learning-platform",
    },
  };
}

async function loadPostgresJs() {
  // The package is loaded only when DB_PROVIDER=supabase is selected. A literal
  // dynamic import lets the server build include and validate the driver while
  // preserving D1's no-connection-at-import behavior.
  return (await import("postgres")) as unknown as {
    default: PostgresJsFactory;
  };
}

function withQueryTimeout<Row extends Record<string, unknown>>(
  pending: PostgresJsPendingQuery<Row>,
  timeoutMs: number,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      pending.cancel?.();
      reject({ code: "57014" });
    }, timeoutMs);
  });
  return Promise.race([Promise.resolve(pending), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export type { DatabaseProviderError };

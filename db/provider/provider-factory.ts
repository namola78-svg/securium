import { AppError } from "../../lib/errors.ts";
import { validatePostgreSqlEnvironment } from "../postgres/connection-config.ts";
import {
  getRuntimePostgresExecutor,
  type PostgresJsModuleLoader,
} from "../postgres/postgres-js-executor.ts";
import { D1DatabaseProvider } from "./d1-database-provider.ts";
import type { DatabaseProvider } from "./database-provider.ts";
import {
  PostgresDatabaseProvider,
  type PostgresExecutor,
} from "./postgres-database-provider.ts";

export type DatabaseProviderEnvironment = {
  APP_ENV?: string;
  DB_PROVIDER?: string;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  POSTGRES_MAX_CONNECTIONS?: string;
  POSTGRES_IDLE_TIMEOUT_SECONDS?: string;
  POSTGRES_CONNECT_TIMEOUT_SECONDS?: string;
  POSTGRES_QUERY_TIMEOUT_MS?: string;
  POSTGRES_SSL_MODE?: string;
};

export function resolveDatabaseProviderName(
  environment: DatabaseProviderEnvironment,
) {
  const name = environment.DB_PROVIDER?.trim().toLowerCase() || "d1";
  if (name !== "d1" && name !== "supabase") {
    throw configurationError("DB_PROVIDER must be d1 or supabase.");
  }
  return name;
}

export function createDatabaseProvider(
  environment: DatabaseProviderEnvironment,
  dependencies: {
    d1?: D1Database;
    postgres?: PostgresExecutor;
  },
): DatabaseProvider {
  const provider = resolveDatabaseProviderName(environment);
  if (provider === "d1") {
    if (!dependencies.d1) {
      throw configurationError("The Cloudflare D1 DB binding is unavailable.");
    }
    return new D1DatabaseProvider(dependencies.d1);
  }

  validatePostgreSqlEnvironment(environment);
  if (!environment.DATABASE_URL?.trim()) {
    throw configurationError(
      "DATABASE_URL is required for the Supabase provider.",
    );
  }
  if (!dependencies.postgres) {
    throw configurationError(
      "A server-only PostgreSQL executor must be configured.",
    );
  }
  return new PostgresDatabaseProvider(dependencies.postgres);
}

export async function createRuntimeDatabaseProvider(
  environment: DatabaseProviderEnvironment,
  dependencies: {
    d1?: D1Database;
    postgres?: PostgresExecutor;
    postgresModuleLoader?: PostgresJsModuleLoader;
  } = {},
): Promise<DatabaseProvider> {
  const provider = resolveDatabaseProviderName(environment);
  if (provider === "d1") {
    return createDatabaseProvider(environment, { d1: dependencies.d1 });
  }
  validatePostgreSqlEnvironment(environment);
  if (!environment.DATABASE_URL?.trim()) {
    throw configurationError(
      "DATABASE_URL is required for the Supabase provider.",
    );
  }
  const executor =
    dependencies.postgres ??
    (await getRuntimePostgresExecutor(
      environment,
      dependencies.postgresModuleLoader,
    ));
  return new PostgresDatabaseProvider(executor);
}

function configurationError(message: string) {
  return new AppError(message, 500, "DATABASE_PROVIDER_CONFIGURATION_INVALID");
}

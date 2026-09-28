import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { createCoreRepositories } from "./repository-adapter/core-repositories.ts";
import { RepositoryContext } from "./repository-adapter/repository-context.ts";
import {
  createDatabaseProvider,
  createRuntimeDatabaseProvider,
  resolveDatabaseProviderName,
} from "./provider/provider-factory.ts";
import { DrizzleD1CompatibilityDatabase } from "./provider/drizzle-d1-compatibility.ts";
import { AppError } from "../lib/errors.ts";
import { PostgresRuntimeAuthorityPersistence } from "./runtime-authority-postgres-persistence.ts";
import { getRuntimePostgresExecutor } from "./postgres/postgres-js-executor.ts";

export function getDb() {
  const environment = databaseEnvironment();
  const provider = resolveDatabaseProviderName(environment);
  if (provider === "supabase") {
    return drizzle(
      new DrizzleD1CompatibilityDatabase(() =>
        createRuntimeDatabaseProvider(environment),
      ),
      { schema },
    );
  }
  createDatabaseProvider(environment, { d1: env.DB });
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export async function getDatabaseProvider() {
  const environment = databaseEnvironment();
  return createRuntimeDatabaseProvider(environment, { d1: env.DB });
}

/** Runtime Authority is deliberately unavailable on the D1 compatibility path. */
export async function getRuntimeAuthorityPersistenceOwner() {
  const environment = databaseEnvironment();
  if (resolveDatabaseProviderName(environment) !== "supabase") {
    throw new AppError(
      "Runtime Authority persistence requires the canonical PostgreSQL writer.",
      503,
      "RUNTIME_AUTHORITY_POSTGRES_REQUIRED",
    );
  }
  return new PostgresRuntimeAuthorityPersistence(
    await getRuntimePostgresExecutor(environment),
  );
}

export async function getCoreRepositoryAdapters(requestId?: string) {
  const provider = await getDatabaseProvider();
  return createCoreRepositories(new RepositoryContext(provider, requestId));
}

function databaseEnvironment() {
  return env as unknown as {
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
}

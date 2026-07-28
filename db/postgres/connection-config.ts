import { AppError } from "../../lib/errors.ts";

export type PostgreSqlConnectionPurpose = "RUNTIME" | "MIGRATION";

export type PostgreSqlConnectionEnvironment = {
  APP_ENV?: string;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  POSTGRES_MAX_CONNECTIONS?: string;
  POSTGRES_IDLE_TIMEOUT_SECONDS?: string;
  POSTGRES_CONNECT_TIMEOUT_SECONDS?: string;
  POSTGRES_QUERY_TIMEOUT_MS?: string;
  POSTGRES_SSL_MODE?: string;
};

export type PostgreSqlSslMode = "disable" | "require" | "verify-full";

export type PostgreSqlConnectionPlan = {
  purpose: PostgreSqlConnectionPurpose;
  url: string;
  pooled: boolean;
  maxConnectionsPerInstance: number;
  preparedStatements: boolean;
  idleTimeoutSeconds: number;
  connectTimeoutSeconds: number;
  queryTimeoutMs: number;
  sslMode: PostgreSqlSslMode;
};

/**
 * This module deliberately does not replace db/index.ts. The current application
 * continues to use its D1 Drizzle client until an approved PostgreSQL cutover.
 */
export function createPostgreSqlConnectionPlan(
  environment: PostgreSqlConnectionEnvironment,
  purpose: PostgreSqlConnectionPurpose,
): PostgreSqlConnectionPlan {
  const variableName =
    purpose === "RUNTIME" ? "DATABASE_URL" : "DIRECT_URL";
  const url = environment[variableName]?.trim();
  if (!url) {
    throw configurationError(`${variableName} is required for ${purpose}.`);
  }
  const production = environment.APP_ENV?.trim().toLowerCase() === "production";
  validatePostgreSqlUrl(url, variableName, production);

  return {
    purpose,
    url,
    pooled: purpose === "RUNTIME",
    // A Supabase transaction pooler already owns the global pool. Keep each
    // serverless instance small and disable prepared statements at the adapter.
    maxConnectionsPerInstance:
      purpose === "RUNTIME"
        ? parseInteger(
            environment.POSTGRES_MAX_CONNECTIONS,
            "POSTGRES_MAX_CONNECTIONS",
            1,
            20,
            1,
          )
        : 1,
    preparedStatements: false,
    idleTimeoutSeconds: parseInteger(
      environment.POSTGRES_IDLE_TIMEOUT_SECONDS,
      "POSTGRES_IDLE_TIMEOUT_SECONDS",
      1,
      600,
      20,
    ),
    connectTimeoutSeconds: parseInteger(
      environment.POSTGRES_CONNECT_TIMEOUT_SECONDS,
      "POSTGRES_CONNECT_TIMEOUT_SECONDS",
      1,
      60,
      10,
    ),
    queryTimeoutMs: parseInteger(
      environment.POSTGRES_QUERY_TIMEOUT_MS,
      "POSTGRES_QUERY_TIMEOUT_MS",
      100,
      120_000,
      10_000,
    ),
    sslMode: parseSslMode(environment.POSTGRES_SSL_MODE, production),
  };
}

export function validatePostgreSqlEnvironment(
  environment: PostgreSqlConnectionEnvironment,
) {
  const databaseUrl = environment.DATABASE_URL?.trim();
  const directUrl = environment.DIRECT_URL?.trim();
  const production = environment.APP_ENV?.trim().toLowerCase() === "production";
  if (databaseUrl) {
    validatePostgreSqlUrl(databaseUrl, "DATABASE_URL", production);
  }
  if (directUrl) validatePostgreSqlUrl(directUrl, "DIRECT_URL", production);
  parseInteger(
    environment.POSTGRES_MAX_CONNECTIONS,
    "POSTGRES_MAX_CONNECTIONS",
    1,
    20,
    1,
  );
  parseInteger(
    environment.POSTGRES_IDLE_TIMEOUT_SECONDS,
    "POSTGRES_IDLE_TIMEOUT_SECONDS",
    1,
    600,
    20,
  );
  parseInteger(
    environment.POSTGRES_CONNECT_TIMEOUT_SECONDS,
    "POSTGRES_CONNECT_TIMEOUT_SECONDS",
    1,
    60,
    10,
  );
  parseInteger(
    environment.POSTGRES_QUERY_TIMEOUT_MS,
    "POSTGRES_QUERY_TIMEOUT_MS",
    100,
    120_000,
    10_000,
  );
  parseSslMode(environment.POSTGRES_SSL_MODE, production);
}

function validatePostgreSqlUrl(
  value: string,
  name: string,
  production: boolean,
) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw configurationError(`${name} must be a valid PostgreSQL URL.`);
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw configurationError(`${name} must use postgres:// or postgresql://.`);
  }
  if (!parsed.hostname || !parsed.username || !parsed.pathname.slice(1)) {
    throw configurationError(
      `${name} must contain a host, user, and database name.`,
    );
  }
  if (production && isLocalHost(parsed.hostname)) {
    throw configurationError(
      `${name} must not target a local host in Production.`,
    );
  }
  const password = decodeURIComponent(parsed.password);
  if (!password || isWeakDatabasePassword(password)) {
    throw configurationError(
      `${name} must contain a non-default database password.`,
    );
  }
}

function parseInteger(
  value: string | undefined,
  name: string,
  minimum: number,
  maximum: number,
  defaultValue: number,
) {
  if (!value?.trim()) return defaultValue;
  if (!/^\d+$/.test(value.trim())) {
    throw configurationError(`${name} must be an integer.`);
  }
  const parsed = Number(value);
  if (parsed < minimum || parsed > maximum) {
    throw configurationError(
      `${name} must be between ${minimum} and ${maximum}.`,
    );
  }
  return parsed;
}

function parseSslMode(
  value: string | undefined,
  production: boolean,
): PostgreSqlSslMode {
  const mode = value?.trim().toLowerCase() || "require";
  if (!["disable", "require", "verify-full"].includes(mode)) {
    throw configurationError(
      "POSTGRES_SSL_MODE must be disable, require, or verify-full.",
    );
  }
  if (production && mode === "disable") {
    throw configurationError(
      "POSTGRES_SSL_MODE cannot disable TLS in Production.",
    );
  }
  return mode as PostgreSqlSslMode;
}

function isLocalHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

function isWeakDatabasePassword(password: string) {
  return /^(password|postgres|secret|changeme|change-me|default|test|development|12345678)$/i.test(
    password.trim(),
  );
}

function configurationError(message: string) {
  return new AppError(message, 500, "POSTGRES_CONFIGURATION_INVALID");
}

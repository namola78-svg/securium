import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { checkServerIdentity, rootCertificates } from "node:tls";
import { MigrationGuardError } from "./postgres-migration-error.mjs";

// Credentials and driver options are private; a caller cannot forge or weaken a plan.
const plans = new WeakMap();
const deny = code => { throw new MigrationGuardError(code); };

export function assertMigrationConnectionUrl(value, {
  env = process.env, approvedTargets = [], disposable = null, ca = null,
  now = new Date(),
} = {}) {
  if (typeof value !== "string" || !/^postgres(?:ql)?:\/\//.test(value) || /[\s\\#]/.test(value)) deny("DIRECT_URL_INVALID");
  let url;
  try { url = new URL(value); } catch { deny("DIRECT_URL_INVALID"); }
  const authority = value.slice(value.indexOf("//") + 2).split(/[/?]/)[0];
  const parts = authority.split("@");
  if (parts.length !== 2 || !url.username || !url.password) deny("DIRECT_URL_INVALID");
  const endpoint = parts[1];
  // postgres.js decodes host delimiters before parsing and splitting them.
  if (!endpoint || /[% ,]/.test(endpoint)) deny("MIGRATION_GUARD_ENDPOINT_AMBIGUOUS");
  const match = endpoint.match(/^(localhost|[a-z0-9.-]+|\[::1\])(?::([1-9][0-9]{0,4}))?$/);
  if (!match) deny("MIGRATION_GUARD_ENDPOINT_AMBIGUOUS");
  const rawHost = match[1];
  const port = Number(match[2] ?? 5432);
  if (port > 65535 || url.hostname !== rawHost || (url.port && url.port !== match[2])) deny("DIRECT_URL_INVALID");
  if (port === 6543) deny("MIGRATION_GUARD_TRANSACTION_POOLING_FORBIDDEN");
  const host = rawHost === "[::1]" ? "::1" : rawHost;
  if (!isIP(host) && (host.length > 253 || host.split(".").some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || /^[0-9.]+$/.test(host))) deny("MIGRATION_GUARD_ENDPOINT_AMBIGUOUS");
  if (!/^\/[a-zA-Z_][a-zA-Z0-9_-]*$/.test(url.pathname)) deny("DIRECT_URL_INVALID");
  let user, password;
  try { user = decodeURIComponent(url.username); password = decodeURIComponent(url.password); } catch { deny("DIRECT_URL_INVALID"); }
  if (!/^[a-z_][a-z0-9_.-]*$/.test(user) || !password || /[\x00-\x1f\x7f]/.test(password)) deny("DIRECT_URL_INVALID");
  const database = url.pathname.slice(1);
  const query = [...url.searchParams];
  if (query.length > 1 || query.some(([key, val]) => key !== "sslmode" || !["verify-full", "disable"].includes(val))) deny("MIGRATION_GUARD_URL_OVERRIDE_FORBIDDEN");
  assertCleanEnvironment(env);

  const loopback = ["localhost", "127.0.0.1", "::1"].includes(host);
  if (!loopback && port !== 5432) deny("MIGRATION_GUARD_REMOTE_CUSTOM_PORT_FORBIDDEN");
  let target;
  if (disposable) {
    // This context is constructed by the CLI only after inspecting an owned Docker
    // receipt, container ID, owner label and exact published IPv4 loopback port.
    if (!loopback || host === "::1" || port !== disposable.port || user !== "postgres" || env.POSTGRES_MIGRATION_TARGET || ca) deny("MIGRATION_GUARD_DISPOSABLE_ENDPOINT_MISMATCH");
    if (query.length && query[0][1] !== "disable") deny("MIGRATION_GUARD_TLS_MODE_INVALID");
    target = { provider: "owned-disposable", project: null, id: null, role: "postgres", mode: "owned-loopback-disposable" };
  } else {
    if (loopback) deny("MIGRATION_GUARD_DISPOSABLE_OWNERSHIP_REQUIRED");
    if (query.length && query[0][1] !== "verify-full") deny("MIGRATION_GUARD_TLS_MODE_INVALID");
    if (!Array.isArray(approvedTargets)) deny("MIGRATION_GUARD_TARGET_REGISTRY_INVALID");
    if (typeof env.POSTGRES_MIGRATION_TARGET !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(env.POSTGRES_MIGRATION_TARGET)) deny("MIGRATION_GUARD_TARGET_APPROVAL_REQUIRED");
    const targets = approvedTargets.filter(t => t?.id === env.POSTGRES_MIGRATION_TARGET);
    if (targets.length !== 1) deny("MIGRATION_GUARD_TARGET_APPROVAL_REQUIRED");
    target = targets[0];
    assertApprovedTarget(target, now);
    if (host !== target.host || port !== target.port || database !== target.database || user !== target.user) deny("MIGRATION_GUARD_TARGET_IDENTITY_MISMATCH");
    if (target.caSha256) {
      if (!/^[a-f0-9]{64}$/.test(target.caSha256) || typeof ca !== "string" || createHash("sha256").update(ca).digest("hex") !== target.caSha256) deny("MIGRATION_GUARD_TLS_TRUST_MISMATCH");
    } else if (ca) deny("MIGRATION_GUARD_TLS_TRUST_MISMATCH");
  }
  const effectiveHost = host === "localhost" ? "127.0.0.1" : host;
  const ssl = disposable ? false : Object.freeze({
    rejectUnauthorized: true,
    servername: effectiveHost,
    // Explicit trust prevents ambient NODE_EXTRA_CA_CERTS from extending authority.
    ca: ca ?? rootCertificates,
    checkServerIdentity: (_name, certificate) => checkServerIdentity(effectiveHost, certificate),
  });
  const plan = Object.freeze({
    host: effectiveHost, port, database, user, role: target.role,
    provider: target.provider, project: target.project, targetId: target.id,
    mode: target.mode, tls: disposable ? "DISPOSABLE_PLAINTEXT" : "VERIFY_FULL",
  });
  plans.set(plan, { password, ssl });
  return plan;
}

function assertApprovedTarget(target, now) {
  const validReference = value => {
    if (typeof value !== "string" || /\s/.test(value)) return false;
    try {
      const reference = new URL(value);
      return reference.protocol === "https:" && Boolean(reference.hostname) && !reference.username && !reference.password;
    } catch { return false; }
  };
  const approvedAt = Date.parse(target.approvedAt);
  const expiresAt = Date.parse(target.expiresAt);
  if (typeof target.id !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(target.id) || target.provider !== "supabase" || typeof target.project !== "string" || !/^[a-z]{20}$/.test(target.project) || typeof target.role !== "string" || !/^[a-z_][a-z0-9_]*$/.test(target.role) || target.port !== 5432 || !["direct", "session"].includes(target.mode) || !validReference(target.approvalReference) || !validReference(target.modeEvidence) || !Number.isFinite(approvedAt) || !Number.isFinite(expiresAt) || !(approvedAt <= now.getTime() && now.getTime() < expiresAt)) deny("MIGRATION_GUARD_TARGET_APPROVAL_INVALID");
  if (target.mode === "direct") {
    if (target.host !== `db.${target.project}.supabase.co` || target.user !== target.role) deny("MIGRATION_GUARD_TARGET_APPROVAL_INVALID");
  } else {
    // Pooler host must be copied from provider evidence, never inferred from port.
    if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.pooler\.supabase\.com$/.test(target.host) || target.user !== `${target.role}.${target.project}`) deny("MIGRATION_GUARD_TARGET_APPROVAL_INVALID");
  }
}

function assertCleanEnvironment(env) {
  if (Object.keys(env).some(key => /^PG[A-Z_]/i.test(key) && env[key] !== undefined) || env.NODE_TLS_REJECT_UNAUTHORIZED === "0") deny("MIGRATION_GUARD_INHERITED_CONNECTION_OPTIONS_FORBIDDEN");
}

export function createMigrationClient(postgres, plan) {
  const secrets = plans.get(plan);
  if (!secrets) deny("MIGRATION_GUARD_CONNECTION_PLAN_INVALID");
  // No URL is given to the driver. Arrays also avoid postgres.js's host:port split.
  const sql = postgres({
    host: [plan.host], port: [plan.port], database: plan.database, user: plan.user,
    password: secrets.password, ssl: secrets.ssl,
    max: 1, max_pipeline: 1, idle_timeout: 5, connect_timeout: 10,
    max_lifetime: null, backoff: 0, keep_alive: 30, fetch_types: false,
    prepare: false, debug: false, onnotice: false, sslnegotiation: null,
    publications: "alltables", target_session_attrs: null,
    connection: { application_name: "securium-postgres-migrations", search_path: "public", standard_conforming_strings: "on" },
  });
  const options = sql.options;
  if (options.host?.length !== 1 || options.host[0] !== plan.host || options.port?.length !== 1 || options.port[0] !== plan.port || options.database !== plan.database || options.user !== plan.user || options.path || options.socket || options.ssl !== secrets.ssl || options.target_session_attrs || options.max !== 1 || options.prepare !== false || options.connection?.search_path !== "public" || options.connection?.standard_conforming_strings !== "on" || ["user", "database", "role", "options"].some(key => key in options.connection)) {
    void sql.end({ timeout: 0 }).catch(() => {});
    deny("MIGRATION_GUARD_DRIVER_ENDPOINT_MISMATCH");
  }
  return sql;
}

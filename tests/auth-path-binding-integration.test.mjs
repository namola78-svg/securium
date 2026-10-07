import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { drizzle as drizzleProxy } from "drizzle-orm/sqlite-proxy";

const auth = readFileSync("lib/auth.ts", "utf8");

test("source guard: production wrapper delegates to the composed auth helper", () => {
  const production = auth.slice(auth.indexOf('if (process.env.NODE_ENV === "production")'), auth.indexOf("const identity = await getIdentity()"));
  assert.match(production, /return resolveProductionApplicationAuth\(/);
});

test("source guard: email-only and unresolved production identities use the binding error", () => {
  const helper = readFileSync("lib/services/resolve-production-application-auth.ts", "utf8");
  assert.match(helper, /getChatGPTUser\(\)[\s\S]*AUTH_IDENTITY_BINDING_REQUIRED/);
  assert.match(helper, /if \(!actor\)[\s\S]*AUTH_IDENTITY_BINDING_REQUIRED/);
  assert.match(helper, /resolveProductionApplicationAuth\(\):/);
  assert.doesNotMatch(helper, /database\?:|getVerifiedIdentity:|getDisplayIdentity:/);
});

test("source guard: development email provisioning remains outside production branch", () => {
  assert.match(auth, /process\.env\.NODE_ENV !== "production"/);
  const production = auth.slice(auth.indexOf('if (process.env.NODE_ENV === "production")'), auth.indexOf("const identity = await getIdentity()"));
  assert.doesNotMatch(production, /ensureUser|findUserWithRoleCodesByEmail/);
  assert.match(auth, /findUserWithRoleCodesByEmail\(identity\.email\) \?\? await ensureUser/);
});

test("source guard: Sites tuple construction requires the Supabase provider", () => {
  const source = readFileSync("app/chatgpt-auth.ts", "utf8");
  assert.match(source, /resolveAuthProvider\(\) !== "supabase"\) return null/);
});

test("source guard: repository identity query excludes email and uses exact subject", () => {
  const binding = readFileSync("db/user-auth-identity-binding-repository.ts", "utf8");
  assert.match(binding, /eq\(userAuthIdentityBindings\.authSubject, tuple\.authSubject\)/);
  assert.doesNotMatch(binding, /email|findUserWithRoleCodesByEmail|ensureUser/i);
});

const expectedAuthTuple = {
  authSystem: "securium-application-auth-v1",
  authProvider: "supabase:google",
  authIssuer: "https://project.supabase.co/auth/v1",
  authProjectRef: "project",
  environmentClass: "production",
  authSubject: "subject-production-1",
};

const verifiedIdentity = {
  email: "shared@example.invalid",
  displayName: "Verified Name",
  fullName: "Verified Name",
};

function createAdversarialAuthDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE roles (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE);
    CREATE TABLE user_roles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, role_id TEXT NOT NULL);
    CREATE TABLE user_auth_identity_bindings (
      id TEXT PRIMARY KEY,
      auth_system TEXT NOT NULL,
      auth_provider TEXT NOT NULL,
      auth_issuer TEXT NOT NULL,
      auth_project_ref TEXT NOT NULL,
      environment_class TEXT NOT NULL,
      auth_subject TEXT NOT NULL,
      application_user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      UNIQUE(auth_system, auth_provider, auth_issuer, auth_project_ref, environment_class, auth_subject)
    );
    INSERT INTO users (id, email, display_name, status) VALUES
      ('user-by-subject', 'subject-account@example.invalid', 'Subject User', 'ACTIVE'),
      ('user-by-email', 'shared@example.invalid', 'Email Match User', 'ACTIVE');
    INSERT INTO roles (id, code) VALUES ('role-learner', 'LEARNER'), ('role-admin', 'ADMIN');
    INSERT INTO user_roles (id, user_id, role_id) VALUES
      ('user-role-subject', 'user-by-subject', 'role-learner'),
      ('user-role-email', 'user-by-email', 'role-admin');
    INSERT INTO user_auth_identity_bindings (
      id, auth_system, auth_provider, auth_issuer, auth_project_ref,
      environment_class, auth_subject, application_user_id, status
    ) VALUES (
      'binding-production', 'securium-application-auth-v1', 'supabase:google',
      'https://project.supabase.co/auth/v1', 'project', 'production',
      'subject-production-1', 'user-by-subject', 'ACTIVE'
    );
  `);

  const queries = [];
  const database = drizzleProxy(async (sql, params) => {
    queries.push({ sql, params: [...params] });
    let sqliteSql = sql;
    const selection = /^select (.+?) from /is.exec(sql);
    if (selection) {
      const columns = selection[1].split(", ");
      const aliasedColumns = columns.map((column, index) => `${column} AS "__result_${index}"`);
      sqliteSql = sql.replace(selection[0], `select ${aliasedColumns.join(", ")} from `);
    }
    const statement = sqlite.prepare(sqliteSql);
    if (typeof statement.setReturnArrays === "function") {
      statement.setReturnArrays(true);
      return { rows: statement.all(...params) };
    }
    const rows = statement.all(...params).map((row) => Object.values(row));
    return { rows };
  });
  return { sqlite, database, queries };
}

test("runtime production composition uses module-owned identity and DB providers", async (t) => {
  const { sqlite, database, queries } = createAdversarialAuthDatabase();
  const identityState = {
    applicationIdentity: { identity: verifiedIdentity, authTuple: expectedAuthTuple },
    displayIdentity: verifiedIdentity,
  };
  let databaseProviderCalls = 0;
  const applicationAuthUrl = new URL("../app/chatgpt-auth.ts", import.meta.url).href;
  const databaseModuleUrl = new URL("../db/index.ts", import.meta.url).href;
  assert.equal(import.meta.resolve("../app/chatgpt-auth.ts"), applicationAuthUrl);
  assert.equal(import.meta.resolve("../db/index.ts"), databaseModuleUrl);
  const productionServiceUrl = new URL("../lib/services/resolve-production-application-auth.ts", import.meta.url);
  assert.equal(new URL("../../app/chatgpt-auth.ts", productionServiceUrl).href, applicationAuthUrl);
  for (const repositoryPath of [
    "../db/user-auth-identity-binding-repository.ts",
    "../db/application-user-auth-repository.ts",
  ]) {
    assert.equal(new URL("./index.ts", new URL(repositoryPath, import.meta.url)).href, databaseModuleUrl);
  }

  mock.module(applicationAuthUrl, {
    cache: true,
    namedExports: {
      getChatGPTApplicationIdentity: async () => identityState.applicationIdentity,
      getChatGPTUser: async () => identityState.displayIdentity,
    },
  });
  mock.module(databaseModuleUrl, {
    cache: true,
    namedExports: {
      getDb: () => {
        databaseProviderCalls += 1;
        return database;
      },
    },
  });

  try {
    const { resolveProductionApplicationAuth } = await import("../lib/services/resolve-production-application-auth.ts");
    assert.equal(resolveProductionApplicationAuth.length, 0, "public production API accepts no dependencies");

    await t.test("verified subject selects bound user and roles by resolved ID", async () => {
      assert.deepEqual(identityState.applicationIdentity, {
        identity: verifiedIdentity,
        authTuple: expectedAuthTuple,
      });
      const result = await resolveProductionApplicationAuth({
        getVerifiedIdentity: async () => ({ authTuple: { authSubject: "attacker" } }),
        database: { select: () => { throw new Error("caller database must be ignored"); } },
      });
      assert.deepEqual(result, {
        id: "user-by-subject",
        email: "subject-account@example.invalid",
        displayName: "Subject User",
        roles: ["LEARNER"],
      });
      assert.equal(queries.length, 2);
      assert.ok(queries[0].sql.includes("user_auth_identity_bindings"));
      assert.ok(queries[1].sql.includes("user_roles"));
      for (const dimension of Object.values(expectedAuthTuple)) {
        assert.ok(queries[0].params.includes(dimension), `binding query includes ${dimension}`);
      }
      assert.ok(queries[1].params.includes("user-by-subject"));
      assert.ok(queries[1].sql.includes('"users"."id" = ?'));
      assert.equal(databaseProviderCalls, 2, "both repositories obtain the module-owned database");
    });

    await t.test("unbound same-email subject fails without lookup or provisioning", async () => {
      identityState.applicationIdentity = {
        identity: verifiedIdentity,
        authTuple: { ...expectedAuthTuple, authSubject: "unbound-subject" },
      };
      queries.length = 0;
      const before = {
        users: sqlite.prepare("SELECT count(*) AS count FROM users").get().count,
        bindings: sqlite.prepare("SELECT count(*) AS count FROM user_auth_identity_bindings").get().count,
      };
      await assert.rejects(resolveProductionApplicationAuth(), { code: "AUTH_IDENTITY_BINDING_REQUIRED" });
      const after = {
        users: sqlite.prepare("SELECT count(*) AS count FROM users").get().count,
        bindings: sqlite.prepare("SELECT count(*) AS count FROM user_auth_identity_bindings").get().count,
      };
      assert.deepEqual(after, before);
      assert.equal(queries.length, 1);
      assert.ok(queries[0].params.includes("unbound-subject"));
      assert.ok(!queries[0].sql.includes('"users"."email"'), "binding lookup does not fall back to email");
    });

    await t.test("Sites email-only identity fails closed without repository lookup", async () => {
      identityState.applicationIdentity = null;
      identityState.displayIdentity = {
        email: "shared@example.invalid",
        displayName: "shared@example.invalid",
        fullName: null,
      };
      queries.length = 0;
      await assert.rejects(resolveProductionApplicationAuth(), { code: "AUTH_IDENTITY_BINDING_REQUIRED" });
      assert.equal(queries.length, 0);
    });
  } finally {
    sqlite.close();
  }
});

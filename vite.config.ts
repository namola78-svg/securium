import vinext from "vinext";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";
const LOCAL_D1_TEST_DATABASE_NAME = "shield-academy-local";

const { d1, r2 } = hostingConfig;
const isD1TestMode = process.env.D1_TEST_MODE === "1";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  // Explicit Wrangler vars take precedence over a developer's `.env.local`.
  // Keep this test-only so production configuration remains control-plane owned.
  vars: isD1TestMode ? { DB_PROVIDER: "d1" } : undefined,
  d1_databases: d1
    ? [
        {
          binding: d1,
          // Match wrangler.local.jsonc so db:setup fixtures are visible to
          // the Vinext test worker instead of creating a second empty D1.
          database_name: isD1TestMode
            ? LOCAL_D1_TEST_DATABASE_NAME
            : "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
        // E2E setup uses the same project-local D1 state as Wrangler.
        persistState: isD1TestMode ? { path: ".wrangler/state" } : undefined,
      }),
    ],
  };
});

import { Miniflare } from "miniflare";

const COMPATIBILITY_DATE = "2026-05-15";
const WORKER_SCRIPT = "export default { fetch() { return new Response('ok'); } }";

export function createMiniflareD1Fixture({ databaseId, persistencePath }) {
  return new Miniflare({
    workers: [{
      config: {
        name: "fixture",
        compatibilityDate: COMPATIBILITY_DATE,
        manifest: {
          mainModule: "index.js",
          modules: {
            "index.js": { type: "esm", contents: WORKER_SCRIPT },
          },
        },
        env: { DB: { type: "d1", id: databaseId } },
      },
    }],
    ...(persistencePath ? { resourcePersistencePath: persistencePath } : {}),
  });
}

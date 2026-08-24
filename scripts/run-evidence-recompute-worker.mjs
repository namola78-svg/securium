// E2-A lifecycle foundation entrypoint. Traversal belongs to E2-B and is intentionally absent.
import { randomUUID } from "node:crypto";

export function createEvidenceRecomputeWorkerIdentity() {
  return `evidence-e2-a-worker:${randomUUID()}`;
}

export function assertE2BExecutorNotInstalled(scopeType) {
  if (["USER", "CONCEPT", "FULL"].includes(scopeType)) {
    throw new Error("E2-B traversal executor is not implemented in E2-A");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("E2-A lifecycle foundation only; no traversal executor installed.");
}


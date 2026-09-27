import { fileURLToPath, pathToFileURL } from "node:url";
import { statSync } from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const workerStub = pathToFileURL(
  path.join(repositoryRoot, "tests/support/cloudflare-workers-node-stub.mjs"),
).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return { url: workerStub, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    return resolvePath(path.join(repositoryRoot, specifier.slice(2)));
  }
  if (specifier.startsWith(".")) {
    const parentPath = fileURLToPath(context.parentURL);
    return resolvePath(path.resolve(path.dirname(parentPath), specifier));
  }
  return nextResolve(specifier, context);
}

function resolvePath(candidate) {
  for (const file of [
    candidate,
    `${candidate}.ts`,
    `${candidate}.tsx`,
    `${candidate}.mjs`,
    path.join(candidate, "index.ts"),
  ]) {
    if (isFile(file)) {
      return { url: pathToFileURL(file).href, shortCircuit: true };
    }
  }
  throw new Error(`Node runtime fixture module not found: ${candidate}`);
}

function isFile(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

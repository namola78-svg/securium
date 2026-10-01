import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const nextRoutesPath = path.resolve(".next/types/routes.d.ts");
const nextEnvPath = path.resolve("next-env.d.ts");

export async function snapshotNextGeneratedTypes() {
  let routes;
  let nextEnv;
  try {
    routes = await readFile(nextRoutesPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (!routes?.startsWith("// This file is generated automatically by Next.js")) {
    return undefined;
  }
  try {
    nextEnv = await readFile(nextEnvPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return { routes, nextEnv };
}

export async function restoreNextGeneratedTypes(snapshot) {
  if (!snapshot) return;
  await writeFile(nextRoutesPath, snapshot.routes, "utf8");
  if (snapshot.nextEnv !== undefined) {
    await writeFile(nextEnvPath, snapshot.nextEnv, "utf8");
  }
}

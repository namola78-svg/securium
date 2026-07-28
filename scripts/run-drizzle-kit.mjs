import process from "node:process";

// drizzle-kit's embedded TS loader calls os.userInfo() on Windows. Some
// restricted CI/sandbox environments do not expose that OS API, so provide
// the same stable numeric identity that POSIX environments expose.
if (typeof process.geteuid !== "function") {
  process.geteuid = () => 0;
}

await import("../node_modules/drizzle-kit/bin.cjs");

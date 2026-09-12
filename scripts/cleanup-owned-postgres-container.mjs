import { cleanupOwnedPostgresContainer, readOwnedPostgresReceipt } from "./owned-postgres-container.mjs";

const receiptArgument = process.argv.slice(2).find((argument) => argument.startsWith("--receipt="));
if (!receiptArgument) {
  console.error("OWNED_POSTGRES_CLEANUP_ERROR RECEIPT_REQUIRED");
  process.exitCode = 2;
} else {
  const receiptPath = receiptArgument.slice("--receipt=".length).trim();
  try {
    const record = await readOwnedPostgresReceipt(receiptPath);
    const result = record ? await cleanupOwnedPostgresContainer(record) : "NO_RECEIPT";
    console.log(`OWNED_POSTGRES_CLEANUP ${result}`);
  } catch (error) {
    console.error(`OWNED_POSTGRES_CLEANUP_ERROR ${error?.message || "FAILED"}`);
    process.exitCode = 1;
  }
}

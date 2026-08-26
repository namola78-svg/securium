import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { cs1aGovernanceReceipts } from "./schema.ts";
import { AppError } from "../lib/errors.ts";
import {
  assertCs1aGovernanceReceiptInput,
  computeCs1aReceiptIdentity,
  classifyCs1aReceiptReplay,
} from "../lib/policy/cs1a-receipt.ts";
import type {
  Cs1aGovernanceReceipt,
  Cs1aGovernanceReceiptInput,
  Cs1aReceiptReplayResult,
} from "../lib/policy/cs1a-contract.ts";

type ReceiptDb = ReturnType<(typeof import("."))["getDb"]>;

export type GovernanceReceiptWriteResult = Readonly<{
    outcome: "CREATED" | "IDEMPOTENT_EXISTING";
  receipt: Cs1aGovernanceReceipt;
}> | Cs1aReceiptReplayResult | Readonly<{
  outcome: "VALIDATION_DENIED";
  receipt: null;
}>;

export async function appendGovernanceReceipt(
  input: Cs1aGovernanceReceiptInput,
  db?: ReceiptDb,
): Promise<GovernanceReceiptWriteResult> {
  const database = await resolveDb(db);
  let identity;
  try {
    assertCs1aGovernanceReceiptInput(input);
    identity = computeCs1aReceiptIdentity(input);
  } catch {
    return { outcome: "VALIDATION_DENIED", receipt: null };
  }
  const existing = await findReceiptByIdempotencyKey(identity.idempotencyKey, database);
  if (existing) {
    const replay = classifyCs1aReceiptReplay(existing, identity);
    if (replay.outcome === "IDEMPOTENT_EXISTING") {
      return { outcome: replay.outcome, receipt: await readGovernanceReceipt(replay.receiptId, database) };
    }
    return replay;
  }

  if (input.supersedesReceiptId) {
    const prior = await readGovernanceReceipt(input.supersedesReceiptId, database);
    if (prior.resourceType !== input.resourceType || prior.resourceId !== input.resourceId) {
      throw new AppError("A receipt may supersede only a receipt for the same governed resource.", 409, "CS1A_CROSS_RESOURCE_SUPERSESSION");
    }
  }

  const receipt: Cs1aGovernanceReceipt = {
    ...input,
    receiptId: randomUUID(),
    ...identity,
    createdAt: new Date().toISOString(),
  };

  try {
    await database.insert(cs1aGovernanceReceipts).values(toRow(receipt));
  } catch (error) {
    const raced = await findReceiptByIdempotencyKey(identity.idempotencyKey, database);
    if (!raced) throw error;
    const replay = classifyCs1aReceiptReplay(raced, identity);
    if (replay.outcome === "IDEMPOTENT_EXISTING") {
      return { outcome: replay.outcome, receipt: await readGovernanceReceipt(replay.receiptId, database) };
    }
    return replay;
  }

  return { outcome: "CREATED", receipt: await readGovernanceReceipt(receipt.receiptId, database) };
}

export async function findReceiptByIdempotencyKey(
  idempotencyKey: string,
  db?: ReceiptDb,
): Promise<Pick<Cs1aGovernanceReceipt, "receiptId" | "idempotencyKey" | "semanticDecisionHash"> | null> {
  const database = await resolveDb(db);
  const [row] = await database.select({
    receiptId: cs1aGovernanceReceipts.receiptId,
    idempotencyKey: cs1aGovernanceReceipts.idempotencyKey,
    semanticDecisionHash: cs1aGovernanceReceipts.semanticDecisionHash,
  }).from(cs1aGovernanceReceipts).where(eq(cs1aGovernanceReceipts.idempotencyKey, idempotencyKey)).limit(1);
  return row ?? null;
}

export async function findReceiptBySemanticDecisionHash(
  semanticDecisionHash: string,
  db?: ReceiptDb,
): Promise<Cs1aGovernanceReceipt | null> {
  const database = await resolveDb(db);
  const [row] = await database.select().from(cs1aGovernanceReceipts).where(eq(cs1aGovernanceReceipts.semanticDecisionHash, semanticDecisionHash)).limit(1);
  return row ? fromRow(row) : null;
}

export async function readGovernanceReceipt(
  receiptId: string,
  db?: ReceiptDb,
): Promise<Cs1aGovernanceReceipt> {
  const database = await resolveDb(db);
  const [row] = await database.select().from(cs1aGovernanceReceipts).where(eq(cs1aGovernanceReceipts.receiptId, receiptId)).limit(1);
  if (!row) throw new AppError("The governance receipt was not found.", 404, "CS1A_RECEIPT_NOT_FOUND");
  return fromRow(row);
}

export async function listReceiptSupersessionLineage(
  resourceType: Cs1aGovernanceReceiptInput["resourceType"],
  resourceId: string,
  db?: ReceiptDb,
): Promise<Cs1aGovernanceReceipt[]> {
  const database = await resolveDb(db);
  const rows = await database.select().from(cs1aGovernanceReceipts).where(and(
    eq(cs1aGovernanceReceipts.resourceType, resourceType),
    eq(cs1aGovernanceReceipts.resourceId, resourceId),
  ));
  return rows.map(fromRow);
}

async function resolveDb(db?: ReceiptDb): Promise<ReceiptDb> {
  if (db) return db;
  const dbModule = await import(".");
  return dbModule.getDb();
}

function toRow(receipt: Cs1aGovernanceReceipt) {
  return {
    receiptId: receipt.receiptId,
    resourceType: receipt.resourceType,
    resourceId: receipt.resourceId,
    resourceRevisionId: receipt.resourceRevisionId,
    parentRevisionId: receipt.parentRevisionId ?? null,
    revisionHash: receipt.revisionHash,
    sourceSetHash: receipt.sourceSetHash,
    policyVersion: receipt.policyVersion,
    rightsDisposition: receipt.rightsDisposition,
    currentnessDisposition: receipt.currentnessDisposition,
    contentClass: receipt.contentClass,
    authoringOrigin: receipt.authoringOrigin,
    sourceOrigin: receipt.sourceOrigin,
    publicationAuthority: receipt.publicationAuthority,
    decision: receipt.decision,
    reasonCode: receipt.reasonCode,
    humanDecisionHash: receipt.humanDecisionHash,
    humanDecisionRef: receipt.humanDecisionRef,
    humanDecisionAt: receipt.humanDecisionAt,
    semanticDecisionHash: receipt.semanticDecisionHash,
    idempotencyKey: receipt.idempotencyKey,
    supersedesReceiptId: receipt.supersedesReceiptId ?? null,
    sourceManifestRef: receipt.sourceManifestRef ?? null,
    sourceAuthority: receipt.sourceAuthority ?? null,
    actorAuditLogId: receipt.actorAuditLogId,
    gitSha: receipt.provenance?.gitSha ?? null,
    executionId: receipt.provenance?.executionId ?? null,
    createdAt: receipt.createdAt,
  };
}

function fromRow(row: typeof cs1aGovernanceReceipts.$inferSelect): Cs1aGovernanceReceipt {
  return {
    resourceType: row.resourceType as Cs1aGovernanceReceipt["resourceType"],
    resourceId: row.resourceId,
    resourceRevisionId: row.resourceRevisionId,
    parentRevisionId: row.parentRevisionId,
    supersedesReceiptId: row.supersedesReceiptId,
    sourceSetHash: row.sourceSetHash,
    revisionHash: row.revisionHash,
    policyVersion: row.policyVersion as Cs1aGovernanceReceipt["policyVersion"],
    humanDecisionHash: row.humanDecisionHash,
    humanDecisionRef: row.humanDecisionRef,
    humanDecisionAt: row.humanDecisionAt,
    decision: row.decision as Cs1aGovernanceReceipt["decision"],
    reasonCode: row.reasonCode as Cs1aGovernanceReceipt["reasonCode"],
    rightsDisposition: row.rightsDisposition as Cs1aGovernanceReceipt["rightsDisposition"],
    currentnessDisposition: row.currentnessDisposition as Cs1aGovernanceReceipt["currentnessDisposition"],
    publicationAuthority: row.publicationAuthority as Cs1aGovernanceReceipt["publicationAuthority"],
    contentClass: row.contentClass as Cs1aGovernanceReceipt["contentClass"],
    authoringOrigin: row.authoringOrigin as Cs1aGovernanceReceipt["authoringOrigin"],
    sourceOrigin: row.sourceOrigin as Cs1aGovernanceReceipt["sourceOrigin"],
    sourceManifestRef: row.sourceManifestRef,
    sourceAuthority: row.sourceAuthority,
    actorAuditLogId: row.actorAuditLogId,
    provenance: row.gitSha || row.executionId ? { gitSha: row.gitSha ?? undefined, executionId: row.executionId ?? undefined } : undefined,
    receiptId: row.receiptId,
    semanticDecisionHash: row.semanticDecisionHash,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt,
  };
}

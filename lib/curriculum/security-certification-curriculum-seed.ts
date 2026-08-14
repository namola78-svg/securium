import {
  flattenOfficialCurriculumTree,
  SECURITY_CERTIFICATION_CURRICULUM_TREES,
  type FlattenedOfficialCurriculumNode,
  type OfficialCurriculumTreeDefinition,
} from "./security-certification-standards.ts";

export type SecurityCertificationSeedDialect = "d1" | "postgres";

export type SecurityCertificationSeedSqlOptions = {
  dialect: SecurityCertificationSeedDialect;
  treeIds?: string[];
};

type SqlLiteral = string | number | null;

const NODE_ID_PREFIX = "curriculum-node";

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlLiteral(value: SqlLiteral): string {
  if (value === null) {
    return "NULL";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return sqlString(value);
}

function currentTimestamp(dialect: SecurityCertificationSeedDialect): string {
  return dialect === "postgres" ? "CURRENT_TIMESTAMP::text" : "CURRENT_TIMESTAMP";
}

function nodeId(stableKey: string): string {
  return `${NODE_ID_PREFIX}-${stableKey.toLowerCase()}`;
}

function parentNodeId(node: FlattenedOfficialCurriculumNode): string | null {
  return node.parentStableKey === null ? null : nodeId(node.parentStableKey);
}

function treeInsertPrefix(dialect: SecurityCertificationSeedDialect): string {
  return dialect === "postgres"
    ? 'INSERT INTO "curriculum_trees"'
    : 'INSERT OR IGNORE INTO "curriculum_trees"';
}

function nodeInsertPrefix(dialect: SecurityCertificationSeedDialect): string {
  return dialect === "postgres"
    ? 'INSERT INTO "curriculum_nodes"'
    : 'INSERT OR IGNORE INTO "curriculum_nodes"';
}

function insertSuffix(dialect: SecurityCertificationSeedDialect): string {
  return dialect === "postgres" ? '\nON CONFLICT ("id") DO NOTHING;' : ";";
}

function buildTreeInsert(
  tree: OfficialCurriculumTreeDefinition,
  dialect: SecurityCertificationSeedDialect,
): string {
  const timestamp = currentTimestamp(dialect);
  const values = [
    tree.treeId,
    tree.courseId,
    tree.title,
    tree.version,
    tree.sourceType,
    tree.sourceDocument,
    tree.effectiveFrom,
    tree.effectiveTo,
    tree.status,
  ].map(sqlLiteral);

  return `${treeInsertPrefix(dialect)} (
  "id",
  "course_id",
  "title",
  "version",
  "source_type",
  "source_document",
  "effective_from",
  "effective_to",
  "status",
  "created_at",
  "updated_at"
) VALUES (
  ${values.join(",\n  ")},
  ${timestamp},
  ${timestamp}
)${insertSuffix(dialect)}`;
}

function buildNodeMetadata(
  tree: OfficialCurriculumTreeDefinition,
  node: FlattenedOfficialCurriculumNode,
): string {
  return JSON.stringify({
    ...node.metadata,
    treeId: tree.treeId,
    sourceDocument: tree.sourceDocument,
    officialSource: tree.officialSource,
    correctionStatus: tree.correctionStatus,
    notes: node.notes,
  });
}

function buildNodeInsert(
  tree: OfficialCurriculumTreeDefinition,
  node: FlattenedOfficialCurriculumNode,
  dialect: SecurityCertificationSeedDialect,
): string {
  const timestamp = currentTimestamp(dialect);
  const values = [
    nodeId(node.stableKey),
    tree.treeId,
    parentNodeId(node),
    node.nodeType,
    node.title,
    "",
    node.stableKey,
    node.title,
    node.sortOrder,
    node.depth,
    node.path,
    node.isRequired ? 1 : 0,
    node.isPractical ? 1 : 0,
    null,
    node.importance,
    buildNodeMetadata(tree, node),
    "ACTIVE",
  ].map(sqlLiteral);

  return `${nodeInsertPrefix(dialect)} (
  "id",
  "curriculum_tree_id",
  "parent_id",
  "node_type",
  "title",
  "description",
  "official_code",
  "official_title",
  "sort_order",
  "depth",
  "path",
  "is_required",
  "is_practical",
  "difficulty",
  "importance",
  "metadata",
  "status",
  "created_at",
  "updated_at"
) VALUES (
  ${values.join(",\n  ")},
  ${timestamp},
  ${timestamp}
)${insertSuffix(dialect)}`;
}

export function generateSecurityCertificationCurriculumSeedSql(
  options: SecurityCertificationSeedSqlOptions,
): string {
  const trees =
    options.treeIds === undefined
      ? SECURITY_CERTIFICATION_CURRICULUM_TREES
      : SECURITY_CERTIFICATION_CURRICULUM_TREES.filter((tree) =>
          options.treeIds?.includes(tree.treeId),
        );

  const statements = trees.flatMap((tree) => [
    buildTreeInsert(tree, options.dialect),
    ...flattenOfficialCurriculumTree(tree).map((node) =>
      buildNodeInsert(tree, node, options.dialect),
    ),
  ]);

  const header = [
    "-- SECURIUM information security certification official curriculum seed.",
    "-- Source: authenticated CQ 2027-2029 official exam-standard PDFs.",
    "-- Safety: inserts curriculum trees as DRAFT; review in admin before activation.",
    "-- This file is generated for review/application by an operator; it is not auto-applied.",
  ];

  if (options.dialect === "d1") {
    return [
      ...header,
      "-- D1 note: BEGIN/COMMIT are intentionally omitted for wrangler d1 execute compatibility.",
      ...statements,
      "",
    ].join("\n\n");
  }

  return [
    ...header,
    "BEGIN;",
    ...statements,
    "COMMIT;",
    "",
  ].join("\n\n");
}

export function getSecurityCertificationCurriculumSeedStats() {
  return SECURITY_CERTIFICATION_CURRICULUM_TREES.map((tree) => ({
    treeId: tree.treeId,
    courseId: tree.courseId,
    version: tree.version,
    nodeCount: flattenOfficialCurriculumTree(tree).length,
  }));
}

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { promisify } from "node:util";
import {
  effectiveOfficialSecurityCertificationCourseLessons,
  getIndustrialPrc2CourseLessonPlacementStats,
  INDUSTRIAL_PRC2_DETACHED_COURSE_LESSON_IDS,
  officialSecurityCertificationContents,
  officialSecurityCertificationCourseLessons,
  generateSecurityCertificationCourseLessonSeedSql,
} from "../lib/data/security-certification-course-lessons.mjs";
import { applicationSecurityQuestionSamples } from "../lib/data/security-certification-application-security-questions.mjs";
import { securityCertificationInformationSecurityGeneralQuestionSamples } from "../lib/data/security-certification-information-security-general-questions.mjs";
import { managementLawQuestionSamples } from "../lib/data/security-certification-management-law-questions.mjs";
import { networkSecurityQuestionSamples } from "../lib/data/security-certification-network-security-questions.mjs";
import { practicalSecurityQuestionSamples } from "../lib/data/security-certification-practical-questions.mjs";
import { systemSecurityQuestionSamples } from "../lib/data/security-certification-system-security-questions.mjs";
import { resolveQuestionCurriculumPlacement } from "../lib/curriculum/security-certification-content-map.ts";
import { buildSecurityCertificationOntologyEdges } from "../lib/curriculum/security-certification-ontology.ts";
import { buildCoverageSql } from "../scripts/verify-security-certification-curriculum-coverage.mjs";

const execFileAsync = promisify(execFile);

const DETACHED_IDS = [
  "course-lesson-isie-official-general-cia-core-properties",
  "course-lesson-isie-official-network-arp-spoofing-vertical-slice",
  "course-lesson-isie-official-system-linux-file-permissions",
] as const;

const CONTENT_IDS = [
  "content-official-security-cert-general-cia-core-properties",
  "content-official-security-cert-network-arp-spoofing-vertical-slice",
  "content-official-security-cert-system-linux-file-permissions",
] as const;

const NODE_IDS = [
  "curriculum-node-isie-2027-2029-01-04-01",
  "curriculum-node-isie-2027-2029-01-02-02-03",
  "curriculum-node-isie-2027-2029-01-01-01-02",
] as const;

const CANONICAL_REPLACEMENT_IDS = [
  "course-lesson-isie-official-general-security-elements",
  "course-lesson-isie-official-network-spoofing",
  "course-lesson-isie-official-system-operating-systems",
] as const;

const allQuestions = [
  ...systemSecurityQuestionSamples,
  ...networkSecurityQuestionSamples,
  ...applicationSecurityQuestionSamples,
  ...securityCertificationInformationSecurityGeneralQuestionSamples,
  ...managementLawQuestionSamples,
  ...practicalSecurityQuestionSamples,
];

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

test("PR-C2 archives exactly the three authorized Industrial identities", () => {
  assert.deepEqual(INDUSTRIAL_PRC2_DETACHED_COURSE_LESSON_IDS, DETACHED_IDS);
  const detached = officialSecurityCertificationCourseLessons.filter((lesson) =>
    DETACHED_IDS.includes(lesson.id as (typeof DETACHED_IDS)[number]),
  );

  assert.equal(detached.length, 3);
  assert.deepEqual(detached.map((lesson) => lesson.contentId), CONTENT_IDS);
  assert.deepEqual(detached.map((lesson) => lesson.curriculumNodeId), NODE_IDS);
  assert.equal(detached.every((lesson) => lesson.status === "ARCHIVED"), true);
  assert.equal(
    effectiveOfficialSecurityCertificationCourseLessons.some((lesson) =>
      DETACHED_IDS.includes(lesson.id as (typeof DETACHED_IDS)[number]),
    ),
    false,
  );
});

test("physical identities remain 65 while effective Industrial placement is exactly 62", () => {
  assert.deepEqual(getIndustrialPrc2CourseLessonPlacementStats(), {
    physicalCourseLessonCount: 65,
    effectivePlacementCount: 62,
    prc3DeferredCount: 3,
  });
  assert.equal(
    officialSecurityCertificationCourseLessons.filter(
      (lesson) => lesson.courseId === "course-isie",
    ).length,
    65,
  );

  for (let index = 0; index < NODE_IDS.length; index += 1) {
    const effectiveAtNode = effectiveOfficialSecurityCertificationCourseLessons.filter(
      (lesson) =>
        lesson.courseId === "course-isie" &&
        lesson.curriculumNodeId === NODE_IDS[index],
    );
    assert.deepEqual(effectiveAtNode.map((lesson) => lesson.id), [
      CANONICAL_REPLACEMENT_IDS[index],
    ]);
  }
});

test("coverage SQL excludes retained sample rows from the official physical count", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(`
      CREATE TABLE curriculum_trees (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE curriculum_nodes (
        id TEXT PRIMARY KEY,
        curriculum_tree_id TEXT NOT NULL,
        node_type TEXT NOT NULL,
        metadata TEXT,
        status TEXT NOT NULL
      );
      CREATE TABLE course_lessons (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL,
        curriculum_node_id TEXT,
        status TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE TABLE questions (id TEXT PRIMARY KEY, status TEXT NOT NULL);
      CREATE TABLE question_courses (question_id TEXT NOT NULL, course_id TEXT NOT NULL);
      INSERT INTO curriculum_trees (id, course_id, title, status)
      VALUES (
        'curriculum-isie-2027-2029-official',
        'course-isie',
        'Industrial official fixture',
        'DRAFT'
      );
    `);

    const insertCourseLesson = database.prepare(`
      INSERT INTO course_lessons (
        id,
        course_id,
        curriculum_node_id,
        status,
        deleted_at
      ) VALUES (?, ?, ?, ?, NULL)
    `);
    const industrialOfficialLessons =
      officialSecurityCertificationCourseLessons.filter(
        (lesson) => lesson.courseId === "course-isie",
      );
    for (const lesson of industrialOfficialLessons) {
      insertCourseLesson.run(
        lesson.id,
        lesson.courseId,
        lesson.curriculumNodeId,
        lesson.status ?? "PUBLISHED",
      );
    }

    const retainedSampleIds = [
      "course-lesson-isie-access-control",
      "course-lesson-isie-encryption",
      "course-lesson-isie-incident-response",
      "course-lesson-isie-input-validation",
    ];
    for (const id of retainedSampleIds) {
      insertCourseLesson.run(id, "course-isie", null, "PUBLISHED");
    }

    const rows = database.prepare(buildCoverageSql("d1")).all() as Array<
      Record<string, number | string | null>
    >;
    const industrial = rows.find(
      (row) => row.id === "curriculum-isie-2027-2029-official",
    );

    assert.ok(industrial);
    assert.equal(industrialOfficialLessons.length, 65);
    assert.equal(industrial.total_physical_course_lesson_count, 69);
    assert.equal(industrial.non_official_physical_course_lesson_count, 4);
    assert.equal(industrial.physical_course_lesson_count, 65);
    assert.equal(industrial.effective_placement_count, 62);
    assert.equal(industrial.prc3_deferred_count, 3);
    assert.equal(
      Number(industrial.total_physical_course_lesson_count),
      Number(industrial.physical_course_lesson_count) + retainedSampleIds.length,
    );
  } finally {
    database.close();
  }
});

test("seed contract is deterministic, retains rows, archives three, and never deletes", () => {
  for (const dialect of ["d1", "postgres"] as const) {
    const first = generateSecurityCertificationCourseLessonSeedSql({ dialect });
    const second = generateSecurityCertificationCourseLessonSeedSql({ dialect });
    assert.equal(first, second);
    assert.equal((first.match(/SET "status" = 'ARCHIVED'/g) ?? []).length, 1);
    assert.doesNotMatch(first, /DELETE\s+FROM\s+"course_lessons"/i);
    for (const id of DETACHED_IDS) assert.match(first, new RegExp(id));
  }
});

test("Question educational payload and placement metadata retain their prestate digests", () => {
  const educational = allQuestions.map((question) => ({
    id: question.id,
    title: question.title,
    content: question.content,
    type: question.type,
    choices: question.choices,
    answerConfig: question.answerConfig,
    explanation: question.explanation,
    wrongAnswerExplanation: question.wrongAnswerExplanation,
  }));
  const placement = allQuestions.map((question) => ({
    id: question.id,
    courseLinks: question.courseLinks,
    contentLinks: question.contentLinks,
    primaryCurriculumPlacements: (
      question as { primaryCurriculumPlacements?: unknown }
    ).primaryCurriculumPlacements,
  }));

  assert.equal(
    digest(educational),
    "c4981e310f731324c05811ea452fa07cbb39ba149f68c4ce98c7c27e6bbf5474",
  );
  assert.equal(
    digest(placement),
    "7ab74bd874ab4b81fb96161068e6a1e0ff14adfc20f24d1d07cc09e3eb628c14",
  );
});

test("all 15 Question-Content supporting relations remain byte-equivalent", () => {
  const supporting = allQuestions
    .flatMap((question) =>
      ((question.contentLinks ?? []) as Array<{
        contentType: string;
        contentId: string;
      }>)
        .filter((link) => CONTENT_IDS.includes(link.contentId as (typeof CONTENT_IDS)[number]))
        .map((link) => ({
          questionId: question.id,
          contentType: link.contentType,
          contentId: link.contentId,
        })),
    )
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );

  assert.equal(supporting.length, 15);
  assert.equal(
    digest(supporting),
    "b1747ff85dee65329354df41a2af2b93df482e789ad610958bc099b4c0fcf01c",
  );
});

test("Engineer mapping, shared Content bodies, and CourseLesson identities are unchanged", () => {
  const engineerMapping = officialSecurityCertificationCourseLessons
    .filter((lesson) => lesson.courseId === "course-ise")
    .map((lesson) => ({
      id: lesson.id,
      node: lesson.curriculumNodeId,
      content: lesson.contentId,
      status: lesson.status ?? "PUBLISHED",
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const contentBodies = officialSecurityCertificationContents
    .filter((content) => CONTENT_IDS.includes(content.id as (typeof CONTENT_IDS)[number]))
    .map((content) => ({ id: content.id, body: content.body }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const identities = officialSecurityCertificationCourseLessons
    .map((lesson) => lesson.id)
    .sort();

  assert.equal(
    digest(engineerMapping),
    "6c6892fd50c3ceaf7611df923f12e19fdf4e7346cf822bb2592ae6b8c97a5672",
  );
  assert.equal(
    digest(contentBodies),
    "6b3bdd17633f7e6c644c938f26db058899a6cea8455423bcb4ffde5b319e1a4b",
  );
  assert.equal(
    digest(identities),
    "25ddb34bef6517faa91d94269565c6b7a0d0e7bcaed8042734b7268a5672fdfb",
  );
});

test("Industrial Q4-Q7 stay explicit and Engineer Q4-Q7 stay legacy-derived", () => {
  const targetIds = new Set([
    "application-security-official-sample-q01",
    "application-security-official-sample-q02",
    "application-security-official-sample-q03",
    "application-security-official-sample-q06",
  ]);
  const questions = applicationSecurityQuestionSamples.filter((question) =>
    targetIds.has(question.id),
  );
  assert.equal(questions.length, 4);

  for (const question of questions) {
    const industrial = resolveQuestionCurriculumPlacement(question, {
      courseId: "course-isie",
      curriculumTreeId: "curriculum-isie-2027-2029-official",
    });
    const engineer = resolveQuestionCurriculumPlacement(question, {
      courseId: "course-ise",
      curriculumTreeId: "curriculum-ise-2027-2029-official",
    });
    assert.equal(industrial.mode, "EXPLICIT_PRIMARY");
    assert.deepEqual(industrial.officialPlacementNodeIds, [
      "curriculum-node-isie-2027-2029-01-03-02-01",
    ]);
    assert.equal(engineer.mode, "LEGACY_CONTENT_DERIVED");
  }
});

test("only six Industrial CourseLesson-derived ontology edges leave the effective projection", () => {
  const edges = buildSecurityCertificationOntologyEdges();
  const curriculumCourseLessonEdges = edges.filter(
    (edge) => edge.fromType === "CURRICULUM_NODE" && edge.toType === "COURSE_LESSON",
  );
  const courseLessonContentEdges = edges.filter(
    (edge) => edge.fromType === "COURSE_LESSON" && edge.toType === "CONTENT",
  );

  assert.equal(curriculumCourseLessonEdges.length, 142);
  assert.equal(courseLessonContentEdges.length, 142);
  assert.equal(
    edges.some(
      (edge) =>
        DETACHED_IDS.includes(edge.fromId as (typeof DETACHED_IDS)[number]) ||
        DETACHED_IDS.includes(edge.toId as (typeof DETACHED_IDS)[number]),
    ),
    false,
  );
});

test("linked-content cleanup is explicit and stats execution is idempotent", async () => {
  const script = await readFile(
    "scripts/apply-security-certification-curriculum-linked-content.mjs",
    "utf8",
  );
  assert.match(script, /buildDetachedNodeContentLinks/);
  assert.match(script, /detachedKeys/);
  assert.match(script, /retainedLinks/);
  assert.match(script, /effectiveOfficialSecurityCertificationCourseLessons/);

  const first = await execFileAsync(process.execPath, [
    "scripts/apply-security-certification-curriculum-linked-content.mjs",
    "stats",
  ]);
  const second = await execFileAsync(process.execPath, [
    "scripts/apply-security-certification-curriculum-linked-content.mjs",
    "stats",
  ]);
  assert.equal(first.stdout, second.stdout);
  const stats = JSON.parse(first.stdout);
  assert.equal(stats.courseLessonSourceCount, 145);
  assert.equal(stats.effectiveCourseLessonSourceCount, 142);
  assert.equal(stats.prc3DeferredCount, 3);
});

test("activation guard and three-way coverage metrics remain explicit", async () => {
  const activation = await readFile(
    "scripts/activate-security-certification-curriculum.mjs",
    "utf8",
  );
  const coverage = await readFile(
    "scripts/verify-security-certification-curriculum-coverage.mjs",
    "utf8",
  );

  assert.match(activation, /evaluateCurrentEngineerBetaActivationEligibility/);
  assert.equal(
    (activation.match(/assertEngineerBetaActivationEligibility\(\);/g) ?? []).length,
    2,
  );
  assert.match(activation, /effectiveOfficialSecurityCertificationCourseLessons/);
  assert.match(coverage, /physical_course_lesson_count/);
  assert.match(coverage, /effective_placement_count/);
  assert.match(coverage, /prc3_deferred_count/);
});

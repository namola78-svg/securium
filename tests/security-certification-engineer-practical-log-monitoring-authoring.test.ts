import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import test from "node:test";
import {
  SECURITY_CERTIFICATION_CURRICULUM_TREES,
  flattenOfficialCurriculumTree,
} from "../lib/curriculum/security-certification-standards.ts";
import {
  buildSecurityCertificationOntologyConcepts,
  buildSecurityCertificationOntologyEdges,
  buildSecurityCertificationQuestionOntologyEdges,
} from "../lib/curriculum/security-certification-ontology.ts";
import { getSecurityCertificationContentMap } from "../lib/curriculum/security-certification-content-map.ts";
import {
  officialSecurityCertificationContents,
  officialSecurityCertificationCourseLessons,
  generateSecurityCertificationCourseLessonSeedSql,
} from "../lib/data/security-certification-course-lessons.mjs";
import {
  engineerPracticalLogMonitoringAuthoringMetadata,
  engineerPracticalLogMonitoringContent,
  engineerPracticalLogMonitoringQuestion,
} from "../lib/data/security-certification-engineer-practical-log-monitoring-authoring.mjs";
import { practicalSecurityQuestionSamples } from "../lib/data/security-certification-practical-questions.mjs";

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..");
const NEW_CONTENT_ID =
  "content-official-security-cert-ise-practical-log-collection-monitoring";
const NEW_QUESTION_ID =
  "practical-security-official-engineer-log-monitoring-q01";
const LEGACY_CONTENT_ID =
  "content-official-security-cert-practical-security-objective-detection-response";
const LEGACY_QUESTION_ID = "practical-security-official-subitem-q09";

type AuthoredChoice = {
  id: string;
  content: string;
  displayOrder: number;
  isCorrect: boolean;
  explanation: string;
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalSha256(value: unknown): string {
  return sha256(canonicalJson(value));
}

function questionCorePayload(question: Record<string, unknown>) {
  return {
    source: question.source,
    sourceDate: question.sourceDate,
    sampleOnly: question.sampleOnly,
    answerConfig: question.answerConfig,
    choices: question.choices,
    id: question.id,
    title: question.title,
    content: question.content,
    type: question.type,
    difficulty: question.difficulty,
  };
}

function authoredQuestionCorePayload(question: Record<string, unknown>) {
  return {
    answerConfig: question.answerConfig,
    authoringMetadata: question.authoringMetadata,
    choices: question.choices,
    content: question.content,
    difficulty: question.difficulty,
    explanation: question.explanation,
    id: question.id,
    sampleOnly: question.sampleOnly,
    source: question.source,
    sourceClass: question.sourceClass,
    sourceDate: question.sourceDate,
    tags: question.tags,
    title: question.title,
    type: question.type,
    wrongAnswerExplanation: question.wrongAnswerExplanation,
  };
}

async function listSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", ".next", ".git"].includes(entry.name)) return [];
        return listSourceFiles(path);
      }
      return [path];
    }),
  );
  return files.flat();
}

test("PR-A authored Content has the exact Engineer-owned identity and inert state", () => {
  assert.deepEqual(
    {
      id: engineerPracticalLogMonitoringContent.id,
      slug: engineerPracticalLogMonitoringContent.slug,
      canonicalKey: engineerPracticalLogMonitoringContent.canonicalKey,
      title: engineerPracticalLogMonitoringContent.title,
      bodyFormat: engineerPracticalLogMonitoringContent.bodyFormat,
      status: engineerPracticalLogMonitoringContent.status,
      authoringOnly: engineerPracticalLogMonitoringContent.authoringOnly,
      course: engineerPracticalLogMonitoringContent.authoringMetadata.course,
      courseId: engineerPracticalLogMonitoringContent.authoringMetadata.courseId,
      track: engineerPracticalLogMonitoringContent.authoringMetadata.track,
    },
    {
      id: NEW_CONTENT_ID,
      slug: "official-security-cert-ise-practical-log-collection-monitoring",
      canonicalKey:
        "official.security-certification.ise.practical.log-collection-monitoring",
      title: "보안 로그 수집 및 모니터링",
      bodyFormat: "MARKDOWN",
      status: "DRAFT",
      authoringOnly: true,
      course: "Information Security Engineer",
      courseId: "course-ise",
      track: "PRACTICAL",
    },
  );
});

test("PR-B activates one published Content projection without mutating the frozen source", () => {
  const activeContents = officialSecurityCertificationContents.filter(
    (content) => content.id === engineerPracticalLogMonitoringContent.id,
  );

  assert.equal(canonicalSha256(engineerPracticalLogMonitoringContent),
    "1062cd16419fd86f0755b28db21ee6020b7c35bf9ee27055e7183aa0477f681a");
  assert.equal(sha256(engineerPracticalLogMonitoringContent.body),
    "90571bfe151e8444190b230a8097e81c8163a3bf771c8f3b55a2289428f7cada");
  assert.equal(activeContents.length, 1);
  assert.equal(activeContents[0]?.status, "PUBLISHED");
  assert.equal(activeContents[0]?.authoringOnly, false);
  assert.equal(activeContents[0]?.body, engineerPracticalLogMonitoringContent.body);
  assert.equal(engineerPracticalLogMonitoringContent.status, "DRAFT");
  assert.equal(engineerPracticalLogMonitoringContent.authoringOnly, true);
});

test("PR-A authoring provenance is authenticated, current, and page-specific", () => {
  assert.deepEqual(engineerPracticalLogMonitoringAuthoringMetadata.officialSource, {
    url: "https://www.cq.or.kr/ac_flecm02_001.do?atchFileId=53426c2c81474591bef0207cdf4b9562&fileSn=1",
    sha256: "23e78b2452db75e3a37c31b7e1aa263d890131c6e38d364a79eba1744ceb2352",
    publishedAt: "2026-07-23",
    effectiveFrom: "2027-01-01",
    effectiveTo: "2029-12-31",
    absolutePdfPage: 10,
    practicalSectionPage: 5,
  });
  assert.equal(engineerPracticalLogMonitoringAuthoringMetadata.currentness, "CURRENT");
  assert.equal(
    engineerPracticalLogMonitoringAuthoringMetadata.authoringProvenance,
    "AUTHOR_CREATED_FROM_OFFICIAL_SCOPE",
  );
  assert.equal(
    engineerPracticalLogMonitoringAuthoringMetadata.lifecycle,
    "AUTHORING_ONLY_UNLINKED",
  );
});

test("PR-A authored Content is substantive, structured Markdown without placeholder or mojibake", () => {
  const body = engineerPracticalLogMonitoringContent.body;
  const numberedSections = body.match(/^## \d+\./gm) ?? [];

  assert.equal(numberedSections.length, 10);
  assert.ok(body.length >= 3_500);
  assert.ok(body.split(/\s+/).length >= 900);
  assert.doesNotMatch(body, /TODO|TBD|Lorem ipsum|placeholder|샘플 문구/i);
  assert.doesNotMatch(body, /```json|^\s*\{\s*"/m);
  assert.doesNotMatch(body, /�|蹂댁|濡쒓|媛/u);
  assert.equal(engineerPracticalLogMonitoringContent.learningObjectives.length, 3);
  assert.equal(engineerPracticalLogMonitoringContent.coreConcepts.length, 8);
});

test("PR-A authored Content covers official core concepts without promoting deferred topics", () => {
  const body = engineerPracticalLogMonitoringContent.body;
  for (const concept of [
    "로그 발생 대상",
    "운영체제",
    "서비스별",
    "Firewall",
    "IDS",
    "Switch",
    "생성 수준",
    "구성요소",
    "로그 모니터링",
    "통제",
  ]) {
    assert.match(body, new RegExp(concept));
  }

  assert.match(body, /다음은 이 학습의 핵심 범위가 아니다/);
  assert.match(body, /사고 억제, 근절, 복구와 포렌식/);
  assert.match(body, /추가 근거 검토 전까지 유보한다/);
  assert.deepEqual(
    Object.values(engineerPracticalLogMonitoringAuthoringMetadata.ambiguousTopics),
    Array(7).fill("DEFERRED"),
  );
});

test("PR-A authored Question has exact identity, honest source, and no active links", () => {
  assert.deepEqual(
    {
      id: engineerPracticalLogMonitoringQuestion.id,
      type: engineerPracticalLogMonitoringQuestion.type,
      status: engineerPracticalLogMonitoringQuestion.status,
      sourceClass: engineerPracticalLogMonitoringQuestion.sourceClass,
      courseLinks: engineerPracticalLogMonitoringQuestion.courseLinks,
      contentLinks: engineerPracticalLogMonitoringQuestion.contentLinks,
      intendedCourseId: engineerPracticalLogMonitoringQuestion.intendedCourseId,
      intendedContentId: engineerPracticalLogMonitoringQuestion.intendedContentId,
    },
    {
      id: NEW_QUESTION_ID,
      type: "MULTIPLE_CHOICE",
      status: "DRAFT",
      sourceClass: "AUTHOR_CREATED_FROM_OFFICIAL_SCOPE",
      courseLinks: [],
      contentLinks: [],
      intendedCourseId: "course-ise",
      intendedContentId: NEW_CONTENT_ID,
    },
  );
  assert.doesNotMatch(
    engineerPracticalLogMonitoringQuestion.source,
    /official past exam|공식 기출|KCA past|CQ past/i,
  );
  assert.equal(canonicalSha256(engineerPracticalLogMonitoringQuestion),
    "1cee810f93bfdb6559ffe2a4b5efa390a18827cd265cbe8e302915700cfcef26");
  assert.equal(canonicalSha256(authoredQuestionCorePayload(engineerPracticalLogMonitoringQuestion)),
    "4c9a7a763fea4b6e3e931f6f8bde8030982c86aac2e00a7956a86024cb274dbf");
});

test("PR-A authored Question has an unambiguous answer and per-choice explanations", () => {
  const question = engineerPracticalLogMonitoringQuestion;
  const choices = question.choices as readonly AuthoredChoice[];
  const correctChoiceIds = choices
    .filter((choice) => choice.isCorrect)
    .map((choice) => choice.id);

  assert.equal(choices.length, 4);
  assert.equal(new Set(choices.map((choice) => choice.id)).size, 4);
  assert.deepEqual(correctChoiceIds, question.answerConfig.correctChoiceIds);
  assert.equal(correctChoiceIds.length, 2);
  assert.equal(choices.every((choice) => choice.explanation.length >= 35), true);
  assert.match(question.explanation, /로그 원천|생성 수준|구성요소/);
  assert.match(question.explanation, /심층 상관 분석|사고 억제·근절·복구/);
  assert.ok(question.wrongAnswerExplanation.length >= 50);
});

test("PR-A preserves the legacy shared Content canonical and body hashes", () => {
  const content = officialSecurityCertificationContents.find(
    (candidate) => candidate.id === LEGACY_CONTENT_ID,
  );
  assert.ok(content);
  assert.equal(
    canonicalSha256(content),
    "3e475f3b8bb8d125a4a553faf3c9804143aab6f5bc5920700215e6630102eecf",
  );
  assert.equal(
    sha256(content.body),
    "e619750fc58948cd7ba49a6980a2f0f6041c06f2a6b19702d3da67b5de962e4b",
  );
});

test("PR-A preserves the existing supplemental Question canonical and core hashes", () => {
  const question = practicalSecurityQuestionSamples.find(
    (candidate) => candidate.id === LEGACY_QUESTION_ID,
  ) as Record<string, unknown> | undefined;
  assert.ok(question);
  assert.equal(
    canonicalSha256(question),
    "61029373e2bb1671d0079feb943cac7612351e4884ea2258e0158ba54a620cbd",
  );
  assert.equal(
    canonicalSha256(questionCorePayload(question)),
    "3f0a143f9814eff6af11f944ae633e4ca0fffba5ea0af1f1d2a8d4c9e2847719",
  );
});

test("PR-B activates the authoring module through only the two approved registries", async () => {
  const sourceRoots = ["app", "components", "db", "lib", "scripts"]
    .map((directory) => resolve(REPOSITORY_ROOT, directory));
  const sourceFiles = (
    await Promise.all(sourceRoots.map((directory) => listSourceFiles(directory)))
  )
    .flat()
    .filter((path) => [".js", ".mjs", ".cjs", ".ts", ".tsx"].includes(extname(path)))
    .filter(
      (path) =>
        !path.endsWith(
          "security-certification-engineer-practical-log-monitoring-authoring.mjs",
        ),
    );
  const importers: string[] = [];

  for (const path of sourceFiles) {
    const source = await readFile(path, "utf8");
    if (source.includes("security-certification-engineer-practical-log-monitoring-authoring")) {
      importers.push(relative(REPOSITORY_ROOT, path).replaceAll("\\", "/"));
    }
  }

  assert.deepEqual(importers.sort(), [
    "lib/data/security-certification-course-lessons.mjs",
    "lib/data/security-certification-practical-questions.mjs",
  ]);
});

test("PR-B activates the exact title, CourseLesson relation, and Question without identity drift", () => {
  const engineerTree = SECURITY_CERTIFICATION_CURRICULUM_TREES.find(
    (tree) => tree.courseId === "course-ise",
  );
  assert.ok(engineerTree);
  const engineerNodes = flattenOfficialCurriculumTree(engineerTree);
  const targetNode = engineerNodes.find(
    (node) => node.stableKey === "ISE-2027-2029-02-01-03-01",
  );
  const engineerLesson = officialSecurityCertificationCourseLessons.find(
    (lesson) =>
      lesson.id ===
      "course-lesson-ise-official-practical-security-objective-detection-response",
  );
  const activeQuestion = practicalSecurityQuestionSamples.find(
    (question) => question.id === NEW_QUESTION_ID,
  );

  assert.equal(engineerNodes.length, 81);
  assert.equal(targetNode?.title, "보안 로그 수집 및 모니터링");
  assert.equal(targetNode?.stableKey, "ISE-2027-2029-02-01-03-01");
  assert.equal(officialSecurityCertificationContents.length, 81);
  assert.equal(officialSecurityCertificationCourseLessons.length, 145);
  assert.equal(practicalSecurityQuestionSamples.length, 22);
  assert.equal(engineerLesson?.contentId, NEW_CONTENT_ID);
  assert.equal(engineerLesson?.id,
    "course-lesson-ise-official-practical-security-objective-detection-response");
  assert.deepEqual(activeQuestion?.courseLinks, [{ courseId: "course-ise", weight: 110 }]);
  assert.deepEqual(activeQuestion?.contentLinks, [{
    contentType: "CONTENT",
    contentId: NEW_CONTENT_ID,
    relationType: "PRACTICE",
  }]);
  assert.match(generateSecurityCertificationCourseLessonSeedSql({ dialect: "d1" }),
    new RegExp(NEW_CONTENT_ID));
  assert.match(generateSecurityCertificationCourseLessonSeedSql({ dialect: "postgres" }),
    new RegExp(NEW_CONTENT_ID));
});

test("PR-B derived mappings and ontology edges remain isolated to Engineer", () => {
  assert.equal(getSecurityCertificationContentMap().length, 11);
  assert.ok(buildSecurityCertificationOntologyConcepts().some(
    (concept) => concept.sourceId === NEW_CONTENT_ID,
  ));

  const targetEdges = buildSecurityCertificationOntologyEdges().filter((edge) =>
    [edge.fromId, edge.toId].includes(NEW_CONTENT_ID) ||
    [edge.fromId, edge.toId].includes(NEW_QUESTION_ID),
  );
  const targetQuestionEdges = buildSecurityCertificationQuestionOntologyEdges().filter(
    (edge) => edge.fromId === NEW_QUESTION_ID,
  );
  assert.ok(targetEdges.length > 0);
  assert.ok(targetQuestionEdges.length > 0);
  assert.equal(targetEdges.every((edge) => edge.courseId === "course-ise"), true);
  assert.equal(targetQuestionEdges.every((edge) => edge.courseId === "course-ise"), true);

  const engineerTree = SECURITY_CERTIFICATION_CURRICULUM_TREES.find(
    (tree) => tree.courseId === "course-ise",
  );
  const industrialTree = SECURITY_CERTIFICATION_CURRICULUM_TREES.find(
    (tree) => tree.courseId === "course-isie",
  );
  assert.ok(engineerTree);
  assert.ok(industrialTree);
  const engineerTitles = flattenOfficialCurriculumTree(engineerTree).map((node) => node.title);
  const industrialTitles = flattenOfficialCurriculumTree(industrialTree).map((node) => node.title);
  assert.equal(engineerTitles.includes("보안 로그 수집 및 모니터링"), true);
  assert.equal(engineerTitles.includes("보안목표 수립 및 침해 탐지·대응"), false);
  assert.equal(industrialTitles.includes("보안목표 수립 및 침해 탐지·대응"), true);
  assert.equal(industrialTitles.includes("보안 로그 수집 및 모니터링"), false);
});

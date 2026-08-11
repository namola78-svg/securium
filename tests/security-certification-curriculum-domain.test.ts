import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  flattenOfficialCurriculumTree,
  getOfficialCurriculumTree,
  SECURITY_CERTIFICATION_ENGINEER_ONLY_PRACTICAL_ITEMS,
  SECURITY_CERTIFICATION_ENGINEER_ONLY_WRITTEN_SUBJECTS,
  SECURITY_CERTIFICATION_CURRICULUM_TREES,
  SECURITY_CERTIFICATION_SHARED_PRACTICAL_ITEMS,
  SECURITY_CERTIFICATION_SHARED_WRITTEN_SUBJECTS,
} from "../lib/curriculum/security-certification-standards.ts";

test("2027~2029 정보보안 자격 공식 커리큘럼은 과정별 course/version unique 제약과 충돌하지 않는다", () => {
  const courseVersionKeys = SECURITY_CERTIFICATION_CURRICULUM_TREES.map(
    (tree) => `${tree.courseId}:${tree.version}`,
  );
  assert.equal(new Set(courseVersionKeys).size, courseVersionKeys.length);
  assert.deepEqual(
    SECURITY_CERTIFICATION_CURRICULUM_TREES.map((tree) => tree.status),
    ["DRAFT", "DRAFT"],
  );
});

test("정보보안기사 필기는 5과목이며 정보보안관리 및 법규를 포함한다", () => {
  const tree = getOfficialCurriculumTree("curriculum-ise-2027-2029-official");
  assert.ok(tree);

  const written = tree.nodes.find((node) => node.title === "필기");
  assert.ok(written);
  const subjects = written.children?.map((node) => node.title) ?? [];

  assert.deepEqual(subjects, [
    "시스템보안",
    "네트워크보안",
    "어플리케이션보안",
    "정보보안일반",
    "정보보안관리 및 법규",
  ]);
});

test("정보보안산업기사 필기는 4과목이며 정보보안관리 및 법규를 포함하지 않는다", () => {
  const tree = getOfficialCurriculumTree("curriculum-isie-2027-2029-official");
  assert.ok(tree);

  const written = tree.nodes.find((node) => node.title === "필기");
  assert.ok(written);
  const subjects = written.children?.map((node) => node.title) ?? [];

  assert.deepEqual(subjects, [
    "시스템보안",
    "네트워크보안",
    "어플리케이션보안",
    "정보보안일반",
  ]);
  assert.equal(subjects.includes("정보보안관리 및 법규"), false);
});

test("기사와 산업기사의 공통 필기 과목은 shared taxonomy에서 한 번만 정의한다", () => {
  assert.deepEqual(
    SECURITY_CERTIFICATION_SHARED_WRITTEN_SUBJECTS.map((subject) => subject.title),
    ["시스템보안", "네트워크보안", "어플리케이션보안", "정보보안일반"],
  );
  assert.deepEqual(
    SECURITY_CERTIFICATION_ENGINEER_ONLY_WRITTEN_SUBJECTS.map((subject) => subject.title),
    ["정보보안관리 및 법규"],
  );
});

test("기사 실기는 위험분석 및 정보보호 대책 수립을 포함하고 산업기사 실기는 포함하지 않는다", () => {
  const engineer = getOfficialCurriculumTree("curriculum-ise-2027-2029-official");
  const industrial = getOfficialCurriculumTree("curriculum-isie-2027-2029-official");
  assert.ok(engineer);
  assert.ok(industrial);

  const engineerPractical = flattenOfficialCurriculumTree(engineer)
    .filter((node) => node.isPractical)
    .map((node) => node.title);
  const industrialPractical = flattenOfficialCurriculumTree(industrial)
    .filter((node) => node.isPractical)
    .map((node) => node.title);

  assert.equal(engineerPractical.includes("위험분석 및 정보보호 대책 수립"), true);
  assert.equal(industrialPractical.includes("위험분석 및 정보보호 대책 수립"), false);
});

test("실기 공통 항목과 기사 전용 항목은 분리된 taxonomy로 관리한다", () => {
  assert.deepEqual(
    SECURITY_CERTIFICATION_SHARED_PRACTICAL_ITEMS.map((item) => item.title),
    [
      "시스템 및 네트워크 보안특성 파악",
      "취약점 점검 및 보완",
      "보안 로그 수집·분석 및 침해 대응",
      "최신 보안 동향",
    ],
  );
  assert.deepEqual(
    SECURITY_CERTIFICATION_ENGINEER_ONLY_PRACTICAL_ITEMS.map((item) => item.title),
    ["위험분석 및 정보보호 대책 수립"],
  );
});

test("공식 PDF 대조 메타데이터는 필기·실기 문항수와 시간을 보존한다", () => {
  const engineer = getOfficialCurriculumTree("curriculum-ise-2027-2029-official");
  const industrial = getOfficialCurriculumTree("curriculum-isie-2027-2029-official");
  assert.ok(engineer);
  assert.ok(industrial);

  assert.deepEqual(
    engineer.examTracks.map((track) => ({
      title: track.title,
      examMethod: track.examMethod,
      questionCount: track.questionCount,
      timeLimitMinutes: track.timeLimitMinutes,
    })),
    [
      { title: "필기", examMethod: "객관식", questionCount: 100, timeLimitMinutes: 150 },
      { title: "실기", examMethod: "필답형", questionCount: null, timeLimitMinutes: 180 },
    ],
  );
  assert.deepEqual(
    industrial.examTracks.map((track) => ({
      title: track.title,
      examMethod: track.examMethod,
      questionCount: track.questionCount,
      timeLimitMinutes: track.timeLimitMinutes,
    })),
    [
      { title: "필기", examMethod: "객관식", questionCount: 80, timeLimitMinutes: 120 },
      { title: "실기", examMethod: "필답형", questionCount: null, timeLimitMinutes: 150 },
    ],
  );
  assert.equal(engineer.examTracks.every((track) => track.sourcePages.length > 0), true);
  assert.equal(industrial.examTracks.every((track) => track.sourcePages.length > 0), true);
});

test("공식 커리큘럼 flatten 결과는 stableKey와 path가 중복되지 않는다", () => {
  for (const tree of SECURITY_CERTIFICATION_CURRICULUM_TREES) {
    const nodes = flattenOfficialCurriculumTree(tree);
    const stableKeys = nodes.map((node) => node.stableKey);
    const paths = nodes.map((node) => node.path);

    assert.equal(new Set(stableKeys).size, stableKeys.length);
    assert.equal(new Set(paths).size, paths.length);
    assert.equal(nodes.every((node) => node.metadata.confirmedFromImage), true);
    assert.equal(nodes.every((node) => node.metadata.confirmedFromPdf), true);
    assert.equal(nodes.every((node) => node.metadata.needsPdfVerification === false), true);
    assert.equal(
      nodes
        .filter((node) => node.nodeType === "TRACK")
        .every((node) => node.metadata.examTrack?.sourcePages),
      true,
    );
  }
});

test("taxonomy cleanup migrations are explicitly scoped to the two security certification courses", async () => {
  const migrations = await Promise.all([
    readFile("drizzle/0020_security_certification_taxonomy_cleanup.sql", "utf8"),
    readFile("drizzle/0021_security_certification_taxonomy_validation_fixes.sql", "utf8"),
    readFile("db/postgres/migrations/0009_security_certification_taxonomy_cleanup.sql", "utf8"),
  ]);
  const forbiddenCourseIds = [
    "course-isms-p",
    "course-isrm",
    "course-sw-vuln",
    "course-cppg",
    "course-pia",
  ];

  for (const [index, migration] of migrations.entries()) {
    assert.match(migration, /course-ise/);
    assert.match(migration, /course-isie/);
    const writeScope =
      index === 2
        ? migration.replace(
            /CREATE TEMP TABLE taxonomy_cleanup_protected_(?:snapshot|current)[\s\S]*?WHERE c\.id IN \([^;]+\);/g,
            "",
          )
        : migration;
    for (const courseId of forbiddenCourseIds) {
      assert.equal(writeScope.includes(courseId), false);
    }
  }
});

test("SECURIUM_CONTENT_UPGRADE_V2 practical material keeps its 정보보안기사 provenance", async () => {
  const prepareScript = await readFile(
    "securium-content-upgrade-v2/scripts/prepare-import-plan.py",
    "utf8",
  );
  const generatedPlan = JSON.parse(
    await readFile(
      "securium-content-upgrade-v2/data/normalized-kb-import-plan.json",
      "utf8",
    ),
  ) as {
    bindings: { practicalCourseId: string };
    courseLinks: Array<{ questionId: string; courseId: string }>;
  };

  assert.match(prepareScript, /\("practicalQuestions", "course-ise"\)/);
  assert.equal(generatedPlan.bindings.practicalCourseId, "course-ise");
  assert.equal(
    generatedPlan.courseLinks
      .filter((link) => link.questionId.startsWith("sec-upgrade-practical-"))
      .every((link) => link.courseId === "course-ise"),
    true,
  );
});

test("information security course UI uses written/practical as the primary taxonomy", async () => {
  const page = await readFile("app/learn/[courseSlug]/page.tsx", "utf8");

  assert.match(page, /course\.id === "course-ise" \|\| course\.id === "course-isie"/);
  assert.match(page, /"필기·실기 선택"/);
  assert.match(page, /curriculum\.length && !isSecurityCertificationCourse/);
});

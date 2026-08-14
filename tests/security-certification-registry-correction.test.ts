import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  flattenOfficialCurriculumTree,
  getOfficialCurriculumTree,
  type OfficialCurriculumNodeDefinition,
} from "../lib/curriculum/security-certification-standards.ts";
import { applicationSecurityQuestionSamples } from "../lib/data/security-certification-application-security-questions.mjs";
import { networkSecurityQuestionSamples } from "../lib/data/security-certification-network-security-questions.mjs";
import { systemSecurityQuestionSamples } from "../lib/data/security-certification-system-security-questions.mjs";

const SHIFT_RISK_IDS = [
  "curriculum-node-ise-2027-2029-01-03-02",
  "curriculum-node-ise-2027-2029-01-03-02-01",
  "curriculum-node-ise-2027-2029-01-03-02-02",
];
const NEW_IDS = [
  "curriculum-node-ise-2027-2029-01-03-ec",
  "curriculum-node-ise-2027-2029-01-03-ec-01",
];
const QUESTION_IDS = [
  "system-security-official-sample-q05",
  "system-security-official-sample-q08",
  "network-security-official-sample-q04",
  "application-security-official-sample-q01",
  "application-security-official-sample-q02",
  "application-security-official-sample-q03",
  "application-security-official-sample-q06",
];

function nodeId(stableKey: string) {
  return `curriculum-node-${stableKey.toLowerCase()}`;
}

function titles(treeId: string) {
  const tree = getOfficialCurriculumTree(treeId);
  assert.ok(tree);
  return flattenOfficialCurriculumTree(tree).map((node) => node.title);
}

test("explicit internalStableKey overrides positional identity while legacy nodes keep positional fallback", () => {
  for (const treeId of [
    "curriculum-ise-2027-2029-official",
    "curriculum-isie-2027-2029-official",
  ]) {
    const tree = getOfficialCurriculumTree(treeId);
    assert.ok(tree);
    const flattened = flattenOfficialCurriculumTree(tree);
    const { courseCode, version } = tree;
    let cursor = 0;

    function visit(definition: OfficialCurriculumNodeDefinition, indexes: number[]) {
      const node = flattened[cursor++];
      assert.ok(node);
      const suffix = indexes.map((index) => String(index).padStart(2, "0")).join("-");
      const positionalStableKey = `${courseCode}-${version}-${suffix}`;
      assert.equal(node.stableKey, definition.internalStableKey ?? positionalStableKey);
      definition.children?.forEach((child, index) => visit(child, [...indexes, index + 1]));
    }

    tree.nodes.forEach((definition, index) => visit(definition, [index + 1]));
    assert.equal(cursor, flattened.length);
  }
});

test("preserves existing curriculum node IDs when Engineer electronic-commerce nodes are inserted", () => {
  const engineer = getOfficialCurriculumTree("curriculum-ise-2027-2029-official");
  assert.ok(engineer);
  const ids = new Set(flattenOfficialCurriculumTree(engineer).map((node) => nodeId(node.stableKey)));
  assert.deepEqual(SHIFT_RISK_IDS.map((id) => ids.has(id)), [true, true, true]);
});

test("allocates unique internal IDs for Engineer electronic-commerce nodes", () => {
  const engineer = getOfficialCurriculumTree("curriculum-ise-2027-2029-official");
  assert.ok(engineer);
  const nodes = flattenOfficialCurriculumTree(engineer);
  const ids = nodes.map((node) => nodeId(node.stableKey));
  assert.deepEqual(
    nodes.filter((node) => node.stableKey.includes("-EC")).map((node) => nodeId(node.stableKey)),
    NEW_IDS,
  );
  assert.equal(new Set(ids).size, ids.length);
});

test("does not leak Engineer electronic-commerce nodes into Industrial curriculum", () => {
  const engineerTitles = titles("curriculum-ise-2027-2029-official");
  const industrialTitles = titles("curriculum-isie-2027-2029-official");
  assert.equal(engineerTitles.includes("전자 상거래 보안"), true);
  assert.equal(engineerTitles.includes("전자상거래 보안 기술"), true);
  assert.equal(industrialTitles.includes("전자 상거래 보안"), false);
  assert.equal(industrialTitles.includes("전자상거래 보안 기술"), false);
});

test("applies the isolated Engineer network correction and leaves eight registry operations deferred", () => {
  const allTitles = [
    ...titles("curriculum-ise-2027-2029-official"),
    ...titles("curriculum-isie-2027-2029-official"),
  ];
  const count = (title: string) => allTitles.filter((candidate) => candidate === title).length;

  assert.equal(count("서비스 거부(DoS), 분산 서비스 거부(DDoS) 공격"), 2);
  assert.equal(count("서비스 거부 및 분산 서비스 거부 공격"), 0);
  assert.equal(count("어플리케이션 보안 취약점 대응"), 2);
  assert.equal(count("어플리케이션 보안취약 유형과 대응"), 0);
  assert.equal(count("취약점 점검이력과 보완 내용 관리하기"), 2);
  assert.equal(count("취약점 점검이력과 보안내용 관리하기"), 0);
  assert.equal(count("전자 상거래 보안"), 1);
  assert.equal(count("전자상거래 보안 기술"), 1);

  assert.equal(count("네트워크 보안기술 이해"), 1);
  assert.equal(count("네트워크 보안기술 및 응용"), 1);
  assert.equal(count("어플리케이션 개발 보안 개요"), 2);
  assert.equal(count("어플리케이션 개발 보안"), 0);
  assert.equal(count("보안목표 수립 및 침해 탐지·대응"), 2);
  assert.equal(count("보안 로그 수집 및 모니터링"), 0);
  assert.equal(count("IT 자산 위험 분석하기"), 1);
  assert.equal(count("IT 자산 위협 분석하기"), 0);
  assert.equal(count("조직의 정보자산 위험 및 취약점 분석·정리하기"), 1);
  assert.equal(count("조직의 정보자산 위협 및 취약점 분석 정리하기"), 0);

  const industrialTitles = titles("curriculum-isie-2027-2029-official");
  assert.equal(industrialTitles.includes("시스템 보안 솔루션"), true);
  assert.equal(industrialTitles.includes("원격접속 공격"), true);
  assert.equal(industrialTitles.includes("어플리케이션 개발 보안 개요"), true);
});

test("network course isolation preserves target IDs and complete stable-key sequences", () => {
  const expectations = [
    {
      treeId: "curriculum-ise-2027-2029-official",
      targetStableKey: "ISE-2027-2029-01-02-03-02",
      targetTitle: "네트워크 보안기술 및 응용",
      nodeCount: 81,
      sortOrder: 20,
      sequenceSha256: "3addd031bbb1f0132ae66a3defcf928080088273674959f3a3067f9f0edcb9a8",
    },
    {
      treeId: "curriculum-isie-2027-2029-official",
      targetStableKey: "ISIE-2027-2029-01-02-03-02",
      targetTitle: "네트워크 보안기술 이해",
      nodeCount: 64,
      sortOrder: 20,
      sequenceSha256: "5ceb264be146485465c91d6df5f12090b8a6840853f86b42ca509bd044c4e015",
    },
  ];

  for (const expectation of expectations) {
    const tree = getOfficialCurriculumTree(expectation.treeId);
    assert.ok(tree);
    const nodes = flattenOfficialCurriculumTree(tree);
    const target = nodes.find((node) => node.stableKey === expectation.targetStableKey);
    assert.ok(target);
    assert.equal(target.title, expectation.targetTitle);
    assert.equal(target.parentStableKey, expectation.targetStableKey.replace(/-02$/, ""));
    assert.equal(target.sortOrder, expectation.sortOrder);
    assert.equal(nodeId(target.stableKey), `curriculum-node-${expectation.targetStableKey.toLowerCase()}`);
    assert.equal(nodes.length, expectation.nodeCount);
    assert.equal(
      createHash("sha256")
        .update(JSON.stringify(nodes.map((node) => node.stableKey)))
        .digest("hex"),
      expectation.sequenceSha256,
    );
  }

  const industrialTitles = titles("curriculum-isie-2027-2029-official");
  assert.equal(industrialTitles.includes("네트워크 보안기술 및 응용"), false);
});

test("network question payloads and course mappings remain unchanged", () => {
  const questions = networkSecurityQuestionSamples.filter((question) =>
    ["network-security-official-sample-q05", "network-security-official-sample-q06"].includes(
      question.id,
    ),
  );

  assert.deepEqual(
    questions.map((question) => question.id),
    ["network-security-official-sample-q05", "network-security-official-sample-q06"],
  );
  assert.equal(
    createHash("sha256").update(JSON.stringify(questions)).digest("hex"),
    "2d99d7e4636dcbdc298081d312a00157258684837c76b6c3758ffa68b93ede64",
  );
  assert.equal(
    questions.every((question) =>
      ["course-ise", "course-isie"].every((courseId) =>
        question.courseLinks.some((link) => link.courseId === courseId),
      ),
    ),
    true,
  );
});

test("preserves seven Industrial question mappings until remap phase", () => {
  const allQuestions = [
    ...systemSecurityQuestionSamples,
    ...networkSecurityQuestionSamples,
    ...applicationSecurityQuestionSamples,
  ];
  const questions = QUESTION_IDS.map((id) => allQuestions.find((question) => question.id === id));
  assert.equal(questions.every(Boolean), true);
  assert.equal(
    createHash("sha256").update(JSON.stringify(questions)).digest("hex"),
    "0b133ae9d671f30d746c3de9679b4ef1cc343bc9569a045640e15108e444ca81",
  );
  for (const question of questions) {
    assert.ok(question);
    assert.equal(question.courseLinks.some((link) => link.courseId === "course-isie"), true);
    assert.equal(question.contentLinks.length > 0, true);
  }
});

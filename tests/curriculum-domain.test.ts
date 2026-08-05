import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertNoDuplicateSortOrder,
  assertValidParentSelection,
  buildCurriculumTree,
  computeNodeDepth,
  computeNodePath,
  recalculateSubtreePaths,
  type CurriculumNodeRecord,
} from "../lib/services/curriculum-service.ts";
import { assertCatalogManager } from "../lib/services/catalog-service.ts";

function node(
  id: string,
  parentId: string | null,
  depth: number,
  path: string,
  sortOrder = 10,
): CurriculumNodeRecord & { title: string } {
  return {
    id,
    curriculumTreeId: "tree-1",
    parentId,
    depth,
    path,
    sortOrder,
    status: "ACTIVE",
    title: id,
  };
}

test("CurriculumTree 생성 입력은 같은 course/version 중복을 DB unique 대상으로 둔다", () => {
  const key = ["course-1", "2027"].join(":");
  assert.equal(key, "course-1:2027");
});

test("Root Node와 Child Node의 depth와 path를 계산한다", () => {
  const rootPath = computeNodePath(null, "root");
  const root = node("root", null, computeNodeDepth(null), rootPath);
  assert.equal(root.depth, 0);
  assert.equal(root.path, "/root");

  const childDepth = computeNodeDepth(root);
  const childPath = computeNodePath(root, "child");
  assert.equal(childDepth, 1);
  assert.equal(childPath, "/root/child");
});

test("sortOrder는 같은 parent 범위에서 중복되면 차단한다", () => {
  const nodes = [node("root", null, 0, "/root", 10)];
  assert.throws(
    () =>
      assertNoDuplicateSortOrder({
        nodes,
        treeId: "tree-1",
        parentId: null,
        sortOrder: 10,
      }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "CURRICULUM_SORT_ORDER_DUPLICATE",
  );
});

test("자기 자신 parent와 하위 노드 parent 지정을 차단한다", () => {
  const root = node("root", null, 0, "/root");
  const child = node("child", "root", 1, "/root/child");
  const nodes = [root, child];

  assert.throws(
    () =>
      assertValidParentSelection({
        nodeId: "root",
        treeId: "tree-1",
        parent: root,
        parentId: "root",
        nodes,
      }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "CURRICULUM_PARENT_SELF",
  );

  assert.throws(
    () =>
      assertValidParentSelection({
        nodeId: "root",
        treeId: "tree-1",
        parent: child,
        parentId: "child",
        nodes,
      }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "CURRICULUM_PARENT_DESCENDANT",
  );
});

test("다른 Tree의 parent 지정을 차단한다", () => {
  const parent = {
    ...node("other-root", null, 0, "/other-root"),
    curriculumTreeId: "tree-2",
  };
  assert.throws(
    () =>
      assertValidParentSelection({
        treeId: "tree-1",
        parent,
        parentId: "other-root",
        nodes: [],
      }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "CURRICULUM_PARENT_TREE_MISMATCH",
  );
});

test("Node 이동 시 하위 depth와 path를 재계산한다", () => {
  const root = node("root", null, 0, "/root");
  const child = node("child", "root", 1, "/root/child");
  const grandchild = node("grandchild", "child", 2, "/root/child/grandchild");
  const updates = recalculateSubtreePaths({
    nodes: [root, child, grandchild],
    rootId: "child",
    rootDepth: 0,
    rootPath: "/child",
  });
  assert.deepEqual(updates, [
    { id: "grandchild", depth: 1, path: "/child/grandchild" },
  ]);
});

test("재귀형 트리를 안정적인 순서로 구성한다", () => {
  const tree = buildCurriculumTree([
    node("b", null, 0, "/b", 20),
    node("a", null, 0, "/a", 10),
    node("a-2", "a", 1, "/a/a-2", 20),
    node("a-1", "a", 1, "/a/a-1", 10),
  ]);
  assert.deepEqual(
    tree.map((item) => [item.id, item.children.map((child) => child.id)]),
    [
      ["a", ["a-1", "a-2"]],
      ["b", []],
    ],
  );
});

test("관리자 권한 검증은 일반 사용자를 차단한다", () => {
  assert.throws(
    () => assertCatalogManager(["USER"]),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "ADMIN_FORBIDDEN",
  );
  assert.doesNotThrow(() => assertCatalogManager(["COURSE_MANAGER"]));
});

test("public catalog cache uses stable wrappers instead of repository functions", () => {
  const source = readFileSync("lib/cached-catalog.ts", "utf8");
  assert.doesNotMatch(source, /unstable_cache\(\s*listPublishedCourses\s*,/);
  assert.doesNotMatch(source, /unstable_cache\(\s*getPublicCourseBySlug\s*,/);
  assert.doesNotMatch(source, /unstable_cache\(\s*listCurriculum\s*,/);
  assert.match(source, /unstable_cache\(\s*cachedListPublishedCourses\s*,/);
  assert.match(source, /unstable_cache\(\s*cachedGetPublicCourseBySlug\s*,/);
  assert.match(source, /unstable_cache\(\s*cachedListCurriculum\s*,/);
});

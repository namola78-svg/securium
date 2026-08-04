import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const port = 33121;
const baseUrl = `http://localhost:${port}`;
const admin = {
  "content-type": "application/json",
  origin: baseUrl,
  "oai-authenticated-user-email": "dev-admin@example.invalid",
};
const user = {
  "content-type": "application/json",
  origin: baseUrl,
  "oai-authenticated-user-email": "dev-user-1@example.invalid",
};
let server;
let output = "";
let treeId = "";
let treeVersion = "";
let rootId = "";
let childId = "";
let grandchildId = "";

before(async () => {
  server = spawn(
    process.execPath,
    [
      "node_modules/vinext/dist/cli.js",
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, WRANGLER_LOG_PATH: ".wrangler/wrangler.log" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  for (let attempt = 0; attempt < 480; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Curriculum E2E server stopped.\n${output}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.status > 0) return;
    } catch {
      // Server is starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Curriculum E2E server did not start.\n${output}`);
});

after(() => {
  if (server?.exitCode === null) server.kill();
});

async function post(path, headers, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

test("기존 Course 상세 URL은 신규 Tree 없이도 정상 동작한다", async () => {
  const response = await fetch(`${baseUrl}/courses/isms-p`, { headers: user });
  const html = await response.text();
  assert.equal(response.status, 200, html.slice(0, 1000));
  assert.match(html, /ISMS-P/);
});

test("관리자만 CurriculumTree를 생성할 수 있고 course/version 중복은 차단된다", async () => {
  const blocked = await post("/api/admin/curriculum-trees", user, {
    courseId: "course-isms-p",
    title: "ISMS-P 2027 커리큘럼",
    version: `sprint-a-${Date.now()}`,
    status: "DRAFT",
  });
  assert.equal(blocked.response.status, 403);

  const version = `sprint-a-${Date.now()}`;
  treeVersion = version;
  const created = await post("/api/admin/curriculum-trees", admin, {
    courseId: "course-isms-p",
    title: "ISMS-P 2027 커리큘럼",
    version,
    sourceType: "INTERNAL_REVIEW",
    sourceDocument: "Sprint B integration test",
    effectiveFrom: "2027-01-01",
    effectiveTo: "",
    status: "DRAFT",
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.payload));
  treeId = created.payload.id;

  const duplicate = await post("/api/admin/curriculum-trees", admin, {
    courseId: "course-isms-p",
    title: "ISMS-P duplicate",
    version,
    status: "DRAFT",
  });
  assert.equal(duplicate.response.status, 409);
});

test("CurriculumNode CRUD, depth, path, 정렬, 트리 조회가 동작한다", async () => {
  const root = await post("/api/admin/curriculum-nodes", admin, {
    curriculumTreeId: treeId,
    nodeType: "SUBJECT",
    title: "ISMS-P 인증기준",
    sortOrder: 10,
    isRequired: true,
    isPractical: false,
    status: "ACTIVE",
  });
  assert.equal(root.response.status, 201, JSON.stringify(root.payload));
  rootId = root.payload.id;
  assert.equal(root.payload.depth, 0);
  assert.match(root.payload.path, new RegExp(`/${rootId}$`));

  const child = await post("/api/admin/curriculum-nodes", admin, {
    curriculumTreeId: treeId,
    parentId: rootId,
    nodeType: "DOMAIN",
    title: "보호대책 요구사항",
    sortOrder: 10,
    isRequired: true,
    isPractical: false,
    status: "ACTIVE",
  });
  assert.equal(child.response.status, 201, JSON.stringify(child.payload));
  childId = child.payload.id;
  assert.equal(child.payload.depth, 1);
  assert.equal(child.payload.path, `/${rootId}/${childId}`);

  const duplicateSort = await post("/api/admin/curriculum-nodes", admin, {
    curriculumTreeId: treeId,
    parentId: rootId,
    nodeType: "DOMAIN",
    title: "중복 정렬",
    sortOrder: 10,
    isRequired: true,
    isPractical: false,
    status: "ACTIVE",
  });
  assert.equal(duplicateSort.response.status, 409);

  const grandchild = await post("/api/admin/curriculum-nodes", admin, {
    curriculumTreeId: treeId,
    parentId: childId,
    nodeType: "STANDARD",
    title: "접근통제",
    sortOrder: 10,
    isRequired: true,
    isPractical: false,
    status: "ACTIVE",
  });
  assert.equal(grandchild.response.status, 201, JSON.stringify(grandchild.payload));
  grandchildId = grandchild.payload.id;

  const listed = await fetch(
    `${baseUrl}/api/admin/curriculum-nodes?treeId=${treeId}`,
    { headers: admin },
  );
  const payload = await listed.json();
  assert.equal(listed.status, 200, JSON.stringify(payload));
  assert.equal(payload.nodes[0].id, rootId);
  assert.equal(payload.nodes[0].children[0].id, childId);
  assert.equal(payload.nodes[0].children[0].children[0].id, grandchildId);
});

test("CurriculumNode는 같은 과정의 기존 콘텐츠만 metadata 연결로 저장한다", async () => {
  const validMetadata = JSON.stringify({
    linkedContent: [
      { type: "SUBJECT", id: "course-isms-p-subject-foundation" },
      { type: "TOPIC", id: "course-isms-p-subject-foundation-topic-core" },
      {
        type: "LEARNING_UNIT",
        id: "course-isms-p-subject-foundation-topic-core-unit",
      },
      {
        type: "LESSON",
        id: "course-isms-p-subject-foundation-topic-core-lesson-01",
      },
    ],
  });
  const updated = await post("/api/admin/curriculum-nodes", admin, {
    id: rootId,
    curriculumTreeId: treeId,
    nodeType: "SUBJECT",
    title: "ISMS-P 인증기준",
    sortOrder: 10,
    isRequired: true,
    isPractical: false,
    metadata: validMetadata,
    status: "ACTIVE",
  });
  assert.equal(updated.response.status, 200, JSON.stringify(updated.payload));

  const listed = await fetch(
    `${baseUrl}/api/admin/curriculum-nodes?treeId=${treeId}&tree=false`,
    { headers: admin },
  );
  const payload = await listed.json();
  assert.equal(listed.status, 200, JSON.stringify(payload));
  const root = payload.nodes.find((node) => node.id === rootId);
  assert.match(
    root.metadata,
    /course-isms-p-subject-foundation-topic-core-lesson-01/,
  );

  const crossCourse = await post("/api/admin/curriculum-nodes", admin, {
    id: rootId,
    curriculumTreeId: treeId,
    nodeType: "SUBJECT",
    title: "ISMS-P 인증기준",
    sortOrder: 10,
    isRequired: true,
    isPractical: false,
    metadata: JSON.stringify({
      linkedContent: [{ type: "SUBJECT", id: "course-cppg-subject-foundation" }],
    }),
    status: "ACTIVE",
  });
  assert.equal(crossCourse.response.status, 400);
  assert.equal(crossCourse.payload.code, "CURRICULUM_LINK_SCOPE_MISMATCH");
});

test("ACTIVE 커리큘럼 트리는 수강자의 학습 화면에 읽기 전용 경로로 표시된다", async () => {
  const activated = await post("/api/admin/curriculum-trees", admin, {
    id: treeId,
    courseId: "course-isms-p",
    title: "ISMS-P 2027 커리큘럼",
    version: treeVersion,
    sourceType: "INTERNAL_REVIEW",
    sourceDocument: "Sprint B learner view test",
    effectiveFrom: "2027-01-01",
    effectiveTo: "",
    status: "ACTIVE",
  });
  if (activated.response.status === 409) {
    assert.equal(
      activated.payload.code,
      "CURRICULUM_TREE_ACTIVE_DUPLICATE",
      JSON.stringify(activated.payload),
    );
    const active = await fetch(
      `${baseUrl}/api/admin/curriculum-trees?courseId=course-isms-p&active=true`,
      { headers: admin },
    );
    const activePayload = await active.json();
    assert.equal(active.status, 200, JSON.stringify(activePayload));
    assert.ok(activePayload.tree?.id);
  } else {
    assert.equal(activated.response.status, 200, JSON.stringify(activated.payload));
  }

  const completedLesson = await post("/api/lessons/progress", user, {
    lessonId: "course-isms-p-subject-foundation-topic-core-lesson-01",
    action: "COMPLETE",
    lastPosition: 9999,
  });
  assert.equal(
    completedLesson.response.status,
    200,
    JSON.stringify(completedLesson.payload),
  );

  const response = await fetch(`${baseUrl}/learn/isms-p`, { headers: user });
  const html = await response.text();
  assert.equal(response.status, 200, html.slice(0, 1000));
  assert.match(html, /OFFICIAL CURRICULUM/);
  assert.match(html, /공식 커리큘럼/);
  assert.match(html, /ISMS-P 2027/);
  assert.match(html, /개 노드/);
  assert.match(html, /learn-curriculum-path-tree/);
});

test("자기 자신, 하위 노드, 다른 Tree parent 지정은 차단된다", async () => {
  const selfParent = await post("/api/admin/curriculum-nodes", admin, {
    id: rootId,
    curriculumTreeId: treeId,
    parentId: rootId,
    nodeType: "SUBJECT",
    title: "ISMS-P 인증기준",
    sortOrder: 10,
    isRequired: true,
    isPractical: false,
    status: "ACTIVE",
  });
  assert.equal(selfParent.response.status, 400);

  const descendantParent = await post("/api/admin/curriculum-nodes", admin, {
    id: rootId,
    curriculumTreeId: treeId,
    parentId: grandchildId,
    nodeType: "SUBJECT",
    title: "ISMS-P 인증기준",
    sortOrder: 10,
    isRequired: true,
    isPractical: false,
    status: "ACTIVE",
  });
  assert.equal(descendantParent.response.status, 409);

  const otherTree = await post("/api/admin/curriculum-trees", admin, {
    courseId: "course-cppg",
    title: "CPPG Sprint B 커리큘럼",
    version: `sprint-b-${Date.now()}`,
    status: "DRAFT",
  });
  assert.equal(otherTree.response.status, 201, JSON.stringify(otherTree.payload));
  const otherRoot = await post("/api/admin/curriculum-nodes", admin, {
    curriculumTreeId: otherTree.payload.id,
    nodeType: "SUBJECT",
    title: "개인정보보호 이해",
    sortOrder: 10,
    isRequired: true,
    isPractical: false,
    status: "ACTIVE",
  });
  assert.equal(otherRoot.response.status, 201, JSON.stringify(otherRoot.payload));

  const crossTreeParent = await post("/api/admin/curriculum-nodes", admin, {
    id: rootId,
    curriculumTreeId: treeId,
    parentId: otherRoot.payload.id,
    nodeType: "SUBJECT",
    title: "ISMS-P 인증기준",
    sortOrder: 10,
    isRequired: true,
    isPractical: false,
    status: "ACTIVE",
  });
  assert.equal(crossTreeParent.response.status, 400);
});

test("Node 이동은 하위 depth/path를 함께 갱신하고 하위가 있는 노드 보관은 차단된다", async () => {
  const moved = await post("/api/admin/curriculum-nodes", admin, {
    id: childId,
    curriculumTreeId: treeId,
    nodeType: "DOMAIN",
    title: "보호대책 요구사항",
    sortOrder: 20,
    isRequired: true,
    isPractical: false,
    status: "ACTIVE",
  });
  assert.equal(moved.response.status, 200, JSON.stringify(moved.payload));
  assert.equal(moved.payload.depth, 0);
  assert.equal(moved.payload.path, `/${childId}`);

  const listed = await fetch(
    `${baseUrl}/api/admin/curriculum-nodes?treeId=${treeId}&tree=false`,
    { headers: admin },
  );
  const payload = await listed.json();
  assert.equal(listed.status, 200, JSON.stringify(payload));
  const grandchild = payload.nodes.find((node) => node.id === grandchildId);
  assert.equal(grandchild.depth, 1);
  assert.equal(grandchild.path, `/${childId}/${grandchildId}`);

  const archiveParent = await fetch(`${baseUrl}/api/admin/curriculum-nodes`, {
    method: "DELETE",
    headers: admin,
    body: JSON.stringify({ id: childId }),
  });
  assert.equal(archiveParent.status, 409);
});

test("관리자 커리큘럼 화면은 Tree, Node, 기존 콘텐츠 연결, 운영 통계 UI를 제공한다", async () => {
  const response = await fetch(`${baseUrl}/admin/curriculum?treeId=${treeId}`, {
    headers: admin,
  });
  const html = await response.text();
  assert.equal(response.status, 200, html.slice(0, 1000));
  assert.match(html, /커리큘럼 트리 관리/);
  assert.match(html, /커리큘럼 트리/);
  assert.match(html, /노드/);
  assert.match(html, /연결 가능 콘텐츠/);
  assert.match(html, /운영 통계/);
  assert.match(html, /curriculum-admin-node-stats/);
  assert.match(html, /ISMS-P 2027/);
  assert.match(html, /공식 커리큘럼 아키텍처/);
  assert.match(html, /기사·산업기사 공식 커리큘럼 커버리지/);
  assert.match(html, /role="tree"/);
  assert.match(html, /role="treeitem"/);
  assert.match(html, /aria-level="1"/);
  assert.match(html, /admin-mobile-nav-button/);
  assert.match(html, /aria-controls="admin-sidebar-navigation"/);
  assert.match(html, /관리자 본문으로 이동/);
  assert.match(html, /account-drawer-trigger/);
  assert.match(html, /aria-controls="admin-account-drawer"/);
});

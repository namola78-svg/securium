"use client";

import { useMemo, useState } from "react";

type CourseOption = {
  id: string;
  name: string;
  shortName: string;
  groupName: string;
};

type CurriculumTree = {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  version: string;
  sourceType: string | null;
  sourceDocument: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type CurriculumNode = {
  id: string;
  curriculumTreeId: string;
  parentId: string | null;
  nodeType: string;
  title: string;
  description: string;
  officialCode: string | null;
  officialTitle: string | null;
  sortOrder: number;
  depth: number;
  path: string | null;
  isRequired: boolean;
  isPractical: boolean;
  difficulty: string | null;
  importance: number | null;
  metadata: string | null;
  status: string;
};

const nodeTypes = [
  "TRACK",
  "SUBJECT",
  "DOMAIN",
  "MAJOR_ITEM",
  "SUB_ITEM",
  "STANDARD",
  "LIFECYCLE",
  "PRACTICAL",
  "MODULE",
  "CHAPTER",
  "CUSTOM",
] as const;

const treeStatuses = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
const nodeStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

export function AdminCurriculumManager({
  courses,
  trees,
  nodes,
  selectedTreeId,
}: {
  courses: CourseOption[];
  trees: CurriculumTree[];
  nodes: CurriculumNode[];
  selectedTreeId: string;
}) {
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const selectedTree = trees.find((tree) => tree.id === selectedTreeId) ?? null;
  const activeTreeByCourse = useMemo(() => {
    const map = new Map<string, CurriculumTree>();
    for (const tree of trees) {
      if (tree.status === "ACTIVE") map.set(tree.courseId, tree);
    }
    return map;
  }, [trees]);

  async function submitJson(
    endpoint: string,
    body: Record<string, unknown>,
    pendingLabel: string,
  ) {
    setPendingAction(pendingLabel);
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setMessage(payload.error ?? "요청을 처리하지 못했습니다.");
        return;
      }
      window.location.reload();
    } finally {
      setPendingAction("");
    }
  }

  async function saveTree(formData: FormData, tree?: CurriculumTree) {
    await submitJson(
      "/api/admin/curriculum-trees",
      {
        id: tree?.id,
        courseId: formData.get("courseId"),
        title: formData.get("title"),
        version: formData.get("version"),
        sourceType: formData.get("sourceType"),
        sourceDocument: formData.get("sourceDocument"),
        effectiveFrom: formData.get("effectiveFrom"),
        effectiveTo: formData.get("effectiveTo"),
        status: formData.get("status"),
      },
      tree ? "tree-update" : "tree-create",
    );
  }

  async function saveNode(formData: FormData, node?: CurriculumNode) {
    await submitJson(
      "/api/admin/curriculum-nodes",
      {
        id: node?.id,
        curriculumTreeId: selectedTreeId,
        parentId: formData.get("parentId"),
        nodeType: formData.get("nodeType"),
        title: formData.get("title"),
        description: formData.get("description"),
        officialCode: formData.get("officialCode"),
        officialTitle: formData.get("officialTitle"),
        sortOrder: formData.get("sortOrder"),
        isRequired: formData.get("isRequired") === "on",
        isPractical: formData.get("isPractical") === "on",
        difficulty: formData.get("difficulty"),
        importance: formData.get("importance"),
        metadata: formData.get("metadata"),
        status: formData.get("status"),
      },
      node ? `node-update-${node.id}` : "node-create",
    );
  }

  async function archiveNode(node: CurriculumNode) {
    await submitJson(
      "/api/admin/curriculum-nodes",
      { action: "archive", id: node.id },
      `node-archive-${node.id}`,
    );
  }

  return (
    <div className="curriculum-admin-grid">
      {message ? (
        <p className="inline-error curriculum-message" role="alert">
          {message}
        </p>
      ) : null}

      <section className="admin-panel">
        <h2>커리큘럼 트리</h2>
        <p className="admin-helper">
          과정별 공식·실무 커리큘럼 버전을 병렬로 관리합니다. 기존
          과목·주제·레슨 데이터는 이 화면에서 변경하지 않습니다.
        </p>
        <div className="admin-record-list">
          {trees.length ? (
            trees.map((tree) => (
              <article className="admin-record" key={tree.id}>
                <summary>
                  <span>
                    <strong>{tree.title}</strong>
                    <small>
                      {tree.courseName} · v{tree.version} · {tree.status}
                    </small>
                  </span>
                  <a className="text-link" href={`/admin/curriculum?treeId=${tree.id}`}>
                    선택
                  </a>
                </summary>
                {tree.id === selectedTreeId ? (
                  <TreeForm
                    courses={courses}
                    tree={tree}
                    activeTreeForCourse={activeTreeByCourse.get(tree.courseId)}
                    pending={pendingAction === "tree-update"}
                    onSubmit={(formData) => saveTree(formData, tree)}
                  />
                ) : null}
              </article>
            ))
          ) : (
            <p className="empty-copy">
              아직 등록된 커리큘럼 트리가 없습니다. 먼저 과정과 버전을
              선택해 트리를 생성하세요.
            </p>
          )}
        </div>
      </section>

      <section className="admin-panel">
        <h2>새 커리큘럼 트리 생성</h2>
        <TreeForm
          courses={courses}
          pending={pendingAction === "tree-create"}
          onSubmit={(formData) => saveTree(formData)}
        />
      </section>

      <section className="admin-panel curriculum-node-panel">
        <h2>노드 편집</h2>
        {selectedTree ? (
          <>
            <p className="admin-helper">
              선택된 트리: <strong>{selectedTree.title}</strong> ·{" "}
              {selectedTree.courseName}. 노드 이동 시 depth와 path는 서버에서
              재계산됩니다.
            </p>
            <NodeForm
              nodes={nodes}
              pending={pendingAction === "node-create"}
              onSubmit={(formData) => saveNode(formData)}
            />
          </>
        ) : (
          <p className="empty-copy">노드를 추가하려면 먼저 트리를 선택하세요.</p>
        )}
      </section>

      <section className="admin-panel curriculum-node-panel">
        <h2>노드 목록</h2>
        {selectedTree && nodes.length ? (
          <div className="admin-record-list">
            {nodes.map((node) => (
              <article className="admin-record" key={node.id}>
                <summary>
                  <span style={{ paddingLeft: `${node.depth * 18}px` }}>
                    <strong>{node.title}</strong>
                    <small>
                      depth {node.depth} · order {node.sortOrder} ·{" "}
                      {node.nodeType} · {node.status}
                    </small>
                  </span>
                  <span className="status-on">{node.path}</span>
                </summary>
                <NodeForm
                  nodes={nodes}
                  node={node}
                  pending={pendingAction === `node-update-${node.id}`}
                  onSubmit={(formData) => saveNode(formData, node)}
                />
                <div className="curriculum-node-actions">
                  <button
                    className="button button-ghost danger-button"
                    type="button"
                    disabled={Boolean(pendingAction)}
                    onClick={() => archiveNode(node)}
                  >
                    {pendingAction === `node-archive-${node.id}`
                      ? "보관 중..."
                      : "노드 보관"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-copy">
            선택한 트리에 등록된 노드가 없습니다. 상단 폼에서 루트 노드를
            먼저 추가하세요.
          </p>
        )}
      </section>
    </div>
  );
}

function TreeForm({
  courses,
  tree,
  activeTreeForCourse,
  pending,
  onSubmit,
}: {
  courses: CourseOption[];
  tree?: CurriculumTree;
  activeTreeForCourse?: CurriculumTree;
  pending: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <form className="admin-form" action={onSubmit}>
      <label>
        과정
        <select name="courseId" required defaultValue={tree?.courseId ?? ""}>
          <option value="">과정 선택</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.groupName} · {course.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        상태
        <select name="status" defaultValue={tree?.status ?? "DRAFT"}>
          {treeStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label className="wide">
        트리 제목
        <input
          name="title"
          required
          minLength={2}
          maxLength={200}
          defaultValue={tree?.title}
          placeholder="예: ISMS-P 2026 통합 커리큘럼"
        />
      </label>
      <label>
        버전
        <input
          name="version"
          required
          maxLength={60}
          defaultValue={tree?.version}
          placeholder="2026.1"
        />
      </label>
      <label>
        출처 유형
        <input
          name="sourceType"
          maxLength={80}
          defaultValue={tree?.sourceType ?? ""}
          placeholder="INTERNAL_REVIEW"
        />
      </label>
      <label className="wide">
        출처 문서
        <input
          name="sourceDocument"
          maxLength={500}
          defaultValue={tree?.sourceDocument ?? ""}
          placeholder="관리 기준, 내부 설계서, 검수 문서 등"
        />
      </label>
      <label>
        적용 시작일
        <input
          name="effectiveFrom"
          type="date"
          defaultValue={tree?.effectiveFrom ?? ""}
        />
      </label>
      <label>
        적용 종료일
        <input
          name="effectiveTo"
          type="date"
          defaultValue={tree?.effectiveTo ?? ""}
        />
      </label>
      {tree && activeTreeForCourse && activeTreeForCourse.id !== tree.id ? (
        <p className="inline-error wide" role="alert">
          이 과정에는 이미 ACTIVE 트리가 있습니다. ACTIVE 전환 시 서버에서
          중복을 차단합니다.
        </p>
      ) : null}
      <button className="button button-dark" type="submit" disabled={pending}>
        {pending ? "저장 중..." : tree ? "트리 수정" : "트리 생성"}
      </button>
    </form>
  );
}

function NodeForm({
  nodes,
  node,
  pending,
  onSubmit,
}: {
  nodes: CurriculumNode[];
  node?: CurriculumNode;
  pending: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  const parentOptions = nodes.filter((candidate) => candidate.id !== node?.id);
  return (
    <form className="admin-form" action={onSubmit}>
      <label>
        부모 노드
        <select name="parentId" defaultValue={node?.parentId ?? ""}>
          <option value="">루트 노드</option>
          {parentOptions.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {"— ".repeat(candidate.depth)}
              {candidate.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        노드 유형
        <select name="nodeType" defaultValue={node?.nodeType ?? "MODULE"}>
          {nodeTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label className="wide">
        제목
        <input
          name="title"
          required
          minLength={2}
          maxLength={200}
          defaultValue={node?.title}
        />
      </label>
      <label className="wide">
        설명
        <textarea
          name="description"
          maxLength={5000}
          defaultValue={node?.description ?? ""}
        />
      </label>
      <label>
        공식 코드
        <input
          name="officialCode"
          maxLength={100}
          defaultValue={node?.officialCode ?? ""}
        />
      </label>
      <label>
        공식 제목
        <input
          name="officialTitle"
          maxLength={200}
          defaultValue={node?.officialTitle ?? ""}
        />
      </label>
      <label>
        정렬 순서
        <input
          name="sortOrder"
          type="number"
          min={0}
          max={100000}
          defaultValue={node?.sortOrder ?? 10}
          required
        />
      </label>
      <label>
        중요도
        <input
          name="importance"
          type="number"
          min={0}
          max={100}
          defaultValue={node?.importance ?? ""}
        />
      </label>
      <label>
        난이도
        <input
          name="difficulty"
          maxLength={40}
          defaultValue={node?.difficulty ?? ""}
        />
      </label>
      <label>
        상태
        <select name="status" defaultValue={node?.status ?? "ACTIVE"}>
          {nodeStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label className="wide">
        metadata JSON
        <textarea
          name="metadata"
          maxLength={20000}
          defaultValue={node?.metadata ?? ""}
          placeholder='{"tags":["sample"]}'
        />
      </label>
      <label className="check-label">
        <input
          name="isRequired"
          type="checkbox"
          defaultChecked={node?.isRequired ?? true}
        />
        필수 노드
      </label>
      <label className="check-label">
        <input
          name="isPractical"
          type="checkbox"
          defaultChecked={node?.isPractical ?? false}
        />
        실무형 노드
      </label>
      <button className="button button-dark" type="submit" disabled={pending}>
        {pending ? "저장 중..." : node ? "노드 수정" : "노드 생성"}
      </button>
    </form>
  );
}

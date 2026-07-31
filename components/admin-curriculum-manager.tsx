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

type LinkableContent = {
  type: "SUBJECT" | "TOPIC" | "LEARNING_UNIT" | "LESSON";
  id: string;
  title: string;
  subtitle: string;
  active: boolean;
  published: boolean;
  displayOrder: number;
};

type LinkedContent = Pick<LinkableContent, "type" | "id">;

type CurriculumNodeOperationalStat = {
  nodeId: string;
  questionCount: number;
  attemptCount: number;
  correctAttempts: number;
  accuracy: number;
  wrongQuestionCount: number;
  wrongAttemptCount: number;
  dueReviewCount: number;
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

const contentTypeLabels: Record<LinkableContent["type"], string> = {
  SUBJECT: "과목",
  TOPIC: "주제",
  LEARNING_UNIT: "학습 단위",
  LESSON: "레슨",
};

const officialSourceTypes = new Set(["OFFICIAL_EXAM_STANDARD"]);

export function AdminCurriculumManager({
  courses,
  trees,
  nodes,
  nodeStats,
  linkableContent,
  selectedTreeId,
}: {
  courses: CourseOption[];
  trees: CurriculumTree[];
  nodes: CurriculumNode[];
  nodeStats: CurriculumNodeOperationalStat[];
  linkableContent: LinkableContent[];
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
  const nodeStatsById = useMemo(
    () => new Map(nodeStats.map((stat) => [stat.nodeId, stat])),
    [nodeStats],
  );
  const selectedTreeSummary = selectedTree
    ? summarizeSelectedTree(selectedTree, nodes)
    : null;

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
        setMessage(
          payload.error ??
            "요청을 처리하지 못했습니다. 입력값을 확인한 뒤 다시 시도해 주세요.",
        );
        return;
      }
      window.location.reload();
    } catch {
      setMessage("네트워크 상태를 확인한 뒤 다시 시도해 주세요.");
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
        metadata: buildNodeMetadata(
          node?.metadata,
          formData.getAll("linkedContent").map(String),
          String(formData.get("metadata") ?? ""),
        ),
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
          과정별 공식·실무 커리큘럼 버전과 계층 노드를 관리합니다. DRAFT
          트리는 학습자에게 공개되지 않으며, 검토가 끝난 트리만 ACTIVE로
          전환합니다.
        </p>
        <div className="admin-record-list">
          {trees.length ? (
            trees.map((tree) => (
              <article className="admin-record" key={tree.id}>
                <div className="admin-record-summary">
                  <span>
                    <strong>{tree.title}</strong>
                    <small>
                      {tree.courseName} · v{tree.version} · {tree.status}
                      {isOfficialTree(tree) ? " · 공식 출제기준" : ""}
                    </small>
                  </span>
                  <a
                    className="text-link"
                    href={`/admin/curriculum?treeId=${tree.id}`}
                  >
                    선택
                  </a>
                </div>
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
              아직 등록된 커리큘럼 트리가 없습니다. 과정과 버전을 선택해
              트리를 생성해 주세요.
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
        <h2>선택 트리 검토</h2>
        {selectedTree && selectedTreeSummary ? (
          <>
            <p className="admin-helper">
              선택 트리: <strong>{selectedTree.title}</strong> ·{" "}
              {selectedTree.courseName}. 노드의 depth와 path는 서버에서
              계산합니다.
            </p>
            <dl className="curriculum-admin-node-stats">
              <div>
                <dt>상태</dt>
                <dd>{selectedTree.status}</dd>
              </div>
              <div>
                <dt>전체 노드</dt>
                <dd>{selectedTreeSummary.totalNodes}</dd>
              </div>
              <div>
                <dt>필기 과목</dt>
                <dd>{selectedTreeSummary.writtenSubjects}</dd>
              </div>
              <div>
                <dt>실기 노드</dt>
                <dd>{selectedTreeSummary.practicalNodes}</dd>
              </div>
              <div>
                <dt>공식 기준</dt>
                <dd>{isOfficialTree(selectedTree) ? "예" : "아니오"}</dd>
              </div>
            </dl>
            <NodeForm
              nodes={nodes}
              linkableContent={linkableContent}
              pending={pendingAction === "node-create"}
              onSubmit={(formData) => saveNode(formData)}
            />
          </>
        ) : (
          <p className="empty-copy">
            노드를 추가하려면 먼저 커리큘럼 트리를 선택해 주세요.
          </p>
        )}
      </section>

      <section className="admin-panel curriculum-node-panel">
        <h2>노드 목록</h2>
        {selectedTree && nodes.length ? (
          <div className="admin-record-list">
            {nodes.map((node) => {
              const stat = nodeStatsById.get(node.id);
              return (
                <article className="admin-record" key={node.id}>
                  <div className="admin-record-summary">
                    <span style={{ paddingLeft: `${node.depth * 18}px` }}>
                      <strong>{node.title}</strong>
                      <small>
                        depth {node.depth} · order {node.sortOrder} ·{" "}
                        {node.nodeType} · {node.status}
                      </small>
                      <small>{linkedContentSummary(node.metadata)}</small>
                    </span>
                    <span className="status-on">{node.path}</span>
                  </div>
                  {stat ? <NodeOperationalStats stat={stat} /> : null}
                  <NodeForm
                    nodes={nodes}
                    linkableContent={linkableContent}
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
                        ? "보관 중…"
                        : "노드 보관"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="empty-copy">
            선택한 트리에 등록된 노드가 없습니다. 위에서 루트 노드를 먼저
            추가해 주세요.
          </p>
        )}
      </section>
    </div>
  );
}

function NodeOperationalStats({
  stat,
}: {
  stat: CurriculumNodeOperationalStat;
}) {
  return (
    <dl className="curriculum-admin-node-stats" aria-label="노드 운영 통계">
      <div>
        <dt>연결 문항</dt>
        <dd>{stat.questionCount}</dd>
      </div>
      <div>
        <dt>응시</dt>
        <dd>{stat.attemptCount}</dd>
      </div>
      <div>
        <dt>정답률</dt>
        <dd>{stat.accuracy}%</dd>
      </div>
      <div>
        <dt>오답 기록</dt>
        <dd>{stat.wrongAttemptCount}</dd>
      </div>
      <div>
        <dt>오답 문항</dt>
        <dd>{stat.wrongQuestionCount}</dd>
      </div>
      <div>
        <dt>복습 예정</dt>
        <dd>{stat.dueReviewCount}</dd>
      </div>
    </dl>
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
          placeholder="예: 정보보안기사 2027~2029 공식 출제기준"
        />
      </label>
      <label>
        버전
        <input
          name="version"
          required
          maxLength={60}
          defaultValue={tree?.version}
          placeholder="2027-2029"
        />
      </label>
      <label>
        출처 유형
        <input
          name="sourceType"
          maxLength={80}
          defaultValue={tree?.sourceType ?? ""}
          placeholder="OFFICIAL_EXAM_STANDARD"
        />
      </label>
      <label className="wide">
        출처 문서
        <input
          name="sourceDocument"
          maxLength={500}
          defaultValue={tree?.sourceDocument ?? ""}
          placeholder="예: 정보보안기사 필기·실기 출제기준"
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
        {pending ? "저장 중…" : tree ? "트리 수정" : "트리 생성"}
      </button>
    </form>
  );
}

function NodeForm({
  nodes,
  linkableContent,
  node,
  pending,
  onSubmit,
}: {
  nodes: CurriculumNode[];
  linkableContent: LinkableContent[];
  node?: CurriculumNode;
  pending: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  const parentOptions = nodes.filter((candidate) => candidate.id !== node?.id);
  const linkedKeys = new Set(
    parseLinkedContent(node?.metadata).map((link) => linkKey(link)),
  );
  const groupedContent = groupLinkableContent(linkableContent);

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
      <fieldset className="wide curriculum-link-fieldset">
        <legend>기존 콘텐츠 연결</legend>
        <p className="admin-helper">
          이 노드가 대표하는 기존 과목·주제·학습 단위·레슨을 선택합니다.
          같은 과정의 콘텐츠만 표시됩니다.
        </p>
        {linkableContent.length ? (
          Object.entries(groupedContent).map(([type, items]) => (
            <div className="curriculum-link-group" key={type}>
              <h3>{contentTypeLabels[type as LinkableContent["type"]]}</h3>
              <div className="curriculum-link-options">
                {items.map((item) => (
                  <label className="check-label" key={linkKey(item)}>
                    <input
                      name="linkedContent"
                      type="checkbox"
                      value={linkKey(item)}
                      defaultChecked={linkedKeys.has(linkKey(item))}
                    />
                    <span>
                      {item.title}
                      <small>
                        {item.subtitle}
                        {!item.active ? " · 비활성" : ""}
                        {!item.published &&
                        item.type !== "SUBJECT" &&
                        item.type !== "TOPIC"
                          ? " · 비공개"
                          : ""}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="empty-copy">
            이 과정에 연결할 기존 콘텐츠가 없습니다.
          </p>
        )}
      </fieldset>
      <label className="wide">
        추가 metadata JSON
        <textarea
          name="metadata"
          maxLength={20000}
          defaultValue={stripLinkedContent(node?.metadata)}
          placeholder='{"tags":["review-priority"]}'
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
        {pending ? "저장 중…" : node ? "노드 수정" : "노드 생성"}
      </button>
    </form>
  );
}

function summarizeSelectedTree(tree: CurriculumTree, nodes: CurriculumNode[]) {
  const writtenTrack = nodes.find(
    (node) =>
      node.curriculumTreeId === tree.id &&
      node.parentId === null &&
      node.title === "필기",
  );
  const writtenSubjects = writtenTrack
    ? nodes.filter(
        (node) => node.parentId === writtenTrack.id && node.nodeType === "SUBJECT",
      ).length
    : 0;

  return {
    totalNodes: nodes.length,
    writtenSubjects,
    practicalNodes: nodes.filter((node) => node.isPractical).length,
  };
}

function isOfficialTree(tree: CurriculumTree) {
  return Boolean(tree.sourceType && officialSourceTypes.has(tree.sourceType));
}

function groupLinkableContent(items: LinkableContent[]) {
  return items.reduce<Record<LinkableContent["type"], LinkableContent[]>>(
    (groups, item) => {
      groups[item.type].push(item);
      return groups;
    },
    {
      SUBJECT: [],
      TOPIC: [],
      LEARNING_UNIT: [],
      LESSON: [],
    },
  );
}

function parseMetadata(metadata: string | null | undefined) {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function parseLinkedContent(metadata: string | null | undefined): LinkedContent[] {
  const parsed = parseMetadata(metadata) as {
    linkedContent?: Array<{ type?: unknown; id?: unknown }>;
  };
  if (!Array.isArray(parsed.linkedContent)) return [];
  return parsed.linkedContent.filter(
    (link): link is LinkedContent =>
      typeof link.type === "string" &&
      typeof link.id === "string" &&
      ["SUBJECT", "TOPIC", "LEARNING_UNIT", "LESSON"].includes(link.type),
  );
}

function stripLinkedContent(metadata: string | null | undefined) {
  const parsed = parseMetadata(metadata);
  delete parsed.linkedContent;
  return Object.keys(parsed).length ? JSON.stringify(parsed, null, 2) : "";
}

function buildNodeMetadata(
  existingMetadata: string | null | undefined,
  selectedKeys: string[],
  metadataText: string,
) {
  const base = parseMetadata(existingMetadata);
  const links = selectedKeys
    .map(parseLinkKey)
    .filter((link): link is LinkedContent => Boolean(link));
  if (links.length) {
    base.linkedContent = links;
  } else {
    delete base.linkedContent;
  }
  const extra = parseMetadata(metadataText);
  return JSON.stringify({ ...extra, linkedContent: base.linkedContent ?? [] });
}

function parseLinkKey(value: string) {
  const [type, id] = value.split(":", 2);
  if (
    !id ||
    !["SUBJECT", "TOPIC", "LEARNING_UNIT", "LESSON"].includes(type)
  ) {
    return null;
  }
  return { type: type as LinkedContent["type"], id };
}

function linkKey(link: LinkedContent) {
  return `${link.type}:${link.id}`;
}

function linkedContentSummary(metadata: string | null) {
  const links = parseLinkedContent(metadata);
  if (!links.length) return "연결 콘텐츠 없음";
  const counts = links.reduce<Record<string, number>>((summary, link) => {
    summary[link.type] = (summary[link.type] ?? 0) + 1;
    return summary;
  }, {});
  return Object.entries(counts)
    .map(
      ([type, count]) =>
        `${contentTypeLabels[type as LinkableContent["type"]] ?? type} ${count}`,
    )
    .join(" · ");
}

"use client";

import { useMemo, useState } from "react";
import {
  recommendLinkableContentForNode,
  recommendationReasonLabel,
  recommendableContentKey,
  type LinkableContentRecommendation,
} from "@/lib/curriculum/content-recommendations";
import {
  curriculumStatusLabel,
  sourcePageLabel,
} from "@/lib/curriculum/display-labels";

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

type OntologyCoverageSummary = {
  treeId: string;
  courseId: string;
  totalNodeCount: number;
  requiredNodeCount: number;
  linkedCurriculumNodeCount: number;
  courseLessonEdgeCount: number;
  conceptEdgeCount: number;
  questionContentEdgeCount: number;
  questionConceptEdgeCount: number;
  gapCount: number;
  topGapIds: string[];
};

type OntologyCoverageGap = {
  id: string;
  courseId: string;
  title: string;
  nodeType: string;
  depth?: number;
  required?: boolean;
  score: number;
  reasons: string[];
};

type NodeMetadata = {
  officialLevel?: string;
  sourceDocument?: string;
  sourcePage?: number | string;
  sourcePages?: Array<number | string>;
  pdfPage?: number | string;
  pageNumber?: number | string;
  pageNumbers?: Array<number | string>;
  notes?: string | null;
  needsPdfVerification?: boolean;
};

type VisibleNode = {
  node: CurriculumNode;
  hasChildren: boolean;
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

const nodeTypeLabels: Record<string, string> = {
  TRACK: "트랙",
  SUBJECT: "과목",
  DOMAIN: "영역",
  MAJOR_ITEM: "주요항목",
  SUB_ITEM: "세부항목",
  STANDARD: "세세항목",
  LIFECYCLE: "생애주기",
  PRACTICAL: "실기",
  MODULE: "모듈",
  CHAPTER: "장",
  CUSTOM: "사용자 정의",
};

const officialLevelLabels: Record<string, string> = {
  EXAM_TRACK: "필기/실기",
  SUBJECT: "과목",
  PRACTICAL_DOMAIN: "실기 영역",
  MAJOR_ITEM: "주요항목",
  SUB_ITEM: "세부항목",
  DETAIL_ITEM: "세세항목",
  PERFORMANCE_CRITERION: "수행준거",
};

const officialSourceTypes = new Set(["OFFICIAL_EXAM_STANDARD"]);
const emptySelectedLinkKeys: string[] = [];

export function AdminCurriculumManager({
  courses,
  trees,
  nodes,
  nodeStats,
  linkableContent,
  ontologyCoverageSummaries,
  ontologyGaps,
  selectedTreeId,
}: {
  courses: CourseOption[];
  trees: CurriculumTree[];
  nodes: CurriculumNode[];
  nodeStats: CurriculumNodeOperationalStat[];
  linkableContent: LinkableContent[];
  ontologyCoverageSummaries: OntologyCoverageSummary[];
  ontologyGaps: OntologyCoverageGap[];
  selectedTreeId: string;
}) {
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    () => defaultExpandedNodeIds(nodes),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    () => nodes[0]?.id ?? "",
  );
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
  const selectedOntologySummary =
    ontologyCoverageSummaries.find((summary) => summary.treeId === selectedTreeId) ??
    null;
  const treeModel = useMemo(() => buildTreeModel(nodes), [nodes]);
  const visibleNodes = useMemo(
    () => flattenVisibleNodes(treeModel.rootNodes, treeModel.childrenByParent, expandedNodeIds),
    [expandedNodeIds, treeModel],
  );
  const selectedNode =
    nodes.find((node) => node.id === selectedNodeId) ?? nodes[0] ?? null;
  const selectedNodeStat = selectedNode ? nodeStatsById.get(selectedNode.id) : null;

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
            "요청을 처리하지 못했습니다. 입력값을 확인하고 다시 시도해 주세요.",
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

  function toggleNode(nodeId: string) {
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  function expandAll() {
    setExpandedNodeIds(new Set(nodes.map((node) => node.id)));
  }

  function collapseToSubjects() {
    setExpandedNodeIds(defaultExpandedNodeIds(nodes));
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
          과정별 공식·실무 커리큘럼 버전과 계층 노드를 관리합니다. 초안
          트리는 학습자에게 공개되지 않으며, 검증이 끝난 트리만 활성 상태로
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
        <div className="curriculum-tree-header">
          <div>
            <h2>커리큘럼 노드 검토</h2>
            {selectedTree && selectedTreeSummary ? (
              <p className="admin-helper">
                선택 트리: <strong>{selectedTree.title}</strong> ·{" "}
                {selectedTree.courseName}
              </p>
            ) : (
              <p className="admin-helper">
                노드를 추가하거나 검토하려면 커리큘럼 트리를 선택해 주세요.
              </p>
            )}
          </div>
          <div className="curriculum-tree-actions">
            <button className="button button-ghost" type="button" onClick={expandAll}>
              전체 펼치기
            </button>
            <button
              className="button button-ghost"
              type="button"
              onClick={collapseToSubjects}
            >
              과목까지만 보기
            </button>
          </div>
        </div>

        {selectedTree && selectedTreeSummary ? (
          <>
            <dl className="curriculum-admin-node-stats compact-summary">
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

            <OntologyCoveragePanel
              summary={selectedOntologySummary}
              gaps={ontologyGaps}
              onSelectNode={setSelectedNodeId}
            />

            <div className="curriculum-tree-workspace">
              <p className="sr-only" id="curriculum-tree-instructions">
                노드를 선택하면 선택 노드 상세 패널이 갱신됩니다. 펼치기 버튼으로 하위
                노드를 열고 닫을 수 있습니다.
              </p>
              <div
                className="curriculum-tree-list"
                role="tree"
                aria-label="커리큘럼 노드 목록"
                aria-describedby="curriculum-tree-instructions"
              >
                {visibleNodes.map(({ node, hasChildren }) => (
                  <CurriculumTreeRow
                    key={node.id}
                    node={node}
                    hasChildren={hasChildren}
                    expanded={expandedNodeIds.has(node.id)}
                    selected={selectedNode?.id === node.id}
                    onToggle={() => toggleNode(node.id)}
                    onSelect={() => setSelectedNodeId(node.id)}
                  />
                ))}
              </div>

              <aside
                className="curriculum-node-detail-panel"
                aria-label="선택 노드 상세"
                aria-live="polite"
                aria-busy={Boolean(pendingAction)}
              >
                {selectedNode ? (
                  <NodeDetailPanel
                    key={selectedNode.id}
                    node={selectedNode}
                    stat={selectedNodeStat}
                    pendingAction={pendingAction}
                    onArchive={() => archiveNode(selectedNode)}
                    onSave={(formData) => saveNode(formData, selectedNode)}
                    nodes={nodes}
                    linkableContent={linkableContent}
                  />
                ) : (
                  <p className="empty-copy">선택된 노드가 없습니다.</p>
                )}
              </aside>
            </div>

            <details
              className="admin-panel curriculum-create-node-panel"
              aria-labelledby="curriculum-create-node-title"
            >
              <summary id="curriculum-create-node-title">새 노드 추가</summary>
              <NodeForm
                nodes={nodes}
                linkableContent={linkableContent}
                pending={pendingAction === "node-create"}
                onSubmit={(formData) => saveNode(formData)}
              />
            </details>
          </>
        ) : (
          <p className="empty-copy">
            노드를 추가하려면 먼저 커리큘럼 트리를 선택해 주세요.
          </p>
        )}
      </section>
    </div>
  );
}

function OntologyCoveragePanel({
  summary,
  gaps,
  onSelectNode,
}: {
  summary: OntologyCoverageSummary | null;
  gaps: OntologyCoverageGap[];
  onSelectNode: (nodeId: string) => void;
}) {
  if (!summary) {
    return (
      <section className="curriculum-ontology-panel" aria-label="온톨로지 연결 검수">
        <div>
          <p className="eyebrow">ONTOLOGY COVERAGE</p>
          <h3>온톨로지 연결 검수</h3>
          <p className="admin-helper">
            현재 선택한 트리는 공식 정보보안기사·정보보안산업기사 온톨로지
            어댑터 대상이 아닙니다.
          </p>
        </div>
      </section>
    );
  }

  const linkedPercent = safePercent(
    summary.linkedCurriculumNodeCount,
    summary.totalNodeCount,
  );
  const topGaps = gaps.slice(0, 8);

  return (
    <section className="curriculum-ontology-panel" aria-label="온톨로지 연결 검수">
      <div className="curriculum-ontology-heading">
        <div>
          <p className="eyebrow">ONTOLOGY COVERAGE</p>
          <h3>온톨로지 연결 검수</h3>
          <p className="admin-helper">
            공식 커리큘럼 노드가 CourseLesson, 공통 콘텐츠, 핵심 개념까지
            이어지는지 확인합니다. DB 변경 없이 현재 코드 기반 어댑터의
            연결 상태만 표시합니다.
          </p>
        </div>
        <span className="status-badge compact">
          {summary.gapCount ? `Gap ${summary.gapCount}` : "연결 완료"}
        </span>
      </div>

      <dl className="curriculum-admin-node-stats ontology-summary">
        <div>
          <dt>노드 연결률</dt>
          <dd>{linkedPercent}%</dd>
        </div>
        <div>
          <dt>연결 노드</dt>
          <dd>
            {summary.linkedCurriculumNodeCount}/{summary.totalNodeCount}
          </dd>
        </div>
        <div>
          <dt>CourseLesson Edge</dt>
          <dd>{summary.courseLessonEdgeCount}</dd>
        </div>
        <div>
          <dt>Concept Edge</dt>
          <dd>{summary.conceptEdgeCount}</dd>
        </div>
        <div>
          <dt>Question→Content</dt>
          <dd>{summary.questionContentEdgeCount}</dd>
        </div>
        <div>
          <dt>Question→Concept</dt>
          <dd>{summary.questionConceptEdgeCount}</dd>
        </div>
      </dl>

      {topGaps.length ? (
        <div className="ontology-gap-list">
          <div className="ontology-gap-list-header">
            <strong>우선 연결 후보</strong>
            <small>점수가 높을수록 먼저 연결할 공식 노드입니다.</small>
          </div>
          {topGaps.map((gap) => (
            <button
              className="ontology-gap-item"
              key={gap.id}
              type="button"
              onClick={() => onSelectNode(gap.id)}
            >
              <span>
                <strong>{gap.title}</strong>
                <small>
                  {nodeTypeLabels[gap.nodeType] ?? gap.nodeType}
                  {gap.required ? " · 필수" : ""}
                  {gap.depth !== undefined ? ` · depth ${gap.depth}` : ""}
                </small>
              </span>
              <span className="status-badge compact">우선순위 {gap.score}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="empty-copy">
          현재 어댑터 기준으로 우선 연결이 필요한 공식 노드가 없습니다.
        </p>
      )}
    </section>
  );
}

function CurriculumTreeRow({
  node,
  hasChildren,
  expanded,
  selected,
  onToggle,
  onSelect,
}: {
  node: CurriculumNode;
  hasChildren: boolean;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const metadata = parseMetadata(node.metadata) as NodeMetadata;
  const stableKey = node.officialCode ?? node.id;
  const metaId = `curriculum-node-meta-${node.id}`;
  const detailId = `curriculum-node-detail-${node.id}`;
  const [copied, setCopied] = useState(false);

  async function handleCopyStableKey() {
    const ok = await copyStableKey(stableKey);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div
      className={`curriculum-tree-row ${selected ? "selected" : ""}`}
      role="treeitem"
      aria-level={node.depth + 1}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={selected}
      style={{ "--node-depth": node.depth } as React.CSSProperties}
    >
      <button
        className="curriculum-tree-toggle"
        type="button"
        onClick={hasChildren ? onToggle : onSelect}
        aria-label={
          hasChildren
            ? `${officialNodeTitle(node)} ${expanded ? "접기" : "펼치기"}`
            : `${officialNodeTitle(node)} 선택`
        }
      >
        {hasChildren ? (expanded ? "−" : "+") : "•"}
      </button>
      <button
        className="curriculum-tree-main"
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${officialNodeTitle(node)} 노드 선택`}
        aria-describedby={metaId}
        aria-controls={selected ? detailId : undefined}
      >
        <span className="curriculum-tree-title-line">
          <span className="curriculum-node-sequence">{officialSequence(node)}</span>
          <strong>{officialNodeTitle(node)}</strong>
          <span className="status-badge compact">{nodeStatusLabel(node.status)}</span>
        </span>
        <span className="curriculum-tree-meta-line" id={metaId}>
          <span>{nodeDisplayType(node, metadata)}</span>
          <span>{sourcePageLabel(metadata)}</span>
          <span className="curriculum-stable-key">{stableKey}</span>
        </span>
      </button>
      <button
        className="curriculum-copy-button"
        type="button"
        onClick={handleCopyStableKey}
        title={copied ? "Stable Key 복사됨" : "Stable Key 복사"}
        aria-label={`Stable Key ${stableKey} ${copied ? "복사됨" : "복사"}`}
      >
        {copied ? "복사됨" : "복사"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? `${stableKey}가 클립보드에 복사되었습니다.` : ""}
      </span>
    </div>
  );
}

function NodeDetailPanel({
  node,
  stat,
  pendingAction,
  onArchive,
  onSave,
  nodes,
  linkableContent,
}: {
  node: CurriculumNode;
  stat: CurriculumNodeOperationalStat | undefined | null;
  pendingAction: string;
  onArchive: () => void;
  onSave: (formData: FormData) => void;
  nodes: CurriculumNode[];
  linkableContent: LinkableContent[];
}) {
  const metadata = parseMetadata(node.metadata) as NodeMetadata;
  const stableKey = node.officialCode ?? node.id;
  const detailId = `curriculum-node-detail-${node.id}`;
  const detailTitleId = `curriculum-node-detail-title-${node.id}`;
  const editPanelTitleId = `curriculum-node-edit-title-${node.id}`;
  const [recommendedLinkKeys, setRecommendedLinkKeys] = useState<string[]>([]);
  const [stableKeyCopied, setStableKeyCopied] = useState(false);
  const recommendations = recommendLinkableContentForNode({
    node,
    linkableContent,
    linkedKeys: parseLinkedContent(node.metadata).map((link) => linkKey(link)),
    limit: 5,
  });
  const selectedRecommendedContent = linkableContent.filter((item) =>
    recommendedLinkKeys.includes(linkKey(item)),
  );

  function selectRecommendedContent(item: LinkableContent) {
    const key = linkKey(item);
    setRecommendedLinkKeys((current) =>
      current.includes(key) ? current : [...current, key],
    );
  }

  async function handleCopyStableKey() {
    const ok = await copyStableKey(stableKey);
    if (!ok) return;
    setStableKeyCopied(true);
    window.setTimeout(() => setStableKeyCopied(false), 1800);
  }

  return (
    <div
      className="curriculum-node-detail"
      id={detailId}
      role="region"
      aria-labelledby={detailTitleId}
    >
      <div className="curriculum-node-detail-heading">
        <span className="eyebrow">{nodeDisplayType(node, metadata)}</span>
        <h3 id={detailTitleId}>{officialNodeTitle(node)}</h3>
        <span className="status-badge compact">{nodeStatusLabel(node.status)}</span>
      </div>

      <dl className="curriculum-node-detail-list">
        <div>
          <dt>공식 계층 순번</dt>
          <dd>{officialSequence(node)}</dd>
        </div>
        <div>
          <dt>Stable Key · 고유키</dt>
          <dd>
            <code>{stableKey}</code>
            <button
              className="text-link copy-inline"
              type="button"
              onClick={handleCopyStableKey}
              aria-label={`Stable Key ${stableKey} ${stableKeyCopied ? "복사됨" : "복사"}`}
            >
              {stableKeyCopied ? "복사됨" : "복사"}
            </button>
            <span className="sr-only" aria-live="polite">
              {stableKeyCopied ? `${stableKey}가 클립보드에 복사되었습니다.` : ""}
            </span>
          </dd>
        </div>
        <div>
          <dt>PDF 출처</dt>
          <dd>{sourcePageLabel(metadata)}</dd>
        </div>
        <div>
          <dt>연결 콘텐츠</dt>
          <dd>{linkedContentSummary(node.metadata)}</dd>
        </div>
        <div>
          <dt>계층 경로</dt>
          <dd>{node.path ?? "경로 없음"}</dd>
        </div>
        {metadata.notes ? (
          <div>
            <dt>비고</dt>
            <dd>{metadata.notes}</dd>
          </div>
        ) : null}
      </dl>

      {stat ? <NodeOperationalStats stat={stat} /> : null}

      <RecommendedLinkableContent
        recommendations={recommendations}
        linkedContent={parseLinkedContent(node.metadata)}
        selectedLinkKeys={recommendedLinkKeys}
        onSelectRecommendation={selectRecommendedContent}
      />

      <PendingLinkedContentPreview selectedContent={selectedRecommendedContent} />

      <details className="curriculum-node-edit-panel" aria-labelledby={editPanelTitleId}>
        <summary id={editPanelTitleId}>선택 노드 수정</summary>
        <NodeForm
          key={`${node.id}:${recommendedLinkKeys.join("|")}`}
          nodes={nodes}
          linkableContent={linkableContent}
          node={node}
          selectedLinkKeys={recommendedLinkKeys}
          pending={pendingAction === `node-update-${node.id}`}
          onSubmit={onSave}
        />
      </details>

      <div className="curriculum-node-actions">
        <button
          className="button button-ghost danger-button"
          type="button"
          disabled={Boolean(pendingAction)}
          onClick={onArchive}
        >
          {pendingAction === `node-archive-${node.id}` ? "보관 중..." : "노드 보관"}
        </button>
      </div>
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

function PendingLinkedContentPreview({
  selectedContent,
}: {
  selectedContent: LinkableContent[];
}) {
  if (!selectedContent.length) return null;

  return (
    <section
      className="curriculum-pending-link-preview"
      aria-label="저장 예정 콘텐츠 연결 미리보기"
    >
      <div>
        <h4>저장 예정 추가 연결</h4>
        <p className="admin-helper">
          아래 항목은 추천 후보에서 선택되어 수정 폼에 임시 반영된 콘텐츠입니다.
          저장 버튼을 누르기 전까지 실제 노드에는 반영되지 않습니다.
        </p>
      </div>
      <ul>
        {selectedContent.map((item) => (
          <li key={linkKey(item)}>
            <span>
              <strong>{item.title}</strong>
              <small>
                {contentTypeLabels[item.type]} · {item.subtitle}
              </small>
            </span>
            <span className="status-badge compact">추가 예정</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecommendedLinkableContent({
  recommendations,
  linkedContent,
  selectedLinkKeys,
  onSelectRecommendation,
}: {
  recommendations: Array<LinkableContentRecommendation<LinkableContent>>;
  linkedContent: LinkedContent[];
  selectedLinkKeys: string[];
  onSelectRecommendation: (
    item: LinkableContentRecommendation<LinkableContent>,
  ) => void;
}) {
  const [selectedType, setSelectedType] = useState<LinkableContent["type"] | "ALL">(
    "ALL",
  );
  const selectedKeySet = new Set(selectedLinkKeys);
  const recommendationTypes = recommendationFilterOptions(recommendations);
  const visibleRecommendations =
    selectedType === "ALL"
      ? recommendations
      : recommendations.filter((item) => item.type === selectedType);

  return (
    <section
      className="curriculum-content-recommendations"
      aria-label="연결 가능한 콘텐츠 추천"
    >
      <div className="curriculum-content-recommendations-heading">
        <div>
          <h4>연결 가능한 콘텐츠 후보</h4>
          <p className="admin-helper">
            노드명, 공식명, 설명, 경로를 기준으로 계산한 규칙 기반 후보입니다.
            저장은 아래 “선택 노드 수정”에서 확인 후 적용하세요.
          </p>
        </div>
        <span className="status-badge compact">
          연결 {linkedContent.length}
        </span>
      </div>

      {recommendations.length ? (
        <div
          className="curriculum-recommendation-filters"
          aria-label="추천 콘텐츠 유형 필터"
        >
          {recommendationTypes.map((option) => (
            <button
              className="curriculum-recommendation-filter"
              key={option.type}
              type="button"
              aria-pressed={selectedType === option.type}
              onClick={() => setSelectedType(option.type)}
            >
              <span>{option.label}</span>
              <small>{option.count}</small>
            </button>
          ))}
        </div>
      ) : null}

      {recommendations.length ? (
        <div className="curriculum-content-recommendation-list">
          {visibleRecommendations.map((item) => (
            <button
              className="curriculum-content-recommendation"
              key={linkKey(item)}
              type="button"
              disabled={selectedKeySet.has(linkKey(item))}
              onClick={() => onSelectRecommendation(item)}
            >
              <div>
                <strong>{item.title}</strong>
                <small>
                  {contentTypeLabels[item.type]} · {item.subtitle}
                </small>
              </div>
              <div className="curriculum-content-recommendation-meta">
                <span className="status-badge compact">우선순위 {item.score}</span>
                  {item.reasons.slice(0, 2).map((reason) => (
                    <span className="curriculum-reason-chip" key={reason}>
                      {recommendationReasonLabel(reason)}
                    </span>
                  ))}
                  {item.matchedKeywords.slice(0, 3).map((keyword) => (
                    <span className="curriculum-keyword-chip" key={keyword}>
                      {keyword}
                    </span>
                  ))}
                  {selectedKeySet.has(linkKey(item)) ? (
                    <span className="status-badge compact">선택됨</span>
                  ) : null}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="empty-copy">
          현재 노드에 자동으로 추천할 수 있는 미연결 콘텐츠가 없습니다.
        </p>
      )}
    </section>
  );
}

function recommendationFilterOptions(
  recommendations: Array<LinkableContentRecommendation<LinkableContent>>,
): Array<{ type: LinkableContent["type"] | "ALL"; label: string; count: number }> {
  const counts = recommendations.reduce<
    Record<LinkableContent["type"], number>
  >(
    (summary, recommendation) => {
      summary[recommendation.type] += 1;
      return summary;
    },
    {
      SUBJECT: 0,
      TOPIC: 0,
      LEARNING_UNIT: 0,
      LESSON: 0,
    },
  );

  return [
    { type: "ALL" as const, label: "전체", count: recommendations.length },
    ...Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({
        type: type as LinkableContent["type"],
        label: contentTypeLabels[type as LinkableContent["type"]],
        count,
      })),
  ];
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
              {curriculumStatusLabel(status)}
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
          이 과정에는 이미 활성 트리가 있습니다. 활성 전환 시 서버에서
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
  linkableContent,
  node,
  selectedLinkKeys,
  pending,
  onSubmit,
}: {
  nodes: CurriculumNode[];
  linkableContent: LinkableContent[];
  node?: CurriculumNode;
  selectedLinkKeys?: string[];
  pending: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  const parentOptions = nodes.filter((candidate) => candidate.id !== node?.id);
  const effectiveSelectedLinkKeys = selectedLinkKeys ?? emptySelectedLinkKeys;
  const initialLinkedKeys = useMemo(
    () =>
      new Set([
        ...parseLinkedContent(node?.metadata).map((link) => linkKey(link)),
        ...effectiveSelectedLinkKeys,
      ]),
    [node?.metadata, effectiveSelectedLinkKeys],
  );
  const [checkedLinkedKeys, setCheckedLinkedKeys] = useState<Set<string>>(
    () => initialLinkedKeys,
  );
  const groupedContent = groupLinkableContent(linkableContent);

  function toggleLinkedContent(key: string, checked: boolean) {
    setCheckedLinkedKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

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
              {nodeTypeLabels[type] ?? type}
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
              {curriculumStatusLabel(status)}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="wide curriculum-link-fieldset">
        <legend>기존 콘텐츠 연결</legend>
        <p className="admin-helper">
          이 노드가 대표하는 기존 과목·주제·학습 단위·레슨을 선택합니다.
          같은 과정의 콘텐츠만 표시합니다.
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
                      checked={checkedLinkedKeys.has(linkKey(item))}
                      onChange={(event) =>
                        toggleLinkedContent(linkKey(item), event.currentTarget.checked)
                      }
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
        {pending ? "저장 중..." : node ? "노드 수정" : "노드 생성"}
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

function buildTreeModel(nodes: CurriculumNode[]) {
  const childrenByParent = new Map<string | null, CurriculumNode[]>();
  for (const node of nodes) {
    const key = node.parentId ?? null;
    const siblings = childrenByParent.get(key) ?? [];
    siblings.push(node);
    childrenByParent.set(key, siblings);
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  }
  return {
    rootNodes: childrenByParent.get(null) ?? [],
    childrenByParent,
  };
}

function flattenVisibleNodes(
  rootNodes: CurriculumNode[],
  childrenByParent: Map<string | null, CurriculumNode[]>,
  expandedNodeIds: Set<string>,
) {
  const visible: VisibleNode[] = [];
  const visit = (node: CurriculumNode) => {
    const children = childrenByParent.get(node.id) ?? [];
    visible.push({ node, hasChildren: children.length > 0 });
    if (expandedNodeIds.has(node.id)) {
      children.forEach(visit);
    }
  };
  rootNodes.forEach(visit);
  return visible;
}

function defaultExpandedNodeIds(nodes: CurriculumNode[]) {
  return new Set(
    nodes
      .filter((node) => node.depth <= 1)
      .map((node) => node.id),
  );
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
  return recommendableContentKey(link);
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

function officialNodeTitle(node: CurriculumNode) {
  return node.officialTitle || node.title;
}

function officialSequence(node: CurriculumNode) {
  const stableKey = node.officialCode ?? node.id;
  const match = stableKey.match(/(?:ISE|ISIE)-\d{4}-\d{4}-(.+)$/i);
  if (match?.[1]) return match[1].replaceAll("-", ".");
  const path = node.path?.split("/").filter(Boolean).at(-1);
  return path ?? String(node.sortOrder);
}

function nodeDisplayType(node: CurriculumNode, metadata: NodeMetadata) {
  if (node.nodeType === "TRACK") return node.title;
  if (metadata.officialLevel && officialLevelLabels[metadata.officialLevel]) {
    return officialLevelLabels[metadata.officialLevel];
  }
  return nodeTypeLabels[node.nodeType] ?? node.nodeType;
}

function nodeStatusLabel(status: string) {
  return curriculumStatusLabel(status);
}

function safePercent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

async function copyStableKey(value: string) {
  try {
    if (!navigator.clipboard) return false;
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // Clipboard API가 제한된 환경에서는 조용히 무시한다.
    return false;
  }
}

"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { getCurriculumNodeLabel } from "@/lib/services/learn-overview-service";

type CurriculumPathNode = {
  id: string;
  nodeType: string;
  title: string;
  description: string;
  officialCode: string | null;
  officialTitle: string | null;
  metadata: string | null;
  depth: number;
  isRequired: boolean;
  isPractical: boolean;
  importance: number | null;
  linkedContent: Array<{ type: string; id: string }>;
  linkedContentCount: number;
  linkedLessonCount: number;
  completedLinkedLessons: number;
  linkedLessonProgressPercent: number;
  linkedLessons: Array<{ id: string; title: string; status: string }>;
  linkedLesson: { id: string; title: string } | null;
  questionStats: {
    questionCount: number;
    attemptCount: number;
    correctAttempts: number;
    accuracy: number;
    wrongQuestionCount: number;
    wrongAttemptCount: number;
    dueReviewCount: number;
  };
  children: CurriculumPathNode[];
};

type VisibleNode = {
  node: CurriculumPathNode;
  hasChildren: boolean;
};

type NodeDepthStyle = CSSProperties & {
  "--node-depth": number;
};

export function LearnCurriculumPathTree({
  courseSlug,
  nodes,
}: {
  courseSlug: string;
  nodes: CurriculumPathNode[];
}) {
  const allExpandableIds = useMemo(() => collectExpandableNodeIds(nodes), [nodes]);
  const allNodes = useMemo(() => flattenAllNodes(nodes), [nodes]);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    () => defaultExpandedNodeIds(nodes),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    () => allNodes[0]?.id ?? null,
  );
  const visibleNodes = useMemo(
    () => flattenVisibleNodes(nodes, expandedNodeIds),
    [expandedNodeIds, nodes],
  );
  const summary = useMemo(() => summarizeCurriculumPath(nodes), [nodes]);
  const selectedNode =
    allNodes.find((node) => node.id === selectedNodeId) ?? visibleNodes[0]?.node ?? null;

  function toggleNode(nodeId: string) {
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }

  return (
    <div className="learn-curriculum-compact learn-curriculum-path-tree">
      <div className="learn-curriculum-summary" aria-label="공식 커리큘럼 학습 요약">
        <div>
          <p className="eyebrow">OFFICIAL CURRICULUM PATH</p>
          <strong>공식 구조를 따라 학습하고, 연결된 레슨과 문제로 바로 이동합니다.</strong>
          <span>
            현재 선택: {selectedNode ? selectedNode.officialTitle || selectedNode.title : "없음"}
          </span>
        </div>
        <dl>
          <div>
            <dt>전체 노드</dt>
            <dd>{summary.totalNodes}개</dd>
          </div>
          <div>
            <dt>연결 레슨</dt>
            <dd>{summary.linkedLessons}개</dd>
          </div>
          <div>
            <dt>완료 레슨</dt>
            <dd>{summary.completedLessons}개</dd>
          </div>
          <div>
            <dt>연결 문제</dt>
            <dd>{summary.questionCount}개</dd>
          </div>
        </dl>
      </div>

      <div className="learn-curriculum-toolbar" aria-label="커리큘럼 표시 옵션">
        <button
          className="button button-ghost"
          type="button"
          onClick={() => setExpandedNodeIds(new Set(allExpandableIds))}
        >
          전체 펼치기
        </button>
        <button
          className="button button-ghost"
          type="button"
          onClick={() => setExpandedNodeIds(defaultExpandedNodeIds(nodes))}
        >
          과목까지만 보기
        </button>
        <button
          className="button button-ghost"
          type="button"
          onClick={() => setExpandedNodeIds(new Set())}
        >
          전체 접기
        </button>
      </div>

      <div className="learn-curriculum-layout">
        <div className="learn-curriculum-list" role="tree">
          {visibleNodes.map(({ node, hasChildren }) => (
            <LearnCurriculumPathRow
              courseSlug={courseSlug}
              expanded={expandedNodeIds.has(node.id)}
              hasChildren={hasChildren}
              key={node.id}
              node={node}
              onSelect={() => setSelectedNodeId(node.id)}
              onToggle={() => toggleNode(node.id)}
              selected={selectedNode?.id === node.id}
            />
          ))}
        </div>
        {selectedNode ? (
          <LearnCurriculumNodeDetail courseSlug={courseSlug} node={selectedNode} />
        ) : null}
      </div>
    </div>
  );
}

function LearnCurriculumPathRow({
  courseSlug,
  expanded,
  hasChildren,
  node,
  onSelect,
  onToggle,
  selected,
}: {
  courseSlug: string;
  expanded: boolean;
  hasChildren: boolean;
  node: CurriculumPathNode;
  onSelect: () => void;
  onToggle: () => void;
  selected: boolean;
}) {
  const nodeTitle = node.officialTitle || node.title;
  const practiceHref = getCurriculumPracticeHref(courseSlug, node);
  const sourcePage = getSourcePageLabel(node.metadata);
  const stableKey = getStableKey(node);
  const progressLabel = node.linkedLessonCount
    ? `${node.completedLinkedLessons}/${node.linkedLessonCount} 완료`
    : "레슨 연결 예정";

  return (
    <article
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={selected}
      className={`learn-curriculum-row${selected ? " is-selected" : ""}`}
      role="treeitem"
      tabIndex={0}
      style={{ "--node-depth": node.depth } as NodeDepthStyle}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      {hasChildren ? (
        <button
          aria-label={`${nodeTitle} ${expanded ? "접기" : "펼치기"}`}
          className="learn-curriculum-toggle"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
        >
          {expanded ? "−" : "+"}
        </button>
      ) : (
        <span className="learn-curriculum-leaf" aria-hidden="true" />
      )}
      <div className="learn-curriculum-main">
        <div className="learn-curriculum-title-line">
          <strong>{nodeTitle}</strong>
          {node.officialCode ? (
            <span className="learn-curriculum-code">공식 순번 {node.officialCode}</span>
          ) : null}
          <span className="badge">{getCurriculumNodeLabel(node.nodeType)}</span>
          <span className="badge">{progressLabel}</span>
        </div>
        <div className="learn-curriculum-key-line">
          <span>Stable Key</span>
          <code>{stableKey}</code>
          <CopyStableKeyButton stableKey={stableKey} />
        </div>
        <div className="learn-curriculum-meta-line">
          <span>{node.isRequired ? "필수" : "선택"}</span>
          {node.isPractical ? <span>실무</span> : null}
          {sourcePage ? <span>{sourcePage}</span> : null}
          {node.linkedLessonCount ? (
            <span>
              레슨 {node.completedLinkedLessons}/{node.linkedLessonCount} 완료 ·{" "}
              {node.linkedLessonProgressPercent}%
            </span>
          ) : (
            <span>연결 레슨 없음</span>
          )}
          {node.questionStats.questionCount ? (
            <span>문제 {node.questionStats.questionCount}개</span>
          ) : null}
          {node.importance !== null ? <span>중요도 {node.importance}</span> : null}
        </div>
        {node.description ? (
          <p className="learn-curriculum-description">{node.description}</p>
        ) : null}
      </div>
      <div className="learn-curriculum-actions">
        {node.linkedLesson ? (
          <Link
            className="button button-ghost"
            href={`/learn/${courseSlug}/course-lessons/${node.linkedLesson.id}`}
            onClick={(event) => event.stopPropagation()}
          >
            레슨 보기
          </Link>
        ) : null}
        {practiceHref ? (
          <Link
            className="button button-dark"
            href={practiceHref}
            onClick={(event) => event.stopPropagation()}
          >
            문제 풀기
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function LearnCurriculumNodeDetail({
  courseSlug,
  node,
}: {
  courseSlug: string;
  node: CurriculumPathNode;
}) {
  const title = node.officialTitle || node.title;
  const stableKey = getStableKey(node);
  const sourcePage = getSourcePageLabel(node.metadata);
  const practiceHref = getCurriculumPracticeHref(courseSlug, node);
  const nextAction = getCurriculumNodeNextAction(courseSlug, node, practiceHref);

  return (
    <aside className="learn-curriculum-detail" aria-label="선택한 커리큘럼 상세">
      <p className="eyebrow">CURRICULUM INSPECTOR</p>
      <h3>{title}</h3>
      <div className="learn-curriculum-next-card">
        <span className="badge">다음 학습</span>
        <strong>{nextAction.label}</strong>
        <p>{nextAction.description}</p>
        {nextAction.href ? (
          <Link className="button button-dark" href={nextAction.href}>
            바로 이동
          </Link>
        ) : (
          <button className="button button-disabled" type="button" disabled>
            콘텐츠 연결 예정
          </button>
        )}
      </div>
      <dl>
        <div>
          <dt>계층</dt>
          <dd>{getCurriculumNodeLabel(node.nodeType)}</dd>
        </div>
        {node.officialCode ? (
          <div>
            <dt>공식 순번</dt>
            <dd>{node.officialCode}</dd>
          </div>
        ) : null}
        <div>
          <dt>Stable Key</dt>
          <dd>
            <code>{stableKey}</code>
            <CopyStableKeyButton stableKey={stableKey} />
          </dd>
        </div>
        {sourcePage ? (
          <div>
            <dt>출처</dt>
            <dd>{sourcePage}</dd>
          </div>
        ) : null}
        <div>
          <dt>연결 레슨</dt>
          <dd>
            {node.linkedLessonCount
              ? `${node.completedLinkedLessons}/${node.linkedLessonCount} 완료`
              : "연결 레슨 없음"}
          </dd>
        </div>
        <div>
          <dt>문제</dt>
          <dd>{node.questionStats.questionCount}개</dd>
        </div>
      </dl>
      {node.description ? <p>{node.description}</p> : null}
      <div className="learn-curriculum-detail-actions">
        {node.linkedLesson ? (
          <Link
            className="button button-ghost"
            href={`/learn/${courseSlug}/course-lessons/${node.linkedLesson.id}`}
          >
            레슨 보기
          </Link>
        ) : null}
        {practiceHref ? (
          <Link className="button button-dark" href={practiceHref}>
            문제 풀기
          </Link>
        ) : null}
      </div>
    </aside>
  );
}

function CopyStableKeyButton({ stableKey }: { stableKey: string }) {
  const [copied, setCopied] = useState(false);

  async function copyStableKey() {
    try {
      await navigator.clipboard.writeText(stableKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      aria-label={`${stableKey} 복사`}
      className="learn-curriculum-copy"
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void copyStableKey();
      }}
    >
      {copied ? "복사됨" : "복사"}
    </button>
  );
}

function defaultExpandedNodeIds(nodes: CurriculumPathNode[]) {
  return new Set(
    flattenAllNodes(nodes)
      .filter((node) => node.children.length > 0 && node.depth === 0)
      .map((node) => node.id),
  );
}

function collectExpandableNodeIds(nodes: CurriculumPathNode[]) {
  return flattenAllNodes(nodes)
    .filter((node) => node.children.length > 0)
    .map((node) => node.id);
}

function flattenAllNodes(nodes: CurriculumPathNode[]) {
  const result: CurriculumPathNode[] = [];
  const visit = (node: CurriculumPathNode) => {
    result.push(node);
    for (const child of node.children) visit(child);
  };
  for (const node of nodes) visit(node);
  return result;
}

function flattenVisibleNodes(
  nodes: CurriculumPathNode[],
  expandedNodeIds: Set<string>,
) {
  const result: VisibleNode[] = [];
  const visit = (node: CurriculumPathNode) => {
    result.push({ node, hasChildren: node.children.length > 0 });
    if (!expandedNodeIds.has(node.id)) return;
    for (const child of node.children) visit(child);
  };
  for (const node of nodes) visit(node);
  return result;
}

function summarizeCurriculumPath(nodes: CurriculumPathNode[]) {
  const allNodes = flattenAllNodes(nodes);
  return allNodes.reduce(
    (summary, node) => ({
      totalNodes: summary.totalNodes + 1,
      linkedLessons: summary.linkedLessons + node.linkedLessonCount,
      completedLessons: summary.completedLessons + node.completedLinkedLessons,
      questionCount: summary.questionCount + node.questionStats.questionCount,
    }),
    {
      totalNodes: 0,
      linkedLessons: 0,
      completedLessons: 0,
      questionCount: 0,
    },
  );
}

function getCurriculumPracticeHref(
  courseSlug: string,
  node: CurriculumPathNode,
) {
  if (!node.questionStats.questionCount) return null;
  const topicLink = node.linkedContent.find((link) => link.type === "TOPIC");
  const subjectLink = node.linkedContent.find(
    (link) => link.type === "SUBJECT",
  );
  if (!subjectLink && !topicLink) return null;

  const params = new URLSearchParams({ count: "10" });
  if (subjectLink) params.set("subjectId", subjectLink.id);
  if (topicLink) params.set("topicId", topicLink.id);
  return `/practice/${courseSlug}?${params.toString()}`;
}

function getStableKey(node: CurriculumPathNode) {
  return node.officialCode || node.id;
}

function getCurriculumNodeNextAction(
  courseSlug: string,
  node: CurriculumPathNode,
  practiceHref: string | null,
) {
  if (node.linkedLesson) {
    return {
      href: `/learn/${courseSlug}/course-lessons/${node.linkedLesson.id}`,
      label: "연결된 이론 레슨부터 학습하세요",
      description: `${node.linkedLesson.title} 레슨으로 이동합니다.`,
    };
  }

  if (practiceHref) {
    return {
      href: practiceHref,
      label: "연결된 문제로 이해도를 확인하세요",
      description: `${node.questionStats.questionCount}개의 연결 문제 중 일부를 풀어봅니다.`,
    };
  }

  return {
    href: null,
    label: "연결된 학습 콘텐츠를 준비하고 있습니다",
    description:
      "공식 커리큘럼 위치는 확인할 수 있으며, 레슨과 문제 연결은 순차적으로 보강됩니다.",
  };
}

function getSourcePageLabel(metadata: string | null) {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as {
      sourcePages?: Array<number | string>;
      sourcePage?: number | string;
      pdfPage?: number | string;
      pageNumber?: number | string;
    };
    const values =
      parsed.sourcePages ??
      [parsed.sourcePage ?? parsed.pdfPage ?? parsed.pageNumber].filter(
        Boolean,
      );
    const pages = values
      .map((value) => String(value).trim())
      .filter(Boolean)
      .slice(0, 3);
    if (!pages.length) return null;
    return `PDF p.${pages.join(", ")}`;
  } catch {
    return null;
  }
}

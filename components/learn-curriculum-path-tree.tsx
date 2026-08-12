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
  questionStats: { questionCount: number; attemptCount: number; correctAttempts: number; accuracy: number; wrongQuestionCount: number; wrongAttemptCount: number; dueReviewCount: number };
  children: CurriculumPathNode[];
};

type DepthStyle = CSSProperties & { "--node-depth": number };

export function LearnCurriculumPathTree({ courseSlug, nodes }: { courseSlug: string; nodes: CurriculumPathNode[] }) {
  const allNodes = useMemo(() => flattenAllNodes(nodes), [nodes]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => defaultExpandedIds(nodes));
  const [selectedId, setSelectedId] = useState<string | null>(() => allNodes[0]?.id ?? null);
  const visibleNodes = useMemo(() => flattenVisibleNodes(nodes, expandedIds), [nodes, expandedIds]);
  const selected = allNodes.find((node) => node.id === selectedId) ?? null;
  const summary = useMemo(() => summarize(nodes), [nodes]);

  function toggle(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="learn-curriculum-path-tree">
      <dl className="learn-curriculum-summary" aria-label="전체 과정 구성 요약">
        <div><dt>학습 항목</dt><dd>{summary.totalNodes}개</dd></div>
        <div><dt>학습 자료</dt><dd>{summary.linkedLessons}개</dd></div>
        <div><dt>완료</dt><dd>{summary.completedLessons}개</dd></div>
        <div><dt>관련 문제</dt><dd>{summary.questionCount}개</dd></div>
      </dl>

      <div className="learn-curriculum-toolbar" aria-label="과정 구성 표시 옵션">
        <button type="button" onClick={() => setExpandedIds(defaultExpandedIds(nodes))}>기본 보기</button>
        <button type="button" onClick={() => setExpandedIds(new Set(allNodes.filter((node) => node.children.length).map((node) => node.id)))}>모두 펼치기</button>
      </div>

      <div className="learn-curriculum-layout">
        <ul className="learn-curriculum-list">
          {visibleNodes.map((node) => {
            const title = node.officialTitle || node.title;
            const hasChildren = node.children.length > 0;
            return (
              <li className={selected?.id === node.id ? "is-selected" : ""} key={node.id} style={{ "--node-depth": Math.min(node.depth, 3) } as DepthStyle}>
                {hasChildren ? (
                  <button className="learn-curriculum-toggle" type="button" aria-expanded={expandedIds.has(node.id)} aria-label={`${title} ${expandedIds.has(node.id) ? "접기" : "펼치기"}`} onClick={() => toggle(node.id)}>
                    {expandedIds.has(node.id) ? "−" : "+"}
                  </button>
                ) : <span className="learn-curriculum-leaf" aria-hidden="true" />}
                <button className="learn-curriculum-select" type="button" aria-pressed={selected?.id === node.id} onClick={() => setSelectedId(node.id)}>
                  <span>{getCurriculumNodeLabel(node.nodeType)}</span>
                  <strong>{title}</strong>
                  <small>{node.linkedLessonCount ? `학습 자료 ${node.completedLinkedLessons}/${node.linkedLessonCount} 완료` : "학습 자료 준비 중"}</small>
                </button>
              </li>
            );
          })}
        </ul>

        {selected ? <CurriculumDetail courseSlug={courseSlug} node={selected} /> : null}
      </div>
    </div>
  );
}

function CurriculumDetail({ courseSlug, node }: { courseSlug: string; node: CurriculumPathNode }) {
  const title = node.officialTitle || node.title;
  const practiceHref = getPracticeHref(courseSlug, node);
  const source = getSourceLabel(node.metadata);
  return (
    <aside className="learn-curriculum-detail" aria-label="선택한 학습 항목">
      <p>현재 선택</p>
      <h3>{title}</h3>
      {node.description ? <p>{node.description}</p> : null}
      <dl>
        <div><dt>구분</dt><dd>{getCurriculumNodeLabel(node.nodeType)}</dd></div>
        <div><dt>학습 상태</dt><dd>{node.linkedLessonCount ? `${node.completedLinkedLessons}/${node.linkedLessonCount} 완료` : "자료 준비 중"}</dd></div>
        {source ? <div><dt>참고 기준</dt><dd>{source}</dd></div> : null}
        {node.questionStats.questionCount ? <div><dt>관련 문제</dt><dd>{node.questionStats.questionCount}개</dd></div> : null}
      </dl>
      <div className="learn-curriculum-detail-actions">
        {node.linkedLesson ? <Link href={`/learn/${courseSlug}/course-lessons/${node.linkedLesson.id}`}>핵심 이론 보기</Link> : null}
        {practiceHref ? <Link href={practiceHref}>문제 풀기</Link> : null}
      </div>
    </aside>
  );
}

function flattenAllNodes(nodes: CurriculumPathNode[]) {
  const result: CurriculumPathNode[] = [];
  const visit = (node: CurriculumPathNode) => { result.push(node); node.children.forEach(visit); };
  nodes.forEach(visit);
  return result;
}

function flattenVisibleNodes(nodes: CurriculumPathNode[], expanded: Set<string>) {
  const result: CurriculumPathNode[] = [];
  const visit = (node: CurriculumPathNode) => { result.push(node); if (expanded.has(node.id)) node.children.forEach(visit); };
  nodes.forEach(visit);
  return result;
}

function defaultExpandedIds(nodes: CurriculumPathNode[]) {
  return new Set(flattenAllNodes(nodes).filter((node) => node.depth === 0 && node.children.length).map((node) => node.id));
}

function summarize(nodes: CurriculumPathNode[]) {
  return flattenAllNodes(nodes).reduce((result, node) => ({
    totalNodes: result.totalNodes + 1,
    linkedLessons: result.linkedLessons + node.linkedLessonCount,
    completedLessons: result.completedLessons + node.completedLinkedLessons,
    questionCount: result.questionCount + node.questionStats.questionCount,
  }), { totalNodes: 0, linkedLessons: 0, completedLessons: 0, questionCount: 0 });
}

function getPracticeHref(courseSlug: string, node: CurriculumPathNode) {
  if (!node.questionStats.questionCount) return null;
  const topic = node.linkedContent.find((link) => link.type === "TOPIC");
  const subject = node.linkedContent.find((link) => link.type === "SUBJECT");
  if (!topic && !subject) return null;
  const params = new URLSearchParams({ count: "10" });
  if (subject) params.set("subjectId", subject.id);
  if (topic) params.set("topicId", topic.id);
  return `/practice/${courseSlug}?${params.toString()}`;
}

function getSourceLabel(metadata: string | null) {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as { sourcePages?: Array<number | string>; sourcePage?: number | string; pdfPage?: number | string; pageNumber?: number | string };
    const values = parsed.sourcePages ?? [parsed.sourcePage ?? parsed.pdfPage ?? parsed.pageNumber].filter(Boolean);
    const pages = values.map(String).map((value) => value.trim()).filter(Boolean).slice(0, 3);
    return pages.length ? `공식 문서 ${pages.join(", ")}쪽` : null;
  } catch { return null; }
}

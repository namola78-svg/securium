import Link from "next/link";
import { notFound } from "next/navigation";

import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import {
  getCourseById,
  getSubjectById,
  listTopicsForSubject,
} from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

type PageProps = { params: Promise<{ subjectId: string }> };
type Topic = Awaited<ReturnType<typeof listTopicsForSubject>>[number];

export default async function AdminTopicsPage({ params }: PageProps) {
  await requireCatalogManager("/admin/courses");
  const { subjectId } = await params;
  const subject = await getSubjectById(subjectId);
  if (!subject) notFound();
  const [course, topics] = await Promise.all([
    getCourseById(subject.courseId),
    listTopicsForSubject(subject.id),
  ]);
  if (!course) notFound();
  const returnTo = `/admin/subjects/${subject.id}/topics`;

  const activeTopics = topics.filter((topic) => topic.active).length;
  const rootTopics = topics.filter((topic) => !topic.parentTopicId).length;
  const childTopics = topics.length - rootTopics;
  const firstTopic = topics[0];
  const topicNameById = new Map(topics.map((topic) => [topic.id, topic.name]));

  return (
    <>
      <SectionHeader
        eyebrow="TOPICS"
        title={`${subject.name} 주제 관리`}
        description="과목 하위 주제와 선택적 상위 주제 관계를 관리합니다. 이 구조는 커리큘럼 노드, 문제 분류, 학습 진도에 연결됩니다."
        breadcrumbs={[
          { label: "관리자", href: "/admin" },
          { label: "과정", href: "/admin/courses" },
          { label: course.name, href: `/admin/courses/${course.id}` },
          { label: "과목", href: `/admin/courses/${course.id}/subjects` },
          { label: subject.name, current: true },
        ]}
        actions={
          <>
            <StatusBadge tone="success">활성 {activeTopics}</StatusBadge>
            <StatusBadge tone="info">상위 {rootTopics}</StatusBadge>
          </>
        }
      />

      <PageToolbar
        secondary={
          <>
            <StatusBadge compact tone="brand">
              {subject.code}
            </StatusBadge>
            <StatusBadge compact tone="info">
              {topics.length}개 주제
            </StatusBadge>
          </>
        }
        primary={
          <>
            <Link className="button ghost" href={`/admin/courses/${course.id}/subjects`}>
              과목 목록
            </Link>
            <Link className="button ghost" href="/admin/curriculum">
              CurriculumTree
            </Link>
          </>
        }
      >
        <span>상위 주제를 선택하면 계층형 주제로 구성할 수 있습니다. 순환 구조는 서버 검증을 유지합니다.</span>
      </PageToolbar>

      <section className="stats-grid admin-stats" aria-label="주제 운영 현황">
        <MetricCard
          label="전체 주제"
          value={topics.length}
          description="삭제되지 않은 주제"
        />
        <MetricCard
          label="활성 주제"
          value={activeTopics}
          description="문제와 콘텐츠 분류에 사용할 수 있는 주제"
        />
        <MetricCard
          label="상위 주제"
          value={rootTopics}
          description="parentTopicId가 없는 1차 주제"
        />
        <MetricCard
          label="하위 주제"
          value={childTopics}
          description="상위 주제 아래에 연결된 주제"
        />
      </section>

      <WorkspaceLayout
        main={
          <>
            <section className="admin-panel">
              <div className="admin-section-heading">
                <div>
                  <p className="eyebrow">CREATE TOPIC</p>
                  <h2>새 주제 등록</h2>
                </div>
                <StatusBadge compact tone="brand">
                  과목 하위 단위
                </StatusBadge>
              </div>
              <TopicForm subjectId={subject.id} returnTo={returnTo} topics={topics} />
            </section>

            <section className="admin-panel">
              <div className="admin-section-heading">
                <div>
                  <p className="eyebrow">TOPIC LIST</p>
                  <h2>등록된 주제</h2>
                </div>
                <StatusBadge compact tone={topics.length ? "info" : "neutral"}>
                  {topics.length}건
                </StatusBadge>
              </div>

              {topics.length ? (
                <div className="admin-record-list">
                  {topics.map((topic) => (
                    <details key={topic.id} className="admin-record">
                      <summary>
                        <span>
                          <strong>{topic.name}</strong>
                          <small>
                            {topic.code} · 정렬 {topic.displayOrder}
                            {topic.parentTopicId
                              ? ` · 상위 ${topicNameById.get(topic.parentTopicId) ?? topic.parentTopicId}`
                              : " · 상위 없음"}
                          </small>
                        </span>
                        <StatusBadge compact tone={topic.active ? "success" : "neutral"}>
                          {topic.active ? "활성" : "비활성"}
                        </StatusBadge>
                      </summary>
                      <TopicForm
                        subjectId={subject.id}
                        returnTo={returnTo}
                        topics={topics}
                        topic={topic}
                      />
                    </details>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <strong>등록된 주제가 없습니다.</strong>
                  <p>주제를 등록하면 문제, 레슨, 커리큘럼 노드를 더 세밀하게 연결할 수 있습니다.</p>
                </div>
              )}
            </section>
          </>
        }
        inspector={
          <InspectorPanel
            eyebrow="INSPECTOR"
            title={firstTopic?.name ?? "주제 없음"}
            description={
              firstTopic?.description ||
              "주제를 등록하면 상위 관계와 분류 정보를 빠르게 확인할 수 있습니다."
            }
            badges={
              firstTopic
                ? [
                    {
                      label: firstTopic.active ? "활성" : "비활성",
                      tone: firstTopic.active ? "success" : "neutral",
                    },
                    {
                      label: firstTopic.parentTopicId ? "하위 주제" : "상위 주제",
                      tone: firstTopic.parentTopicId ? "info" : "brand",
                    },
                  ]
                : [{ label: "등록 필요", tone: "warning" }]
            }
            meta={
              firstTopic
                ? [
                    { label: "Topic ID", value: firstTopic.id },
                    { label: "과정", value: course.name },
                    { label: "과목", value: subject.name },
                    { label: "코드", value: firstTopic.code },
                    {
                      label: "상위 주제",
                      value: firstTopic.parentTopicId
                        ? (topicNameById.get(firstTopic.parentTopicId) ?? firstTopic.parentTopicId)
                        : "없음",
                    },
                    { label: "정렬순서", value: firstTopic.displayOrder },
                  ]
                : []
            }
            actions={
              <>
                <Link className="button ghost" href="/admin/curriculum">
                  커리큘럼 연결
                </Link>
                <Link className="button ghost" href="/admin/questions">
                  문제 연결 확인
                </Link>
              </>
            }
          >
            <div className="admin-record-list compact">
              <div className="admin-record">
                <span>분류 연결</span>
                <strong>주제는 문제·레슨·진도 집계의 세부 기준</strong>
                <small>과정별 통계와 취약 영역 분석에서 함께 사용됩니다.</small>
              </div>
              <div className="admin-record">
                <span>계층 관리</span>
                <strong>상위 주제 선택은 선택 사항</strong>
                <small>복잡한 구조가 필요할 때만 parentTopicId를 사용하세요.</small>
              </div>
            </div>
          </InspectorPanel>
        }
      />
    </>
  );
}

function TopicForm({
  subjectId,
  returnTo,
  topics,
  topic,
}: {
  subjectId: string;
  returnTo: string;
  topics: Topic[];
  topic?: Topic;
}) {
  return (
    <form className="admin-form" action="/api/admin/topics" method="post">
      {topic ? <input type="hidden" name="id" value={topic.id} /> : null}
      <input type="hidden" name="subjectId" value={subjectId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label>
        상위 주제
        <select name="parentTopicId" defaultValue={topic?.parentTopicId ?? ""}>
          <option value="">없음</option>
          {topics
            .filter((candidate) => candidate.id !== topic?.id)
            .map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        코드
        <input
          name="code"
          required
          pattern="[A-Z0-9_]+"
          minLength={2}
          maxLength={50}
          defaultValue={topic?.code}
          placeholder="TCP_IP"
        />
      </label>
      <label>
        이름
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={topic?.name}
          placeholder="TCP/IP 프로토콜"
        />
      </label>
      <label className="wide">
        설명
        <textarea
          name="description"
          maxLength={2000}
          defaultValue={topic?.description}
          placeholder="주제의 학습 범위와 연결될 콘텐츠 기준을 입력하세요."
        />
      </label>
      <label>
        정렬순서
        <input
          name="displayOrder"
          type="number"
          min={0}
          max={10000}
          required
          defaultValue={topic?.displayOrder ?? 0}
        />
      </label>
      <label className="check-label">
        <input name="active" type="checkbox" defaultChecked={topic?.active ?? true} />
        활성
      </label>
      <button className="button button-dark" type="submit">
        {topic ? "주제 변경 저장" : "주제 등록"}
      </button>
    </form>
  );
}

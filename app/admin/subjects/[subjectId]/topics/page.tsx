import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCourseById,
  getSubjectById,
  listTopicsForSubject,
} from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

type PageProps = { params: Promise<{ subjectId: string }> };

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

  return (
    <>
      <header className="admin-page-header">
        <Link
          className="breadcrumb"
          href={`/admin/courses/${course.id}/subjects`}
        >
          ← {course.name} 과목
        </Link>
        <p className="eyebrow">TOPICS</p>
        <h1>{subject.name} 주제 관리</h1>
        <p>상위 주제를 선택해 계층 구조로 구성할 수 있습니다.</p>
      </header>
      <section className="admin-panel">
        <h2>새 주제</h2>
        <TopicForm subjectId={subject.id} returnTo={returnTo} topics={topics} />
      </section>
      <section className="admin-panel">
        <h2>등록된 주제</h2>
        <div className="admin-record-list">
          {topics.map((topic) => (
            <details key={topic.id} className="admin-record">
              <summary>
                <span>
                  <strong>{topic.name}</strong>
                  <small>{topic.code}</small>
                </span>
                <span className={topic.active ? "status-on" : "status-off"}>
                  {topic.active ? "활성" : "비활성"}
                </span>
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
      </section>
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
  topics: Awaited<ReturnType<typeof listTopicsForSubject>>;
  topic?: Awaited<ReturnType<typeof listTopicsForSubject>>[number];
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
        <input name="code" required pattern="[A-Z0-9_]+" minLength={2} maxLength={50} defaultValue={topic?.code} />
      </label>
      <label>
        이름
        <input name="name" required minLength={2} maxLength={120} defaultValue={topic?.name} />
      </label>
      <label className="wide">
        설명
        <textarea name="description" maxLength={2000} defaultValue={topic?.description} />
      </label>
      <label>
        정렬순서
        <input name="displayOrder" type="number" min={0} max={10000} required defaultValue={topic?.displayOrder ?? 0} />
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

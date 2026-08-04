import Link from "next/link";
import { listCurriculumTrees } from "@/db/curriculum-repositories";
import { listAllCourseGroups, listAllCourses } from "@/db/repositories";
import { listSharedContents } from "@/db/shared-content-repositories";
import { requireCatalogManager } from "@/lib/auth";

export default async function AdminPage() {
  await requireCatalogManager("/admin");
  const [groups, courses, curriculumTrees, sharedContents] = await Promise.all([
    listAllCourseGroups(),
    listAllCourses(),
    listCurriculumTrees(),
    listSharedContents(),
  ]);

  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">OVERVIEW</p>
        <h1>관리자 대시보드</h1>
        <p>
          과정 구조, 커리큘럼 트리, 공통 콘텐츠, 온톨로지 연결 상태를
          관리합니다. 주요 관리자 작업은 감사로그에 기록됩니다.
        </p>
      </header>

      <section className="stats-grid admin-stats" aria-label="관리 현황 요약">
        <div className="stat-card">
          <span>과정군</span>
          <strong>{groups.length}</strong>
          <small>활성 {groups.filter((group) => group.active).length}</small>
        </div>
        <div className="stat-card">
          <span>전체 과정</span>
          <strong>{courses.length}</strong>
          <small>공개 {courses.filter((course) => course.published).length}</small>
        </div>
        <div className="stat-card">
          <span>커리큘럼 트리</span>
          <strong>{curriculumTrees.length}</strong>
          <small>
            ACTIVE{" "}
            {curriculumTrees.filter((tree) => tree.status === "ACTIVE").length}
          </small>
        </div>
        <div className="stat-card">
          <span>공통 콘텐츠</span>
          <strong>{sharedContents.length}</strong>
          <small>
            PUBLISHED{" "}
            {
              sharedContents.filter((content) => content.status === "PUBLISHED")
                .length
            }
          </small>
        </div>
      </section>

      <section className="admin-actions-grid" aria-label="관리자 작업 바로가기">
        <Link href="/admin/course-groups" className="admin-action-card">
          <span>01</span>
          <h2>과정군 관리</h2>
          <p>국가기술자격과 독립 전문과정의 상위 분류를 관리합니다.</p>
        </Link>
        <Link href="/admin/courses" className="admin-action-card">
          <span>02</span>
          <h2>과정 관리</h2>
          <p>과정 등록, 공개 상태, 활성 상태, 정렬 순서를 관리합니다.</p>
        </Link>
        <Link href="/admin/curriculum" className="admin-action-card">
          <span>03</span>
          <h2>커리큘럼 트리 관리</h2>
          <p>
            과정별 커리큘럼 버전과 계층 노드를 기존 학습 데이터와 분리해
            관리합니다.
          </p>
        </Link>
        <Link href="/admin/shared-content" className="admin-action-card">
          <span>04</span>
          <h2>공통 콘텐츠 관리</h2>
          <p>
            하나의 콘텐츠를 여러 과정의 CourseLesson으로 연결하고 과정별 보충
            설명을 분리합니다.
          </p>
        </Link>
        <Link href="/admin/ontology" className="admin-action-card">
          <span>05</span>
          <h2>Ontology 관리</h2>
          <p>
            Concept, alias, edge 연결 상태와 AI Retrieval 확장 근거를 검수하고
            상태 전환을 요청합니다.
          </p>
        </Link>
      </section>
    </>
  );
}

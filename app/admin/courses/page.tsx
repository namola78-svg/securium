import Link from "next/link";
import { listAllCourseGroups, listAllCourses } from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

export default async function AdminCoursesPage() {
  await requireCatalogManager("/admin/courses");
  const [groups, courses] = await Promise.all([
    listAllCourseGroups(),
    listAllCourses(),
  ]);

  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">COURSES</p>
        <h1>과정 관리</h1>
        <p>새 과정은 등록 즉시 공통 동적 라우트와 템플릿을 사용합니다.</p>
      </header>
      <section className="admin-panel">
        <h2>새 과정</h2>
        <CourseForm groups={groups} />
      </section>
      <section className="admin-panel">
        <h2>등록된 과정</h2>
        <div className="admin-table" role="table" aria-label="과정 목록">
          {courses.map((course) => (
            <div className="admin-table-row" role="row" key={course.id}>
              <div>
                <strong>{course.name}</strong>
                <small>
                  {course.groupName} · {course.code}
                </small>
              </div>
              <span>{course.published ? "공개" : "비공개"}</span>
              <span>{course.active ? "활성" : "비활성"}</span>
              <div className="row-actions">
                <Link className="text-link" href={`/admin/courses/${course.id}`}>
                  설정
                </Link>
                <Link
                  className="text-link"
                  href={`/admin/courses/${course.id}/subjects`}
                >
                  과목
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function CourseForm({
  groups,
  course,
}: {
  groups: Awaited<ReturnType<typeof listAllCourseGroups>>;
  course?: Awaited<ReturnType<typeof listAllCourses>>[number];
}) {
  return (
    <form className="admin-form" action="/api/admin/courses" method="post">
      {course ? <input type="hidden" name="id" value={course.id} /> : null}
      <input
        type="hidden"
        name="returnTo"
        value={course ? `/admin/courses/${course.id}` : "/admin/courses"}
      />
      <label>
        과정군
        <select name="courseGroupId" required defaultValue={course?.courseGroupId}>
          <option value="">선택</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        코드
        <input
          name="code"
          required
          minLength={2}
          maxLength={50}
          pattern="[A-Z0-9_]+"
          defaultValue={course?.code}
        />
      </label>
      <label>
        slug
        <input
          name="slug"
          required
          minLength={2}
          maxLength={100}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          defaultValue={course?.slug}
        />
      </label>
      <label>
        과정명
        <input name="name" required minLength={2} maxLength={120} defaultValue={course?.name} />
      </label>
      <label>
        짧은 이름
        <input name="shortName" required maxLength={50} defaultValue={course?.shortName} />
      </label>
      <label>
        난이도
        <select name="difficulty" defaultValue={course?.difficulty ?? "BEGINNER"}>
          <option value="BEGINNER">입문</option>
          <option value="INTERMEDIATE">중급</option>
          <option value="ADVANCED">심화</option>
        </select>
      </label>
      <label className="wide">
        설명
        <textarea name="description" maxLength={2000} defaultValue={course?.description} />
      </label>
      <label className="wide">
        썸네일 HTTPS URL
        <input name="thumbnailUrl" type="url" maxLength={500} defaultValue={course?.thumbnailUrl ?? ""} />
      </label>
      <label>
        전체 단계
        <input name="totalLevels" type="number" min={1} max={1000} defaultValue={course?.totalLevels ?? 100} required />
      </label>
      <label>
        통과 점수
        <input name="passingScore" type="number" min={0} max={100} defaultValue={course?.passingScore ?? 60} required />
      </label>
      <label>
        정렬순서
        <input name="displayOrder" type="number" min={0} max={10000} defaultValue={course?.displayOrder ?? 0} required />
      </label>
      <label className="check-label">
        <input name="active" type="checkbox" defaultChecked={course?.active ?? true} />
        활성
      </label>
      <label className="check-label">
        <input name="published" type="checkbox" defaultChecked={course?.published ?? false} />
        공개
      </label>
      <button className="button button-dark" type="submit">
        {course ? "과정 변경 저장" : "과정 등록"}
      </button>
    </form>
  );
}

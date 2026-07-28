import { listAllCourseGroups } from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

export default async function AdminCourseGroupsPage() {
  await requireCatalogManager("/admin/course-groups");
  const groups = await listAllCourseGroups();

  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">COURSE GROUPS</p>
        <h1>과정군 관리</h1>
        <p>삭제하지 않고 활성 상태와 정렬순서를 변경합니다.</p>
      </header>
      <section className="admin-panel">
        <h2>새 과정군</h2>
        <CourseGroupForm />
      </section>
      <section className="admin-panel">
        <h2>등록된 과정군</h2>
        <div className="admin-record-list">
          {groups.map((group) => (
            <details key={group.id} className="admin-record">
              <summary>
                <span>
                  <strong>{group.name}</strong>
                  <small>{group.code}</small>
                </span>
                <span className={group.active ? "status-on" : "status-off"}>
                  {group.active ? "활성" : "비활성"}
                </span>
              </summary>
              <CourseGroupForm group={group} />
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

function CourseGroupForm({
  group,
}: {
  group?: Awaited<ReturnType<typeof listAllCourseGroups>>[number];
}) {
  return (
    <form className="admin-form" action="/api/admin/course-groups" method="post">
      {group ? <input type="hidden" name="id" value={group.id} /> : null}
      <input type="hidden" name="returnTo" value="/admin/course-groups" />
      <label>
        코드
        <input
          name="code"
          required
          minLength={2}
          maxLength={50}
          pattern="[A-Z0-9_]+"
          defaultValue={group?.code}
          placeholder="PRIVACY_CERT"
        />
      </label>
      <label>
        이름
        <input
          name="name"
          required
          minLength={2}
          maxLength={100}
          defaultValue={group?.name}
        />
      </label>
      <label className="wide">
        설명
        <textarea name="description" maxLength={2000} defaultValue={group?.description} />
      </label>
      <label>
        정렬순서
        <input
          name="displayOrder"
          type="number"
          min={0}
          max={10000}
          required
          defaultValue={group?.displayOrder ?? 0}
        />
      </label>
      <label className="check-label">
        <input name="active" type="checkbox" defaultChecked={group?.active ?? true} />
        활성
      </label>
      <button className="button button-dark" type="submit">
        {group ? "변경 저장" : "과정군 등록"}
      </button>
    </form>
  );
}

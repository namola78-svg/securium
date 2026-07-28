import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import type { CourseListItem } from "@/db/repositories";
import { BRAND } from "@/lib/brand";
import { listPublishedCoursesCached } from "@/lib/cached-catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  let courses: CourseListItem[] = [];
  let databaseReady = true;
  try {
    courses = await listPublishedCoursesCached();
  } catch {
    databaseReady = false;
  }

  return (
    <main>
      <section className="hero">
        <div className="shell hero-grid">
          <div>
            <p className="eyebrow light">{BRAND.englishName}</p>
            <p className="hero-subtitle">{BRAND.systemLabel}</p>
            <h1>
              <span className="hero-title-line">정보보호 전문 자격 학습을</span>
              <br />
              <span>하나의 성장 체계로.</span>
            </h1>
            <p className="hero-copy">
              정보보호와 개인정보보호를
              <br />
              하나의 플랫폼에서 체계적으로 학습하세요.
            </p>
            <div className="button-row">
              <Link className="button button-lime" href="/courses">
                과정 둘러보기
              </Link>
              <Link className="button button-outline-light" href="/login">
                학습 시작하기
              </Link>
            </div>
          </div>
          <div className="hero-panel" aria-label="플랫폼 핵심 지표">
            <div className="hero-panel-header">
              <span>AI LEARNING PLATFORM</span>
            </div>
            <div className="metric-large">
              <strong>{databaseReady ? courses.length : "—"}</strong>
              <span>공개 과정</span>
            </div>
            <div className="signal-list">
              <div>
                <span>여러 전문과정을 한곳에서 학습</span>
                <strong>지원</strong>
              </div>
              <div>
                <span>과정별 학습 진도 자동 관리</span>
                <strong>적용</strong>
              </div>
              <div>
                <span>학습 콘텐츠를 준비하고 있습니다</span>
                <strong className="muted">개설 예정</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">COURSE CATALOG</p>
              <h2>한 계정으로 이어지는 전문 과정</h2>
            </div>
            <Link className="text-link" href="/courses">
              전체 과정 보기 →
            </Link>
          </div>
          {!databaseReady ? (
            <div className="notice warning">
              로컬 데이터베이스 준비가 필요합니다. README의 DB 설정 절차를
              실행하면 과정이 표시됩니다.
            </div>
          ) : courses.length ? (
            <div className="course-grid">
              {courses.slice(0, 3).map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>공개된 과정이 없습니다.</strong>
              <p>관리자가 과정을 공개하면 이곳에 표시됩니다.</p>
            </div>
          )}
        </div>
      </section>

    </main>
  );
}

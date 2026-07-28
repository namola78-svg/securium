import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import type { CourseListItem } from "@/db/repositories";
import { getOptionalCurrentAppUser } from "@/lib/auth";
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
  const user = await getOptionalCurrentAppUser();
  const primaryCtaHref = user ? "/dashboard" : "/signup";

  return (
    <main>
      <section className="hero">
        <div className="shell hero-grid">
          <div>
            <p className="eyebrow light">AI-POWERED SECURITY LEARNING</p>
            <h1>
              <span className="hero-title-line">정보보호 전문 역량을</span>
              <br />
              <span>하나의 학습 체계로.</span>
            </h1>
            <p className="hero-copy">
              자격시험, 실무사례, AI 튜터와 맞춤 복습을 연결하여
              <br />
              정보보호·개인정보보호 역량을 체계적으로 성장시키세요.
            </p>
            <div className="button-row">
              <Link className="button button-lime" href={primaryCtaHref}>
                무료로 학습 시작하기
              </Link>
              <Link className="button button-outline-light" href="/courses">
                과정 둘러보기
              </Link>
            </div>
            <ul className="hero-value-list" aria-label="핵심 학습 가치">
              <li>전문과정 통합 학습</li>
              <li>과정별 진도 자동 관리</li>
              <li>AI 기반 맞춤 설명</li>
              <li>오답 및 취약영역 복습</li>
            </ul>
          </div>
          <div className="hero-panel" aria-label="오늘의 학습 예시">
            <div className="hero-panel-header">
              <span>오늘의 학습</span>
              <span className="live-dot">맞춤 추천</span>
            </div>
            <div className="today-card-title">
              <span>ISMS-P</span>
              <strong>인증기준 2.6 접근통제</strong>
              <p>심사 관점과 실무 증적을 함께 점검합니다.</p>
            </div>
            <div className="hero-progress" aria-label="오늘의 학습 진행률 68%">
              <div>
                <span>진행률</span>
                <strong>68%</strong>
              </div>
              <div className="progress-track" aria-hidden="true">
                <span style={{ width: "68%" }} />
              </div>
            </div>
            <div className="signal-list">
              <div>
                <span>오늘의 추천</span>
                <strong>오답 5문제 복습</strong>
              </div>
              <div>
                <span>AI 튜터</span>
                <strong>취약 기준 설명</strong>
              </div>
              <div>
                <span>공개 과정</span>
                <strong>{databaseReady ? `${courses.length}개` : "확인 중"}</strong>
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

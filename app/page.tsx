import Link from "next/link";
import { redirect } from "next/navigation";
import { CourseCard } from "@/components/course-card";
import type { CourseListItem } from "@/db/repositories";
import { getOptionalCurrentAppUser } from "@/lib/auth";
import { listPublishedCoursesCached } from "@/lib/cached-catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getOptionalCurrentAppUser();
  if (user) redirect("/dashboard");

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
              <Link className="button button-lime" href="/signup">
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
                <span>학습 흐름</span>
                <strong>이론 → 문제 → 복습</strong>
              </div>
              <div>
                <span>AI 튜터</span>
                <strong>근거 기반 설명</strong>
              </div>
              <div>
                <span>공개 과정</span>
                <strong>{databaseReady ? `${courses.length}개` : "확인 중"}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section landing-value-section">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">WHY SECURIUM</p>
              <h2>시험 준비와 실무 역량을 같은 흐름으로 연결합니다</h2>
            </div>
          </div>
          <div className="value-grid">
            <article className="value-card">
              <span>01</span>
              <strong>과정별 진도 관리</strong>
              <p>
                여러 전문과정을 동시에 학습해도 수강, 문제풀이, 오답노트,
                복습 기록을 과정별로 분리해 관리합니다.
              </p>
            </article>
            <article className="value-card">
              <span>02</span>
              <strong>문제와 복습 중심 학습</strong>
              <p>
                풀이 기록과 오답을 기반으로 취약 영역을 확인하고, 오늘 다시
                볼 내용을 놓치지 않도록 정리합니다.
              </p>
            </article>
            <article className="value-card">
              <span>03</span>
              <strong>AI 학습 지원</strong>
              <p>
                공식 해설을 대체하지 않고, 검수된 근거 콘텐츠를 바탕으로
                개념 이해를 돕는 참고 설명을 제공합니다.
              </p>
            </article>
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

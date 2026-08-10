import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionButton } from "@/components/design-system-primitives";
import type { CourseListItem } from "@/db/repositories";
import { getOptionalCurrentAppUser } from "@/lib/auth";
import { listPublishedCoursesCached } from "@/lib/cached-catalog";
import { courseDescription, difficultyLabel, safeCount } from "@/lib/course-display";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "SECURIUM | 근거 기반 보안 학습",
  description: "공식 기준, 문제풀이, 복습을 하나의 흐름으로 연결하는 보안 학습 플랫폼입니다.",
};

const spotlightOrder = ["information-security-engineer", "isms-p", "cppg", "secure-coding-diagnostician"];

function getSpotlightCourses(courses: CourseListItem[]) {
  const bySlug = new Map(courses.map((course) => [course.slug, course]));
  const preferred = spotlightOrder.map((slug) => bySlug.get(slug)).filter((course): course is CourseListItem => Boolean(course));
  return [...preferred, ...courses.filter((course) => !spotlightOrder.includes(course.slug))].slice(0, 4);
}

export default async function Home() {
  if (await getOptionalCurrentAppUser()) redirect("/dashboard");
  let courses: CourseListItem[] = [];
  try { courses = await listPublishedCoursesCached(); } catch { /* catalog fallback keeps the landing page useful */ }
  const spotlightCourses = getSpotlightCourses(courses);

  return (
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="shell hero-grid">
          <div>
            <p className="eyebrow light">SECURIUM · 보안 학습 플랫폼</p>
            <h1 id="hero-title">공식 기준으로 배우고,<br /><span className="hero-title-line">근거와 함께 복습하세요.</span></h1>
            <p className="hero-copy">과정, 핵심 개념, 문제풀이, 오답 복습을 하나의 학습 흐름으로 연결합니다. AI 설명은 참고로 제공하고, 공식 근거와 검수 상태를 함께 보여드립니다.</p>
            <div className="button-row">
              <ActionButton href="/signup" variant="dark">무료로 시작하기</ActionButton>
              <ActionButton href="/courses" variant="outline">과정 둘러보기</ActionButton>
            </div>
            <ul className="hero-value-list" aria-label="SECURIUM의 핵심 가치">
              <li>공식 기준과 법령에 연결된 학습</li>
              <li>답안부터 해설까지 한 화면에서 확인</li>
              <li>오답과 취약 개념을 다음 행동으로 연결</li>
            </ul>
          </div>
          <aside className="hero-panel" aria-label="학습 흐름 미리보기">
            <div className="hero-panel-header"><span>공식 기준 기반 학습 흐름</span><span className="live-dot">검증 가능한 설명</span></div>
            <div className="today-card-title"><span>다음 행동</span><strong>기준 · 이론 · 문제 · 복습</strong><p>대시보드에서 오늘 할 일을 확인하고, 학습 기록에 따라 다음 행동을 바로 시작할 수 있습니다.</p></div>
            <div className="signal-list"><div><span>01</span><strong>과정과 기준 선택</strong></div><div><span>02</span><strong>개념을 문제로 확인</strong></div><div><span>03</span><strong>오답과 취약 영역 연결</strong></div></div>
            <div className="ai-result-card"><p className="eyebrow">AI 보조 설명 예시</p><h3>답만 제시하지 않고 왜 그런지 확인합니다.</h3><p>관련 기준과 핵심 개념을 연결하고, 출처와 참고 범위를 표시합니다.</p><div className="ai-result-grid"><div><span>01 · 질문</span><strong>문제의 핵심 조건 확인</strong></div><div><span>02 · 설명</span><strong>핵심 개념과 정답 이유</strong></div><div><span>03 · 근거</span><strong>공식 출처와 참고 범위</strong></div><div><span>04 · 다음 행동</span><strong>학습용 참고 설명 후 복습</strong></div></div></div>
          </aside>
        </div>
      </section>

      <section className="section landing-learning-chain" aria-labelledby="learning-flow-title"><div className="shell"><div className="section-heading"><div><p className="eyebrow">학습 연결 구조</p><h2 id="learning-flow-title">공식 기준에서 복습까지 이어집니다.</h2><p>과정 선택부터 복습까지, 화면마다 사용자가 해야 할 일을 하나의 주 행동으로 안내합니다.</p></div></div><ol className="learning-chain-list" aria-label="SECURIUM 학습 흐름"><li><span>01</span><strong>공식 기준</strong><p>학습의 기준과 범위를 확인합니다.</p></li><li><span>02</span><strong>핵심 이론</strong><p>과목과 주제를 따라 핵심 개념을 익힙니다.</p></li><li><span>03</span><strong>문제풀이</strong><p>실제 문제로 이해한 내용을 확인합니다.</p></li><li><span>04</span><strong>AI 보조</strong><p>정답의 이유와 참고 근거를 살펴봅니다.</p></li><li><span>05</span><strong>오답과 취약 영역 다시 학습</strong><p>취약한 개념을 다시 학습하고 다음 문제로 이어갑니다.</p></li></ol></div></section>

      <section className="section landing-dashboard-preview" aria-labelledby="dashboard-preview-title"><div className="shell dashboard-preview-grid"><div><p className="eyebrow">학습 대시보드</p><h2 id="dashboard-preview-title">로그인하면 오늘 할 일을 먼저 보여줍니다.</h2><p>이어서 학습, 오늘 문제, 예정 복습, 취약 영역을 한눈에 확인하고 바로 시작할 수 있습니다.</p><ActionButton href="/signup" variant="primary">무료로 시작하기</ActionButton></div><article className="learner-dashboard-card" aria-label="학습 대시보드 미리보기"><div className="learner-dashboard-card-header"><div><span>지금 할 일</span><strong>이어서 학습</strong></div><span className="dashboard-preview-badge">약 17분</span></div><div className="learner-dashboard-main"><div><span>01 · 이어서 학습</span><strong>네트워크 보안 핵심 개념</strong><p>마지막 학습 지점부터 바로 이어갑니다.</p></div><span className="dashboard-preview-progress">68%</span></div><div className="learner-dashboard-subgrid"><div><span>02 · 복습</span><strong>12문제</strong></div><div><span>취약 영역</span><strong>3개</strong></div><div><span>오늘 목표</span><strong>4/10</strong></div></div></article></div></section>

      <section className="landing-course-spotlight" aria-labelledby="course-preview-title"><div className="shell"><div className="section-heading compact"><div><p className="eyebrow">목표별 학습 경로</p><h2 id="course-preview-title">지금 준비할 목표를 선택하세요.</h2><p>실제 공개된 과목·주제·문제 수를 확인하고 시작할 수 있습니다.</p></div><ActionButton href="/courses" variant="ghost">모든 과정 보기</ActionButton></div>{spotlightCourses.length ? <div className="course-grid">{spotlightCourses.map((course) => <article className="course-card" key={course.id}><div className="course-card-top"><span className="course-code">{course.groupName ?? "SECURIUM"}</span><span className="badge">{difficultyLabel(course.difficulty)}</span></div><h3>{course.name}</h3><p>{courseDescription(course.description)}</p><dl className="course-stats"><div><dt>추천 대상</dt><dd>{course.groupName ?? "학습자"}</dd></div><div><dt>난이도</dt><dd>{difficultyLabel(course.difficulty)}</dd></div><div><dt>학습 구성</dt><dd>{safeCount(course.subjectCount)}과목 · {safeCount(course.questionCount)}문제</dd></div></dl><ActionButton href={`/courses/${course.slug}`} variant="dark" className="full-width">과정 상세 보기</ActionButton></article>)}</div> : <div className="empty-state"><strong>공개된 과정이 준비 중입니다.</strong><p>잠시 후 다시 확인하거나 학습 가이드에서 SECURIUM의 학습 방식을 먼저 살펴보세요.</p><ActionButton href="/guide" variant="ghost">학습 가이드 보기</ActionButton></div>}</div></section>
      <section className="landing-final-cta" aria-labelledby="final-cta-title"><div className="shell"><p className="eyebrow">SECURIUM 시작하기</p><h2 id="final-cta-title">공식 기준으로 배우고, 기록으로 복습하세요.</h2><p>무료로 학습을 시작하거나 과정을 먼저 둘러볼 수 있습니다.</p><div className="button-row"><ActionButton href="/signup" variant="dark">무료로 학습 시작</ActionButton><ActionButton href="/courses" variant="outline">과정 먼저 둘러보기</ActionButton></div></div></section>
    </main>
  );
}

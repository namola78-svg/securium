import Link from "next/link";
import { redirect } from "next/navigation";
import { CourseCard } from "@/components/course-card";
import type { CourseListItem } from "@/db/repositories";
import { getOptionalCurrentAppUser } from "@/lib/auth";
import { listPublishedCoursesCached } from "@/lib/cached-catalog";
import { courseDescription, safeCount } from "@/lib/course-display";

export const dynamic = "force-dynamic";

const spotlightCourseOrder = [
  "information-security-engineer",
  "isms-p",
  "cppg",
  "secure-coding-diagnostician",
  "privacy-impact-assessment",
];

function getSpotlightCourses(courses: CourseListItem[]) {
  const bySlug = new Map(courses.map((course) => [course.slug, course]));
  const preferred = spotlightCourseOrder
    .map((slug) => bySlug.get(slug))
    .filter((course): course is CourseListItem => Boolean(course));
  const remaining = courses.filter(
    (course) => !spotlightCourseOrder.includes(course.slug),
  );

  return [...preferred, ...remaining].slice(0, 4);
}

function spotlightMeta(course: CourseListItem) {
  const subjectCount = safeCount(course.subjectCount);
  const topicCount = safeCount(course.topicCount);
  const questionCount = safeCount(course.questionCount);
  const available =
    course.active &&
    course.published &&
    (subjectCount > 0 || topicCount > 0 || questionCount > 0);

  return {
    description: courseDescription(course.description),
    status: available ? "학습 가능" : "개설 예정",
    stats:
      questionCount > 0
        ? `${subjectCount || "여러"}개 과목 · ${questionCount}문항`
        : `${subjectCount || "여러"}개 과목 · ${topicCount || "주요"}개 주제`,
  };
}

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
  const spotlightCourses = getSpotlightCourses(courses);

  return (
    <main>
      <section className="hero">
        <div className="shell hero-grid">
          <div>
            <p className="eyebrow light">AI-POWERED SECURITY LEARNING</p>
            <h1>
              <span className="hero-title-line">공식 기준으로 배우고</span>
              <br />
              <span>AI 근거로 이해하는 정보보호 학습 플랫폼</span>
            </h1>
            <p className="hero-copy">
              공식 출제기준과 검수된 학습 콘텐츠를 중심으로
              <br />
              문제풀이, 오답 복습, AI 근거 설명까지 한 흐름으로 학습하세요.
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
          <div className="hero-panel" aria-label="SECURIUM 학습 경험 요약">
            <div className="hero-panel-header">
              <span>SECURIUM 학습 경험</span>
              <span className="live-dot">공개 과정</span>
            </div>
            <div className="today-card-title">
              <span>{databaseReady ? `${courses.length}개 전문과정` : "과정 확인 중"}</span>
              <strong>공식 커리큘럼부터 AI 복습까지</strong>
              <p>
                과정 선택부터 이론, 문제, 근거 해설, 오답 복습을 하나의
                흐름으로 제공합니다.
              </p>
            </div>
            <div className="hero-learning-pulse" aria-label="오늘의 학습 예시">
              <div>
                <span>오늘 학습</span>
                <strong>17분</strong>
              </div>
              <div>
                <span>AI 설명</span>
                <strong>완료</strong>
              </div>
              <div>
                <span>복습 추천</span>
                <strong>5문제</strong>
              </div>
            </div>
            <div className="hero-ai-flow" aria-label="AI 학습 흐름">
              <div>
                <span>01</span>
                <strong>문제 풀이</strong>
                <p>과정별 문제를 풀고 취약 영역을 확인합니다.</p>
              </div>
              <div className="hero-ai-flow-arrow" aria-hidden="true">
                →
              </div>
              <div>
                <span>02</span>
                <strong>AI 근거 설명</strong>
                <p>공식 기준과 연결된 근거로 정답 이유를 설명합니다.</p>
              </div>
              <div className="hero-ai-flow-arrow" aria-hidden="true">
                →
              </div>
              <div>
                <span>03</span>
                <strong>복습 추천</strong>
                <p>오답과 취약 개념을 오늘의 복습으로 이어줍니다.</p>
              </div>
            </div>
            <div className="signal-list">
              <div>
                <span>기준</span>
                <strong>공식 기준 기반</strong>
              </div>
              <div>
                <span>설명</span>
                <strong>근거 기반 설명</strong>
              </div>
              <div>
                <span>흐름</span>
                <strong>이론 · 문제 · 복습</strong>
              </div>
            </div>
            <Link className="button button-outline-light hero-card-cta" href="/courses">
              과정 둘러보기
            </Link>
          </div>
        </div>
      </section>

      {databaseReady && spotlightCourses.length ? (
        <section className="landing-course-spotlight" aria-labelledby="landing-course-spotlight-title">
          <div className="shell">
            <div className="landing-course-spotlight-header">
              <div>
                <p className="eyebrow">POPULAR LEARNING TRACKS</p>
                <h2 id="landing-course-spotlight-title">
                  준비하는 과정이 바로 보이도록
                </h2>
              </div>
              <Link className="text-link" href="/courses">
                전체 과정 보기 →
              </Link>
            </div>
            <div className="landing-course-spotlight-grid">
              {spotlightCourses.map((course) => {
                const meta = spotlightMeta(course);

                return (
                  <Link
                    key={course.id}
                    className="landing-course-spotlight-card"
                    href={`/courses/${course.slug}`}
                  >
                    <span className="landing-course-spotlight-status">
                      {meta.status}
                    </span>
                    <strong>{course.name || course.shortName}</strong>
                    <p>{meta.description}</p>
                    <span className="landing-course-spotlight-meta">
                      {meta.stats}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="section landing-learning-chain" aria-labelledby="learning-chain-title">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SECURIUM LEARNING CHAIN</p>
              <h2 id="learning-chain-title">
                기준, 개념, 문제, AI 해설이 끊기지 않고 이어집니다
              </h2>
              <p>
                단순 문제풀이가 아니라 공식 기준에서 출발해 개념과 콘텐츠,
                문제, 근거 해설, 복습까지 하나의 학습 경로로 연결합니다.
              </p>
            </div>
          </div>
          <ol className="learning-chain-list" aria-label="SECURIUM 학습 연결 구조">
            <li>
              <span>01</span>
              <strong>공식 기준</strong>
              <p>출제기준과 인증기준을 학습의 출발점으로 둡니다.</p>
            </li>
            <li>
              <span>02</span>
              <strong>개념 연결</strong>
              <p>흩어진 용어와 주제를 같은 의미망 안에서 연결합니다.</p>
            </li>
            <li>
              <span>03</span>
              <strong>이론 콘텐츠</strong>
              <p>기준과 연결된 본문형 학습 콘텐츠로 개념을 이해합니다.</p>
            </li>
            <li>
              <span>04</span>
              <strong>문제 풀이</strong>
              <p>과정·과목·주제별 문제로 실제 이해도를 확인합니다.</p>
            </li>
            <li>
              <span>05</span>
              <strong>근거 해설</strong>
              <p>AI 설명은 검수된 근거와 함께 참고용으로 제공합니다.</p>
            </li>
            <li>
              <span>06</span>
              <strong>복습</strong>
              <p>오답과 취약 개념을 다시 볼 학습으로 이어갑니다.</p>
            </li>
          </ol>
        </div>
      </section>

      <section
        className="section landing-knowledge-platform"
        aria-labelledby="knowledge-platform-title"
      >
        <div className="shell knowledge-platform-grid">
          <div>
            <p className="eyebrow">KNOWLEDGE PLATFORM</p>
            <h2 id="knowledge-platform-title">
              강의보다 깊게, 지식을 연결하는 학습 플랫폼
            </h2>
            <p className="knowledge-platform-copy">
              SECURIUM은 콘텐츠를 단순히 나열하지 않습니다. 공식 기준과
              개념, 이론, 문제, AI 근거 해설, 복습 신호를 하나의 지식 흐름으로
              연결해 학습자가 “왜 맞고, 어디가 약한지”까지 이해하도록 돕습니다.
            </p>
            <div className="knowledge-platform-features">
              <article>
                <span>01</span>
                <strong>공식 기준 저장소</strong>
                <p>출제기준과 인증기준을 학습 콘텐츠의 기준점으로 관리합니다.</p>
              </article>
              <article>
                <span>02</span>
                <strong>Ontology 기반 연결</strong>
                <p>용어, 주제, 과정 간 관계를 연결해 흩어진 지식을 이어줍니다.</p>
              </article>
              <article>
                <span>03</span>
                <strong>근거 기반 AI 설명</strong>
                <p>AI 해설은 내부 콘텐츠와 기준을 근거로 삼아 참고 설명을 제공합니다.</p>
              </article>
              <article>
                <span>04</span>
                <strong>복습 피드백 루프</strong>
                <p>문제 풀이 결과를 취약 개념과 복습 계획으로 다시 연결합니다.</p>
              </article>
            </div>
          </div>
          <div
            className="knowledge-platform-stack"
            aria-label="SECURIUM 지식 플랫폼 구조"
          >
            <div>
              <span>Layer 01</span>
              <strong>Official Standards</strong>
              <p>출제기준 · 인증기준 · 법령 기준일</p>
            </div>
            <div>
              <span>Layer 02</span>
              <strong>Ontology Map</strong>
              <p>개념 · 별칭 · 관계 · 과정 간 매핑</p>
            </div>
            <div>
              <span>Layer 03</span>
              <strong>Content Graph</strong>
              <p>이론 · 사례 · 기준 · 문제 연결</p>
            </div>
            <div>
              <span>Layer 04</span>
              <strong>AI Citation</strong>
              <p>검색 근거 · 인용 · 검수 상태</p>
            </div>
            <div>
              <span>Layer 05</span>
              <strong>Review Signal</strong>
              <p>오답 · 취약 영역 · 복습 추천</p>
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

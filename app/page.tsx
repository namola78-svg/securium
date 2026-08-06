import Link from "next/link";
import { redirect } from "next/navigation";
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
              <span className="hero-title-line">공식 기준으로 검증되는</span>
              <br />
              <span>정보보호 AI 학습 플랫폼</span>
            </h1>
            <p className="hero-copy">
              출제기준과 인증기준에서 출발해
              <br />
              이론, 문제, 근거 해설, 복습까지 하나의 흐름으로 학습하세요.
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
              <span>공식 기준 기반 학습 코어</span>
              <span className="live-dot">검증 가능</span>
            </div>
            <div className="today-card-title">
              <span>Knowledge-linked Learning</span>
              <strong>공식 기준 기반 학습 엔진</strong>
              <p>
                출제기준, 이론, 문제, AI 근거 설명, 복습 신호를 하나의 지식 구조로
                연결합니다.
              </p>
            </div>
            <div className="signal-list">
              <div>
                <span>기준</span>
                <strong>KISA · NCS 기반</strong>
              </div>
              <div>
                <span>근거</span>
                <strong>검증 가능한 해설</strong>
              </div>
              <div>
                <span>복습</span>
                <strong>취약 영역 추천</strong>
              </div>
            </div>
            <Link className="button button-outline-light hero-card-cta" href="/courses">
              과정 둘러보기
            </Link>
          </div>
        </div>
      </section>

      <section className="section landing-learning-chain" aria-labelledby="learning-chain-title">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">학습 연결 구조</p>
              <h2 id="learning-chain-title">
                SECURIUM은 이렇게 학습을 연결합니다
              </h2>
              <p>
                SECURIUM은 공식 기준에서 출발해 커리큘럼, 이론, 문제, AI 근거,
                복습까지 하나의 흐름으로 이어지는 지식 기반 학습 플랫폼입니다.
              </p>
            </div>
          </div>
          <ol className="learning-chain-list" aria-label="SECURIUM 학습 연결 구조">
            <li>
              <span>01</span>
              <strong>공식 기준</strong>
              <p>정보보안기사 네트워크 보안 출제기준</p>
            </li>
            <li>
              <span>02</span>
              <strong>커리큘럼</strong>
              <p>서비스 거부 공격과 대응 개념 연결</p>
            </li>
            <li>
              <span>03</span>
              <strong>이론</strong>
              <p>DoS/DDoS 개념과 탐지 기준 정리</p>
            </li>
            <li>
              <span>04</span>
              <strong>문제</strong>
              <p>공격 유형 판단과 대응 방법 문제풀이</p>
            </li>
            <li>
              <span>05</span>
              <strong>AI 근거</strong>
              <p>관련 출제기준과 해설 근거 연결</p>
            </li>
            <li>
              <span>06</span>
              <strong>복습</strong>
              <p>오답 5문제와 취약 개념 재추천</p>
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
            <p className="eyebrow">지식 플랫폼</p>
            <h2 id="knowledge-platform-title">
              AI만 붙인 학습이 아니라, 기준에서 복습까지 연결된 지식 플랫폼
            </h2>
            <p className="knowledge-platform-copy">
              SECURIUM의 핵심은 AI 자체가 아닙니다. 공식 기준을 출발점으로
              개념 연결, 이론 콘텐츠, 문제, 근거 해설, 복습 추천이 이어지는 구조 위에서
              AI가 이해와 다음 학습을 돕습니다.
            </p>
            <div className="knowledge-platform-equation" aria-label="SECURIUM 핵심 구조">
              <span>AI</span>
              <strong>×</strong>
              <span>공식 기준 기반 지식 연결</span>
            </div>
            <div className="knowledge-platform-features">
              <article>
                <span>01</span>
                <strong>공식 기준</strong>
                <p>출제기준과 인증기준을 학습 콘텐츠의 기준점으로 관리합니다.</p>
              </article>
              <article>
                <span>02</span>
                <strong>개념 연결</strong>
                <p>용어, 주제, 과정 간 관계를 연결해 흩어진 지식을 이어줍니다.</p>
              </article>
              <article>
                <span>03</span>
                <strong>이론 · 문제</strong>
                <p>이론 콘텐츠와 문제를 같은 개념 흐름 안에서 학습하게 합니다.</p>
              </article>
              <article>
                <span>04</span>
                <strong>근거 · 복습</strong>
                <p>근거 해설과 복습 신호를 다시 취약 개념으로 연결합니다.</p>
              </article>
            </div>
          </div>
          <div
            className="knowledge-platform-stack"
            aria-label="SECURIUM 지식 플랫폼 파이프라인"
          >
            <div>
              <span>01</span>
              <strong>공식 기준</strong>
              <p>출제기준 · 인증기준 · 법령 기준일</p>
            </div>
            <div>
              <span>02</span>
              <strong>개념 연결</strong>
              <p>개념 · 별칭 · 관계 · 과정 간 매핑</p>
            </div>
            <div>
              <span>03</span>
              <strong>이론 콘텐츠</strong>
              <p>이론 · 사례 · 기준 해설</p>
            </div>
            <div>
              <span>04</span>
              <strong>문제풀이</strong>
              <p>문제 · 오답 · 취약 개념</p>
            </div>
            <div>
              <span>05</span>
              <strong>근거 해설</strong>
              <p>검색 근거 · 인용 · 검수 상태</p>
            </div>
            <div>
              <span>06</span>
              <strong>맞춤 복습</strong>
              <p>복습 일정 · 추천 · 학습 루프</p>
            </div>
          </div>
        </div>
        <div className="shell">
          <article className="ai-result-card" aria-labelledby="ai-result-title">
            <div className="ai-result-question">
              <p className="eyebrow">검증 가능한 AI 해설</p>
              <h3 id="ai-result-title">
                AI가 답만 알려주는 것이 아니라, 왜 그런지 공식 기준으로 설명합니다
              </h3>
              <p>
                SECURIUM의 AI 설명은 검증 가능한 근거를 함께 보여줍니다.
                질문 하나가 설명, 공식 기준, 관련 문제, 관련 개념으로 이어집니다.
              </p>
            </div>
            <div className="ai-result-grid">
              <div>
                <span>질문</span>
                <strong>접근통제에서 권한 검토가 왜 중요한가요?</strong>
              </div>
              <div>
                <span>설명</span>
                <strong>권한은 한 번 부여한 뒤에도 업무 변경과 퇴사에 따라 계속 검토해야 합니다.</strong>
              </div>
              <div>
                <span>근거</span>
                <strong>ISMS-P 접근권한 부여·변경·말소 관리 기준과 연결됩니다.</strong>
              </div>
              <div>
                <span>다음 학습</span>
                <strong>관련 문제 5개 · 관련 개념 4개 · 복습 추천 1개</strong>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section
        className="section landing-dashboard-preview"
        aria-labelledby="dashboard-preview-title"
      >
        <div className="shell dashboard-preview-grid">
          <div>
            <p className="eyebrow">학습자 대시보드</p>
            <h2 id="dashboard-preview-title">
              오늘 무엇을 배우고, 어디를 다시 봐야 하는지 바로 보입니다
            </h2>
            <p>
              학습자는 통계표를 먼저 보는 것이 아니라, 오늘 할 학습과 AI 설명,
              복습 추천, 취약 영역을 한 화면에서 확인합니다.
            </p>
          </div>
          <article className="learner-dashboard-card" aria-label="학습자 대시보드 미리보기">
            <div className="learner-dashboard-card-header">
              <div>
                <span>TODAY</span>
                <strong>오늘의 학습</strong>
              </div>
              <span className="dashboard-preview-badge">17분 예상</span>
            </div>
            <div className="learner-dashboard-main">
              <div>
                <span>이어서 학습</span>
                <strong>네트워크 보안 · 접근통제 기초</strong>
                <p>공식 기준과 연결된 이론 1개를 이어서 학습합니다.</p>
                <div className="dashboard-preview-progress" aria-label="이어서 학습 진행률 64%">
                  <span style={{ width: "64%" }} />
                </div>
              </div>
              <div>
                <span>AI 설명</span>
                <strong>권한 검토 개념 설명 완료</strong>
                <p>근거 3개와 관련 개념 4개가 함께 연결되었습니다.</p>
              </div>
            </div>
            <div className="learner-dashboard-row">
              <div>
                <span>오늘 완료</span>
                <strong>2/5</strong>
                <p>계획 대비 진행률</p>
              </div>
              <div>
                <span>복습 추천</span>
                <strong>5문제</strong>
                <p>오답과 유사 문제 중심</p>
              </div>
              <div>
                <span>취약 영역</span>
                <strong>접근권한 관리</strong>
                <p>정답률 58% · 우선 복습</p>
              </div>
            </div>
            <Link className="button button-lime learner-dashboard-cta" href="/signup">
              오늘 학습 시작하기
            </Link>
          </article>
        </div>
      </section>

      {databaseReady && spotlightCourses.length ? (
        <section className="landing-course-spotlight" aria-labelledby="landing-course-spotlight-title">
          <div className="shell">
            <div className="landing-course-spotlight-header">
              <div>
                <p className="eyebrow">추천 과정</p>
                <h2 id="landing-course-spotlight-title">
                  내가 준비하는 과정을 선택하세요
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

      <section className="section landing-value-section">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">왜 SECURIUM인가</p>
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
          <div className="landing-final-cta">
            <div>
              <p className="eyebrow">SECURIUM 시작하기</p>
              <h2>공식 기준으로 배우고, AI 근거로 복습하세요</h2>
              <p>
                정보보호·개인정보보호 학습을 과정, 문제, 해설, 복습까지
                하나의 흐름으로 이어갑니다.
              </p>
            </div>
            <div className="landing-final-actions" aria-label="SECURIUM 시작하기">
              <Link className="button button-dark" href="/signup">
                무료로 학습 시작하기
              </Link>
              <Link className="button button-secondary" href="/courses">
                과정 먼저 둘러보기
              </Link>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}

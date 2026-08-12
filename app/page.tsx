import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicLandingHeader } from "@/components/v2/public-landing-header";
import styles from "@/components/v2/public-landing.module.css";
import { V2Button } from "@/components/v2/v2-button";
import { V2Foundation } from "@/components/v2/v2-foundation";
import type { CourseListItem } from "@/db/repositories";
import { getOptionalCurrentAppUser } from "@/lib/auth";
import { listPublishedCoursesCached } from "@/lib/cached-catalog";
import {
  courseDescription,
  difficultyLabel,
  safeCount,
} from "@/lib/course-display";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "정보보호 자격증 학습 플랫폼",
  description:
    "공식 기준 기반 커리큘럼과 문제풀이, 오답 복습, AI 보조 설명을 연결하는 정보보호·개인정보보호 자격증 학습 플랫폼입니다.",
};

const spotlightOrder = [
  "information-security-engineer",
  "information-security-industrial-engineer",
  "isms-p",
  "cppg",
];

const valueItems = [
  {
    icon: "AI",
    title: "AI 보조 설명",
    description: "정답을 대신하지 않고, 틀린 이유와 핵심 개념 이해를 돕습니다.",
  },
  {
    icon: "01",
    title: "체계적인 커리큘럼",
    description: "공식 기준에 맞춘 과목과 주제 순서로 학습 범위를 정리합니다.",
  },
  {
    icon: "Q",
    title: "실전 문제풀이",
    description: "배운 내용을 문제로 확인하고 검수된 해설까지 이어서 봅니다.",
  },
  {
    icon: "↻",
    title: "오답 중심 복습",
    description: "틀린 문제와 취약한 개념을 다음 학습 행동으로 연결합니다.",
  },
] as const;

const learningSteps = [
  ["공식 기준", "시험과 인증의 공식 범위에서 학습 출발점을 확인합니다."],
  ["핵심 이론", "과목과 주제별로 꼭 알아야 할 개념을 이해합니다."],
  ["문제풀이", "학습한 내용을 다양한 문제 유형으로 점검합니다."],
  ["해설과 AI 보조", "검수된 해설을 먼저 보고 필요한 설명을 보충합니다."],
  ["오답과 복습", "틀린 이유를 기록하고 관련 개념을 다시 학습합니다."],
] as const;

function getSpotlightCourses(courses: CourseListItem[]) {
  const bySlug = new Map(courses.map((course) => [course.slug, course]));
  const preferred = spotlightOrder
    .map((slug) => bySlug.get(slug))
    .filter((course): course is CourseListItem => Boolean(course));

  return [
    ...preferred,
    ...courses.filter((course) => !spotlightOrder.includes(course.slug)),
  ].slice(0, 4);
}

function LandingCourseCard({ course }: { course: CourseListItem }) {
  return (
    <article
      aria-labelledby={`landing-v2-course-${course.id}`}
      className={styles.courseCard}
    >
      <div className={styles.courseCardTopline}>
        <span>{course.groupName || "전문 자격 과정"}</span>
        <span className={styles.publishedStatus}>공개 과정</span>
      </div>
      <div className={styles.courseCardBody}>
        <span className={styles.difficulty}>{difficultyLabel(course.difficulty)}</span>
        <h3 id={`landing-v2-course-${course.id}`}>{course.name}</h3>
        <p>{courseDescription(course.description)}</p>
        <dl className={styles.courseFacts}>
          <div><dt>과목</dt><dd>{safeCount(course.subjectCount)}개</dd></div>
          <div><dt>주제</dt><dd>{safeCount(course.topicCount)}개</dd></div>
          <div><dt>문제</dt><dd>{safeCount(course.questionCount)}개</dd></div>
        </dl>
      </div>
      <V2Button fullWidth href={`/courses/${course.slug}`} variant="secondary">
        과정 상세 보기
      </V2Button>
    </article>
  );
}

export default async function Home() {
  if (await getOptionalCurrentAppUser()) redirect("/dashboard");

  let courses: CourseListItem[] = [];
  try {
    courses = await listPublishedCoursesCached();
  } catch {
    // Keep the public explanation available if the catalog is temporarily unavailable.
  }
  const spotlightCourses = getSpotlightCourses(courses);

  return (
    <V2Foundation className={styles.landing} data-public-v2="">
      <PublicLandingHeader />

      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="landing-v2-title">
          <div className={styles.container}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>
                  정보보호·개인정보보호 자격증 전문 학습 플랫폼
                </p>
                <h1 id="landing-v2-title">
                  보안 전문가로 가는
                  <span>가장 확실한 학습 경로</span>
                </h1>
                <p className={styles.heroDescription}>
                  공식 기준에 맞춘 커리큘럼과 문제풀이, 오답 복습을 하나의
                  흐름으로 연결합니다. AI는 핵심 개념과 오답 이유를 이해하는
                  보조 설명으로 활용합니다.
                </p>
                <div className={styles.heroActions}>
                  <V2Button href="/signup" size="lg">무료로 시작하기</V2Button>
                  <V2Button href="/courses" size="lg" variant="secondary">
                    과정 둘러보기
                  </V2Button>
                </div>
                <ul className={styles.heroAssurances}>
                  <li>공식 기준 기반</li>
                  <li>검수된 해설 우선</li>
                  <li>PC·Mobile 학습</li>
                </ul>
              </div>

              <aside className={styles.productPreview} aria-label="학습 화면 예시">
                <div className={styles.previewHeader}>
                  <div>
                    <span>학습 화면 예시</span>
                    <strong>오늘의 학습</strong>
                  </div>
                  <span className={styles.previewNotice}>실제 계정 데이터 아님</span>
                </div>
                <div className={styles.previewPrimary}>
                  <span className={styles.previewLabel}>이어서 학습</span>
                  <strong>네트워크 보안 · 접근통제</strong>
                  <p>공식 커리큘럼에서 다음 핵심 개념을 이어서 학습합니다.</p>
                  <div className={styles.previewPath} aria-label="예시 학습 경로">
                    <span>핵심 이론</span>
                    <i aria-hidden="true">→</i>
                    <span>문제풀이</span>
                    <i aria-hidden="true">→</i>
                    <span>오답 복습</span>
                  </div>
                </div>
                <div className={styles.previewGrid}>
                  <div>
                    <span>공식 근거</span>
                    <strong>연결 상태 확인</strong>
                    <p>학습 기준과 검수 정보를 함께 확인합니다.</p>
                  </div>
                  <div>
                    <span>취약 개념</span>
                    <strong>다시 학습</strong>
                    <p>오답과 연결된 개념으로 바로 돌아갑니다.</p>
                  </div>
                </div>
                <div className={styles.previewCoach}>
                  <span aria-hidden="true">AI</span>
                  <div>
                    <strong>보조 설명</strong>
                    <p>왜 틀렸는지 이해할 수 있도록 관련 개념을 설명합니다.</p>
                  </div>
                </div>
              </aside>
            </div>

            <div className={styles.valueGrid} aria-label="SECURIUM 핵심 학습 기능">
              {valueItems.map((item) => (
                <article key={item.title}>
                  <span className={styles.valueIcon} aria-hidden="true">{item.icon}</span>
                  <div><h2>{item.title}</h2><p>{item.description}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.flowSection} aria-labelledby="landing-v2-flow-title">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>하나로 이어지는 학습</p>
              <h2 id="landing-v2-flow-title">문제를 외우기보다 지식을 연결합니다</h2>
              <p>공식 범위를 이해하고, 문제와 복습으로 다시 확인하는 간결한 흐름입니다.</p>
            </div>
            <ol className={styles.flowList}>
              {learningSteps.map(([title, description], index) => (
                <li key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.courseSection} aria-labelledby="landing-v2-courses-title">
          <div className={styles.container}>
            <div className={styles.sectionHeadingRow}>
              <div className={styles.sectionHeading}>
                <p className={styles.eyebrow}>공개 과정</p>
                <h2 id="landing-v2-courses-title">준비할 자격과 학습 목표를 선택하세요</h2>
                <p>현재 공개된 과정의 실제 과목·주제·문제 구성을 확인할 수 있습니다.</p>
              </div>
              <V2Button href="/courses" variant="secondary">모든 과정 보기</V2Button>
            </div>

            {spotlightCourses.length ? (
              <div className={styles.courseGrid}>
                {spotlightCourses.map((course) => (
                  <LandingCourseCard course={course} key={course.id} />
                ))}
              </div>
            ) : (
              <div className={styles.catalogFallback} role="status">
                <div>
                  <strong>공개 과정 정보를 불러오고 있습니다</strong>
                  <p>학습 방식은 가이드에서 먼저 확인할 수 있습니다.</p>
                </div>
                <V2Button href="/guide" variant="secondary">학습 가이드 보기</V2Button>
              </div>
            )}
          </div>
        </section>

        <section className={styles.trustSection} aria-labelledby="landing-v2-trust-title">
          <div className={styles.container}>
            <div className={styles.trustIntro}>
              <p className={styles.eyebrow}>신뢰할 수 있는 학습</p>
              <h2 id="landing-v2-trust-title">AI보다 먼저, 기준과 근거를 확인합니다</h2>
              <p>
                SECURIUM은 공식 답안을 AI로 대체하지 않습니다. 검수된 콘텐츠와
                출처를 중심에 두고 AI는 이해를 돕는 보조 역할만 수행합니다.
              </p>
              <Link href="/guide">학습 방식 자세히 보기 <span aria-hidden="true">→</span></Link>
            </div>
            <div className={styles.trustList}>
              <article>
                <span>01</span>
                <div><h3>공식 기준 기반</h3><p>시험·인증의 공식 범위와 연결된 학습 구조를 제공합니다.</p></div>
              </article>
              <article>
                <span>02</span>
                <div><h3>검수 상태 확인</h3><p>해설의 버전과 검수 정보를 학습 흐름에서 확인합니다.</p></div>
              </article>
              <article>
                <span>03</span>
                <div><h3>개념과 문제 연결</h3><p>틀린 문제에서 관련 개념과 다시 볼 학습으로 이어집니다.</p></div>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.finalCta} aria-labelledby="landing-v2-final-title">
          <div className={styles.container}>
            <div>
              <p className={styles.eyebrow}>학습을 시작할 준비가 되셨나요?</p>
              <h2 id="landing-v2-final-title">지금 학습을 시작하세요</h2>
              <p>과정을 선택하고 이론, 문제풀이, 복습을 한곳에서 이어가세요.</p>
            </div>
            <div className={styles.finalActions}>
              <V2Button href="/signup" size="lg">무료로 시작하기</V2Button>
              <V2Button href="/courses" size="lg" variant="secondary">과정 둘러보기</V2Button>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerBrand}>
            <span className={styles.brandMark} aria-hidden="true">S</span>
            <div><strong>SECURIUM</strong><p>정보보호·개인정보보호 자격증 학습 플랫폼</p></div>
          </div>
          <nav className={styles.footerNav} aria-label="공개 사이트 하단 메뉴">
            <div><strong>학습</strong><Link href="/courses">과정</Link><Link href="/guide">학습 가이드</Link></div>
            <div><strong>서비스</strong><Link href="/about">서비스 소개</Link><Link href="/login">로그인</Link></div>
            <div><strong>안내</strong><Link href="/legal/privacy">개인정보 처리방침</Link><Link href="/legal/terms">이용약관</Link></div>
          </nav>
        </div>
        <div className={`${styles.container} ${styles.footerBottom}`}>
          <span>© 2026 SECURIUM</span>
          <span>공식 기준과 검수된 콘텐츠를 중심으로 학습합니다.</span>
        </div>
      </footer>
    </V2Foundation>
  );
}

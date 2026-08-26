import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProgressBar } from "@/components/progress-bar";
import { getTodayLearningPlan } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { listDashboardUserEnrollments } from "@/lib/dashboard-enrollments";
import styles from "@/components/v2/dashboard-v2.module.css";

export const metadata: Metadata = { title: "대시보드 | SECURIUM" };
export const dynamic = "force-dynamic";

type Enrollment = Awaited<ReturnType<typeof listDashboardUserEnrollments>>[number];
type ProgressStyle = CSSProperties & { "--dashboard-progress": string };
type Concept = { title: string; summary: string };

const mustKnowConcepts: Concept[] = [
  { title: "접근통제", summary: "누가 어떤 정보와 시스템에 접근할 수 있는지 결정하는 보안의 기본 원리입니다." },
  { title: "암호 알고리즘", summary: "정보를 보호하기 위해 평문을 안전한 형태로 바꾸고 복원하는 방법을 이해합니다." },
  { title: "로그 분석", summary: "정상적인 활동과 침해 징후를 구분하기 위해 기록을 읽는 방법을 익힙니다." },
];

export default async function DashboardPage() {
  const user = await requireCurrentAppUser("/dashboard");
  const [enrollments, planResult] = await Promise.all([
    safe(() => listDashboardUserEnrollments(user.id), []),
    safe(() => getTodayLearningPlan(user.id), null),
  ]);
  const plan = planResult ?? emptyPlan();
  const activeCourses = enrollments
    .filter((item) => item.status === "ACTIVE")
    .sort(
      (a, b) =>
        new Date(b.lastStudiedAt ?? 0).getTime() -
        new Date(a.lastStudiedAt ?? 0).getTime(),
    );
  const currentCourse = activeCourses[0] ?? null;
  const recentCourses = activeCourses.filter((item) => item.lastStudiedAt).slice(0, 3);
  const recommendation = plan.recommendations[0];
  const nextAction = recommendation
    ? {
        type: "추천 학습",
        href: recommendation.href,
        title: recommendation.title,
        reason: recommendation.reason,
        cta: "추천 학습 시작",
      }
    : plan.reviewSummary.dueCount
      ? {
          type: "오늘 복습",
          href: "/reviews",
          title: "예정된 복습을 먼저 완료하세요",
          reason: `${plan.reviewSummary.dueCount}개의 복습 항목이 기다리고 있습니다.`,
          cta: "복습 시작",
        }
      : currentCourse
        ? {
            type: "이어서 학습",
            href: `/learn/${currentCourse.courseSlug}`,
            title: currentCourse.courseName,
            reason: `현재 과정 진도는 ${currentCourse.progressPercent}%입니다.`,
            cta: "학습 이어가기",
          }
        : {
            type: "첫 학습 시작",
            href: "/courses",
            title: "학습할 과정을 선택해보세요",
            reason: "과정을 선택하면 진도와 복습 일정을 관리할 수 있습니다.",
            cta: "과정 둘러보기",
          };
  const remainingQuestions = Math.max(
    plan.settings.dailyQuestionGoal - plan.completedQuestions,
    0,
  );
  const greetingName = user.displayName?.trim() || "학습자";

  return (
    <main className={styles.page} data-dashboard-v2="">
      <div className={styles.container}>
        <header className={styles.greeting}>
          <div>
            <p>SECURIUM 학습 공간</p>
            <h1>{currentCourse ? currentCourse.courseName : `안녕하세요, ${greetingName}님`}</h1>
            <span>{currentCourse ? `${currentCourse.progressPercent}%까지 학습했습니다. 다음 한 걸음을 이어가 보세요.` : "과정을 고르면 학습 기록과 다음 할 일이 여기에 쌓입니다."}</span>
          </div>
          <Link className={styles.courseLink} href="/my-courses">내 과정 보기</Link>
        </header>

        <div className={styles.dashboardGrid}>
          <section className={styles.recommendation} aria-labelledby="dashboard-recommendation-title" data-dashboard-recommendation="">
            <div className={styles.recommendationCopy}>
              <p>오늘의 추천 학습 · 지금 이어갈 학습</p>
              <span>{nextAction.type}</span>
              <h2 id="dashboard-recommendation-title">{nextAction.title}</h2>
              <div>{nextAction.reason}</div>
            </div>
            <Link className={styles.primaryAction} href={nextAction.href}>
              {nextAction.cta}<span aria-hidden="true">→</span>
            </Link>
          </section>

          <section className={styles.progressCard} aria-labelledby="dashboard-progress-title" data-dashboard-progress="">
            <SectionLabel>현재 학습 상태</SectionLabel>
            <h2 id="dashboard-progress-title">{currentCourse ? "현재 과정 진도" : "학습 기록 없음"}</h2>
            {currentCourse ? (
              <>
                <div className={styles.progressSummary}>
                  <div
                    className={styles.progressRing}
                    role="progressbar"
                    aria-label={`${currentCourse.courseName} 과정 진도`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={currentCourse.progressPercent}
                    aria-valuetext={`${currentCourse.progressPercent}% 완료`}
                    style={{ "--dashboard-progress": `${currentCourse.progressPercent * 3.6}deg` } as ProgressStyle}
                  >
                    <span>{currentCourse.progressPercent}%</span>
                  </div>
                  <div>
                    <strong>{currentCourse.courseName}</strong>
                    <span>단계 {currentCourse.currentLevel}/{currentCourse.totalLevels}</span>
                  </div>
                </div>
                <Link className={styles.textAction} href={`/learn/${currentCourse.courseSlug}`}>과정 상세 보기 →</Link>
              </>
            ) : (
              <EmptyMessage>과정을 선택하고 학습을 시작하면 현재 진도를 확인할 수 있습니다.</EmptyMessage>
            )}
          </section>

          <section className={styles.courseProgress} aria-labelledby="dashboard-courses-title" data-dashboard-courses="">
            <SectionHeader eyebrow="과정별 상태" title="진행 중인 학습" id="dashboard-courses-title" href="/my-courses" linkLabel="전체 과정" />
            {activeCourses.length ? (
              <div className={styles.courseList}>
                {activeCourses.map((course) => <CourseProgressRow course={course} key={course.id} />)}
              </div>
            ) : (
              <EmptyMessage actionHref="/courses" actionLabel="과정 둘러보기">학습할 과정을 선택해보세요.</EmptyMessage>
            )}
          </section>

          <section className={styles.concepts} aria-labelledby="dashboard-concepts-title" data-dashboard-concepts="">
            <SectionHeader eyebrow="Must-Know Concept" title="보안의 핵심 개념" id="dashboard-concepts-title" href={currentCourse ? `/learn/${currentCourse.courseSlug}` : "/courses"} linkLabel="학습으로 이동" />
            <p className={styles.sectionIntro}>자격증 과목을 외우기 전에, 여러 학습에서 반복해서 만나는 개념부터 연결해 보세요.</p>
            <div className={styles.conceptList}>
              {mustKnowConcepts.map((concept, index) => (
                <Link className={styles.conceptRow} href={currentCourse ? `/learn/${currentCourse.courseSlug}` : "/courses"} key={concept.title}>
                  <span className={styles.conceptIndex}>{String(index + 1).padStart(2, "0")}</span>
                  <span><strong>{concept.title}</strong><small>{concept.summary}</small></span>
                  <b aria-hidden="true">→</b>
                </Link>
              ))}
            </div>
          </section>

          <section className={styles.todayPlan} aria-labelledby="dashboard-plan-title" data-dashboard-plan="">
            <SectionHeader eyebrow="오늘의 계획" title="오늘 할 일" id="dashboard-plan-title" href="/settings" linkLabel="목표 설정" />
            <div className={styles.planList}>
              <PlanItem
                label="문제 목표"
                title={remainingQuestions ? `${remainingQuestions}문제 남음` : "오늘 목표 완료"}
                detail={`${plan.completedQuestions}/${plan.settings.dailyQuestionGoal}문제 완료`}
                href={currentCourse ? `/practice/${currentCourse.courseSlug}?random=1&count=10` : "/courses"}
              />
              <PlanItem
                label="복습 예정"
                title={plan.reviewSummary.dueCount ? `${plan.reviewSummary.dueCount}개 항목` : "예정된 복습 없음"}
                detail={plan.reviewSummary.dueCount ? "오늘 복습할 항목을 확인하세요." : "새 복습 일정이 생기면 여기에 표시됩니다."}
                href={plan.reviewSummary.dueCount ? "/reviews" : undefined}
              />
            </div>
          </section>

          <section className={styles.weakArea} aria-labelledby="dashboard-weak-title" data-dashboard-weakness="">
            <SectionHeader
              eyebrow="학습 점검"
              title="다시 확인할 영역"
              id="dashboard-weak-title"
              href={currentCourse ? `/analytics/${currentCourse.id}` : undefined}
              linkLabel="상세 분석"
            />
            <EmptyMessage>문제를 풀면 실제 학습 기록을 바탕으로 보완할 영역을 안내합니다.</EmptyMessage>
          </section>

          <section className={styles.recentLearning} aria-labelledby="dashboard-recent-title" data-dashboard-recent="">
            <SectionHeader eyebrow="최근 학습" title="최근 이어간 과정" id="dashboard-recent-title" />
            {recentCourses.length ? (
              <div className={styles.recentList}>
                {recentCourses.map((course) => (
                  <Link href={`/learn/${course.courseSlug}`} key={course.id}>
                    <div><strong>{course.courseName}</strong><span>{formatLastStudied(course.lastStudiedAt)}</span></div>
                    <b>{course.progressPercent}%</b>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyMessage>학습을 시작하면 최근 활동이 여기에 표시됩니다.</EmptyMessage>
            )}
          </section>

          <section className={styles.evidence} aria-labelledby="dashboard-evidence-title" data-dashboard-evidence="">
            <SectionHeader eyebrow="학습 기록" title="이미 쌓인 증거" id="dashboard-evidence-title" href="/analytics" linkLabel="학습 분석" />
            <div className={styles.evidenceList}>
              <EvidenceRow label="오늘 문제 풀이" value={`${plan.completedQuestions}문제`} detail={`목표 ${plan.settings.dailyQuestionGoal}문제`} />
              <EvidenceRow label="복습 활동" value={`${plan.reviewSummary.dueCount}개 예정`} detail={plan.reviewSummary.dueCount ? "복습에서 다시 확인할 항목" : "예정된 복습 항목 없음"} />
              <EvidenceRow label="최근 학습" value={`${recentCourses.length}개 과정`} detail={recentCourses.length ? "최근 이어간 과정" : "아직 기록이 없습니다"} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function CourseProgressRow({ course }: { course: Enrollment }) {
  return (
    <article className={styles.courseRow}>
      <div className={styles.courseRowHeading}>
        <div><span>{course.groupName}</span><h3>{course.courseName}</h3></div>
        <strong>{course.progressPercent}%</strong>
      </div>
      <ProgressBar value={course.progressPercent} label={`${course.courseName} 과정 진도`} />
      <div className={styles.courseMeta}>
        <span>단계 {course.currentLevel}/{course.totalLevels}</span>
        <span>정답률 {course.accuracy === null ? "기록 없음" : `${course.accuracy}%`}</span>
        <div className={styles.courseActions}>
          <Link href={`/practice/${course.courseSlug}?random=1&count=10`}>문제 풀기</Link>
          <Link href={`/learn/${course.courseSlug}`}>이어서 학습 →</Link>
        </div>
      </div>
    </article>
  );
}

function PlanItem({ detail, href, label, title }: { detail: string; href?: string; label: string; title: string }) {
  const content = <><span>{label}</span><strong>{title}</strong><small>{detail}</small></>;
  return href ? <Link className={styles.planItem} href={href}>{content}<b aria-hidden="true">→</b></Link> : <div className={styles.planItem}>{content}</div>;
}

function EvidenceRow({ detail, label, value }: { detail: string; label: string; value: string }) {
  return <div className={styles.evidenceRow}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function SectionHeader({ eyebrow, href, id, linkLabel, title }: { eyebrow: string; href?: string; id: string; linkLabel?: string; title: string }) {
  return (
    <header className={styles.sectionHeader}>
      <div><SectionLabel>{eyebrow}</SectionLabel><h2 id={id}>{title}</h2></div>
      {href && linkLabel ? <Link className={styles.textAction} href={href}>{linkLabel} →</Link> : null}
    </header>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className={styles.sectionLabel}>{children}</p>;
}

function EmptyMessage({ actionHref, actionLabel, children }: { actionHref?: string; actionLabel?: string; children: ReactNode }) {
  return (
    <div className={styles.emptyMessage}>
      <p>{children}</p>
      {actionHref && actionLabel ? <Link className={styles.textAction} href={actionHref}>{actionLabel} →</Link> : null}
    </div>
  );
}

function formatLastStudied(value: string | null) {
  if (!value) return "학습 기록 없음";
  return new Date(value).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

async function safe<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try { return await loader(); } catch { return fallback; }
}

function emptyPlan() {
  return {
    settings: { dailyQuestionGoal: 10, dailyStudyMinutes: 30 },
    completedQuestions: 0,
    completionPercent: 0,
    reviewSummary: { dueCount: 0, overdueCount: 0, estimatedMinutes: 0, completionPercent: 0, byCourse: [] },
    recommendations: [],
  };
}

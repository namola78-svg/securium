import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/design-system-primitives";
import { EmptyState } from "@/components/state-ui";
import { ProgressBar } from "@/components/progress-bar";
import { requireCurrentAppUser } from "@/lib/auth";
import { listCourseSpecializations } from "@/db/specialized-repositories";
import { listUserEnrollments } from "@/db/repositories";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "보안 실무 학습 | Securium",
  description: "코드 보안과 개인정보보호 실무 시나리오를 학습하고 분석 결과를 확인하세요.",
};

type Enrollment = Awaited<ReturnType<typeof listUserEnrollments>>[number];

type PracticalCourseEntry = Enrollment & {
  specializations: Awaited<ReturnType<typeof listCourseSpecializations>>;
  hasPracticalContent: boolean;
};

export default async function PracticalHubPage() {
  const user = await requireCurrentAppUser("/practical");
  const enrollments = await listUserEnrollments(user.id);
  const entries = await buildPracticalCourseEntries(enrollments);
  const availableEntries = entries.filter((entry) => entry.hasPracticalContent);
  const upcomingEntries = entries.filter((entry) => !entry.hasPracticalContent);

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">실무 학습</p>
          <h1>실무 연습 허브</h1>
          <p>수강 과정에 연결된 실무 시나리오를 선택하고 코드 분석과 개인정보보호 연습을 시작하세요.</p>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">실무 과정</p>
              <h2>실무 연습을 시작할 과정</h2>
            </div>
            <Link className="text-link" href="/courses">과정 둘러보기</Link>
          </div>

          <div className="course-grid">
            {availableEntries.length ? (
              availableEntries.map((entry) => (
                <article className="course-card" key={entry.id}>
                  <div className="course-card-top">
                    <span className="course-code">{entry.groupName}</span>
                    <span className="course-status available">실무 콘텐츠 제공</span>
                  </div>
                  <h3>{entry.courseName}</h3>
                  <p className="course-summary">
                    진도 {entry.progressPercent}% · 실무 유형 {entry.specializations.length}개
                  </p>
                  <ProgressBar value={entry.progressPercent} label={`${entry.courseName} 실무 학습 진도`} />
                  <dl className="course-comparison-list">
                    <div><dt>최근 활동</dt><dd>{formatDate(entry.lastStudiedAt)}</dd></div>
                    <div><dt>오답</dt><dd>{entry.totalAnswers - entry.correctAnswers}개</dd></div>
                  </dl>
                  <ActionButton href={`/practical/${entry.courseSlug}`} variant="dark" className="full-width">
                    실무 연습 시작
                  </ActionButton>
                </article>
              ))
            ) : (
              <EmptyState
                title="연결된 실무 과정이 없습니다"
                description="실무 특화 콘텐츠가 연결된 과정을 등록하면 이곳에서 연습을 시작할 수 있습니다."
                action={{ href: "/courses", label: "과정 둘러보기" }}
              />
            )}
          </div>
        </div>
      </section>

      {upcomingEntries.length ? (
        <section className="section">
          <div className="shell">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">콘텐츠 준비 중</p>
                <h2>실무 콘텐츠가 추가될 과정</h2>
              </div>
              <span className="count-label">{upcomingEntries.length}개 과정</span>
            </div>
            <div className="course-grid">
              {upcomingEntries.map((entry) => (
                <article className="course-card" key={entry.id}>
                  <div className="course-card-top">
                    <span className="course-code">{entry.groupName}</span>
                    <span className="course-status planned">준비 중</span>
                  </div>
                  <h3>{entry.courseName}</h3>
                  <p className="course-summary">이론 학습은 이용할 수 있지만, 현재 연결된 실무 시나리오는 없습니다.</p>
                  <ActionButton href={`/learn/${entry.courseSlug}`} variant="ghost" className="full-width">
                    이론 학습으로 이동
                  </ActionButton>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">빠른 시작</p>
              <h2>실무 연습 전 확인할 것</h2>
            </div>
          </div>
          <div className="section-block">
            <p>실무 시나리오는 과정별로 제공됩니다. 먼저 과정을 선택한 뒤 연결된 코드 분석과 개인정보보호 작업을 순서대로 진행하세요.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

async function buildPracticalCourseEntries(enrollments: Enrollment[]): Promise<PracticalCourseEntry[]> {
  return Promise.all(
    enrollments
      .filter((enrollment) => enrollment.status !== "CANCELLED")
      .map(async (enrollment) => {
        const specializations = await listCourseSpecializations(enrollment.courseId);
        return {
          ...enrollment,
          specializations,
          hasPracticalContent: specializations.length > 0,
        };
      }),
  );
}

function formatDate(value: string | null) {
  if (!value) return "기록 없음";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "기록 없음" : date.toLocaleDateString("ko-KR");
}

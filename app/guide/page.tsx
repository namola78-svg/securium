import type { Metadata } from "next";
import { ActionButton } from "@/components/design-system-primitives";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "학습 가이드",
  description: "SECURIUM에서 과정 선택부터 문제풀이와 오답 복습까지 시작하는 방법을 안내합니다.",
};

const guideSteps = [
  { title: "1. 목표 과정 선택", description: "정보보안 자격증과 개인정보보호·실무 과정 중 현재 목표에 맞는 학습 경로를 선택합니다." },
  { title: "2. 커리큘럼 확인", description: "과목과 주제 구성을 확인하고 현재 필요한 범위부터 학습을 시작합니다." },
  { title: "3. 문제풀이와 오답 정리", description: "문제를 풀고 채점 결과를 확인한 뒤 틀린 문제는 오답노트와 복습으로 다시 연결합니다." },
  { title: "4. AI 튜터 활용", description: "AI 설명은 정답과 오답의 이유를 이해하는 참고 자료로 활용하고 공식 기준과 함께 확인합니다." },
];

export default function GuidePage() {
  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">학습 가이드</p>
          <h1>SECURIUM 학습 가이드</h1>
          <p>처음 방문한 학습자도 과정 선택부터 진도 관리, 문제풀이와 복습까지 자연스럽게 이어갈 수 있도록 핵심 흐름을 정리했습니다.</p>
        </div>
      </section>
      <section className="section">
        <div className="shell narrow">
          <div className="course-detail-section">
            <p className="eyebrow">처음 시작하기</p>
            <h2>이렇게 시작하세요</h2>
            <div className="value-grid">
              {guideSteps.map((step) => (
                <article className="value-card" key={step.title}>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="course-detail-section">
            <p className="eyebrow">추천 학습 순서</p>
            <h2>학습 기록을 다음 행동으로 연결하세요</h2>
            <ul className="feature-list">
              <li>과정 상세에서 목표와 콘텐츠 구성을 먼저 확인합니다.</li>
              <li>학습 화면에서 공식 커리큘럼 순서대로 이론을 익힙니다.</li>
              <li>문제풀이 결과를 오답노트와 복습 일정으로 연결합니다.</li>
              <li>AI 튜터 설명은 공식 콘텐츠와 채점 결과를 보완하는 참고 자료로 사용합니다.</li>
            </ul>
          </div>
          <div className="course-detail-section course-detail-bottom-cta">
            <div>
              <p className="eyebrow">{BRAND.englishName}</p>
              <h2>지금 과정을 둘러보세요</h2>
              <p>목표에 맞는 과정을 비교하고 실제 제공 콘텐츠를 확인한 뒤 학습을 시작할 수 있습니다.</p>
            </div>
            <ActionButton href="/courses" variant="dark" className="full-width">과정 둘러보기</ActionButton>
          </div>
        </div>
      </section>
    </main>
  );
}

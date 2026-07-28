import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "학습 가이드",
  description:
    "SECURIUM에서 과정 선택, 진도 관리, 문제풀이, 오답 복습을 시작하는 방법을 안내합니다.",
};

const guideSteps = [
  {
    title: "1. 목표 과정 선택",
    description:
      "ISMS-P, 정보보안기사, CPPG 등 준비하려는 전문 과정을 먼저 선택합니다. 과정별 진도와 문제풀이 기록은 서로 섞이지 않게 관리됩니다.",
  },
  {
    title: "2. 커리큘럼 확인",
    description:
      "과목과 주제 구성을 확인하고 현재 필요한 범위부터 학습을 시작합니다. 공개된 콘텐츠는 과정 상세 화면에서 확인할 수 있습니다.",
  },
  {
    title: "3. 문제풀이와 오답 정리",
    description:
      "학습한 주제와 연결된 문제를 풀고, 틀린 문제는 오답노트에서 다시 확인합니다. 아직 준비 중인 기능은 명확히 구분됩니다.",
  },
  {
    title: "4. AI 튜터 활용",
    description:
      "AI 설명은 학습 보조용으로 활용합니다. 공식 기준·법령·시험 채점 결과가 아니므로 중요한 판단은 최신 공식 자료와 함께 확인하세요.",
  },
];

export default function GuidePage() {
  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">LEARNING GUIDE</p>
          <h1>시큐리움 학습 가이드</h1>
          <p>
            처음 시작하는 학습자도 과정 선택부터 진도 관리, 문제풀이, 복습까지
            자연스럽게 이어갈 수 있도록 핵심 흐름을 정리했습니다.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="shell narrow">
          <div className="course-detail-section">
            <p className="eyebrow">START</p>
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
            <p className="eyebrow">RECOMMENDED FLOW</p>
            <h2>추천 학습 흐름</h2>
            <ul className="feature-list">
              <li>과정 상세에서 추천 대상과 학습 구성을 확인합니다.</li>
              <li>내 학습에 과정을 추가한 뒤 커리큘럼 순서대로 학습합니다.</li>
              <li>문제풀이와 오답노트를 반복해 취약 영역을 줄입니다.</li>
              <li>AI 튜터 설명은 이해 보조 자료로 활용합니다.</li>
            </ul>
          </div>

          <div className="course-detail-section course-detail-bottom-cta">
            <div>
              <p className="eyebrow">{BRAND.englishName}</p>
              <h2>지금 과정부터 둘러보세요</h2>
              <p>
                여러 정보보호·개인정보보호 전문 과정을 한곳에서 비교하고,
                나에게 맞는 학습 경로를 선택할 수 있습니다.
              </p>
            </div>
            <Link className="button button-dark full-width" href="/courses">
              과정 둘러보기
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

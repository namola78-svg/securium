import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "시큐리움 소개",
  description:
    "시큐리움 | SECURIUM은 정보보호·개인정보보호 전문가를 위한 AI 통합 학습 플랫폼입니다.",
};

const principles = [
  {
    title: "전문과정 통합",
    description:
      "정보보호와 개인정보보호 분야의 여러 전문 과정을 하나의 플랫폼에서 선택하고 이어서 학습할 수 있도록 설계했습니다.",
  },
  {
    title: "과정별 독립 진도",
    description:
      "동시에 여러 과정을 수강하더라도 진도, 문제풀이, 오답, 통계가 과정별로 분리되어 관리됩니다.",
  },
  {
    title: "AI 보조 학습",
    description:
      "AI 튜터는 학습 이해를 돕는 설명과 복습 방향을 제안합니다. 공식 기준이나 채점 결과와는 구분해 제공합니다.",
  },
];

export default function AboutPage() {
  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">ABOUT SECURIUM</p>
          <h1>시큐리움 | SECURIUM</h1>
          <p>{BRAND.shortDescription}</p>
        </div>
      </section>

      <section className="section">
        <div className="shell narrow">
          <article className="course-detail-section">
            <p className="eyebrow">MISSION</p>
            <h2>흩어진 보안 학습을 하나의 체계로 연결합니다</h2>
            <p>
              시큐리움은 자격시험 준비, 실무 사례 학습, 문제풀이, 오답 복습,
              AI 설명을 하나의 흐름으로 연결해 정보보호·개인정보보호 역량을
              체계적으로 성장시키는 것을 목표로 합니다.
            </p>
          </article>

          <article className="course-detail-section">
            <p className="eyebrow">PRINCIPLES</p>
            <h2>학습 설계 원칙</h2>
            <div className="value-grid">
              {principles.map((principle) => (
                <article className="value-card" key={principle.title}>
                  <h3>{principle.title}</h3>
                  <p>{principle.description}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="course-detail-section">
            <p className="eyebrow">FOR LEARNERS</p>
            <h2>이런 학습자를 위해 만들었습니다</h2>
            <ul className="feature-list">
              <li>정보보호·개인정보보호 자격시험을 준비하는 학습자</li>
              <li>ISMS-P, CPPG, 정보보안기사 등 전문 과정을 비교하고 싶은 학습자</li>
              <li>오답과 취약 영역을 기준으로 반복 학습하고 싶은 실무자</li>
              <li>AI 설명을 보조 도구로 활용해 개념 이해를 넓히고 싶은 학습자</li>
            </ul>
          </article>

          <article className="course-detail-section course-detail-bottom-cta">
            <div>
              <p className="eyebrow">GET STARTED</p>
              <h2>내 학습 여정을 시작하세요</h2>
              <p>
                공개된 과정 목록에서 현재 목표에 맞는 과정을 선택하고, 과정별
                진도를 분리해 관리해 보세요.
              </p>
            </div>
            <Link className="button button-dark full-width" href="/courses">
              과정 보러가기
            </Link>
          </article>
        </div>
      </section>
    </main>
  );
}

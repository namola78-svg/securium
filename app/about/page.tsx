import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/design-system-primitives";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "SECURIUM 소개", description: "SECURIUM은 정보보안과 개인정보보호 학습을 연결하는 플랫폼입니다." };

const principles = [
  { title: "전문 과정 통합", description: "정보보안 자격증, 개인정보보호와 실무 과정을 한 플랫폼에서 비교하고 학습합니다." },
  { title: "과정별 독립 진도", description: "여러 과정을 수강해도 진도, 문제풀이, 오답과 통계는 과정별로 분리해 관리합니다." },
  { title: "AI 보조 학습", description: "AI 튜터는 문제를 이해하는 참고 설명과 복습 방향을 제공하며 공식 채점 결과를 대신하지 않습니다." },
];

export default function AboutPage() {
  return <main className="page-main"><section className="page-hero"><div className="shell"><Link href="/" className="breadcrumb">홈으로 돌아가기</Link><p className="eyebrow">SECURIUM 소개</p><h1>정보보안 학습을 하나의 흐름으로</h1><p>{BRAND.shortDescription}</p></div></section><section className="section"><div className="shell narrow"><article className="course-detail-section"><p className="eyebrow">서비스 목표</p><h2>기준, 이론, 문제와 복습을 연결합니다</h2><p>SECURIUM은 자격시험 준비와 보안 실무 학습을 과정, 커리큘럼, 문제풀이, 오답 복습과 분석으로 연결해 학습자가 다음 행동을 쉽게 선택하도록 돕습니다.</p></article><article className="course-detail-section"><p className="eyebrow">학습 설계 원칙</p><h2>실제 학습에 필요한 것부터</h2><div className="value-grid">{principles.map((principle) => <article className="value-card" key={principle.title}><h3>{principle.title}</h3><p>{principle.description}</p></article>)}</div></article><article className="course-detail-section"><p className="eyebrow">학습자를 위해</p><h2>문제풀이와 복습을 계속 이어가도록</h2><ul className="feature-list"><li>목표에 맞는 과정을 비교하고 실제 제공 콘텐츠를 확인합니다.</li><li>공식 커리큘럼과 연결된 이론·문제를 과정별로 학습합니다.</li><li>오답과 취약 영역을 복습 루틴으로 다시 연결합니다.</li><li>AI 설명은 근거와 한계를 구분해 참고 자료로 제공합니다.</li></ul></article><article className="course-detail-section course-detail-bottom-cta"><div><p className="eyebrow">학습 시작</p><h2>지금 목표에 맞는 과정을 찾아보세요</h2><p>공개된 과정과 콘텐츠 수를 확인한 뒤 현재 목표에 맞는 학습 경로를 선택할 수 있습니다.</p></div><ActionButton href="/courses" variant="dark" className="full-width">과정 둘러보기</ActionButton></article></div></section></main>;
}

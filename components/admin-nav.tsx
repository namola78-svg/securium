"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminNavItem = {
  href: string;
  label: string;
  description: string;
};

type AdminNavGroup = {
  title: string;
  items: AdminNavItem[];
};

const adminNavigation: AdminNavGroup[] = [
  {
    title: "운영",
    items: [
      {
        href: "/admin",
        label: "운영 개요",
        description: "관리 지표와 주요 작업 상태",
      },
      {
        href: "/admin/analytics",
        label: "학습 분석",
        description: "과정별 학습·성과 지표",
      },
      {
        href: "/admin/audit-logs",
        label: "감사로그",
        description: "중요 관리자 작업 이력",
      },
    ],
  },
  {
    title: "과정",
    items: [
      {
        href: "/admin/course-groups",
        label: "과정군",
        description: "과정 상위 분류 관리",
      },
      {
        href: "/admin/courses",
        label: "과정",
        description: "과정 공개·정렬·상태 관리",
      },
      {
        href: "/admin/levels",
        label: "단계",
        description: "과정별 단계와 잠금 조건",
      },
    ],
  },
  {
    title: "커리큘럼·콘텐츠",
    items: [
      {
        href: "/admin/curriculum",
        label: "Curriculum",
        description: "공식 출제기준 트리와 커버리지",
      },
      {
        href: "/admin/shared-content",
        label: "공통 콘텐츠",
        description: "여러 과정에서 재사용되는 학습 콘텐츠",
      },
      {
        href: "/admin/lessons",
        label: "레슨",
        description: "본문형 이론 레슨 관리",
      },
      {
        href: "/admin/content-revisions",
        label: "버전",
        description: "기준일과 콘텐츠 개정 이력",
      },
    ],
  },
  {
    title: "문제·평가",
    items: [
      {
        href: "/admin/questions",
        label: "문제은행",
        description: "문제 등록·수정·연결",
      },
      {
        href: "/admin/reviews",
        label: "문제 검수",
        description: "승인·반려·게시 흐름",
      },
      {
        href: "/admin/mock-exams",
        label: "모의고사",
        description: "시험 구성과 응시 현황",
      },
      {
        href: "/admin/question-reports",
        label: "문제 신고",
        description: "사용자 신고 처리",
      },
    ],
  },
  {
    title: "지식·AI",
    items: [
      {
        href: "/admin/ontology",
        label: "Ontology",
        description: "개념·별칭·관계 매핑",
      },
      {
        href: "/admin/ai-explainability",
        label: "AI Trace",
        description: "검색 근거와 프롬프트 추적",
      },
      {
        href: "/admin/ai-reviews",
        label: "AI 검수",
        description: "AI 결과 검수와 승인",
      },
    ],
  },
  {
    title: "특화 과정",
    items: [
      {
        href: "/admin/specialized",
        label: "과정 특화",
        description: "ISMS-P·CPPG·ISRM 특화 콘텐츠",
      },
      {
        href: "/admin/practical-specializations",
        label: "실무 특화",
        description: "SW 보안약점·PIA 실무형 콘텐츠",
      },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname() ?? "/admin";

  return (
    <nav className="admin-nav" aria-label="관리자 메뉴">
      {adminNavigation.map((group) => (
        <section className="admin-nav-group" key={group.title}>
          <h2>{group.title}</h2>
          <div className="admin-nav-items">
            {group.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={active ? "active" : undefined}
                  href={item.href}
                  key={item.href}
                  title={item.description}
                >
                  <span>{item.label}</span>
                  <small>{item.description}</small>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

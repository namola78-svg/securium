export type NavItem = { href: string; label: string; disabled?: boolean };

export function isLearnerFocusRoute(pathname: string): boolean {
  return pathname.startsWith("/practice/") || pathname.startsWith("/mock-exams/attempts/");
}

export type MobileNavIcon =
  | "home"
  | "book-open"
  | "file-question"
  | "clipboard-check"
  | "graduation-cap"
  | "rotate-ccw"
  | "bookmark"
  | "chart"
  | "user"
  | "sparkles"
  | "settings";

export type MobileBottomNavItem = {
  href: string;
  label: string;
  icon: MobileNavIcon;
  activeHrefs: readonly string[];
};

export type LearnerShellNavItem = NavItem & {
  icon: MobileNavIcon;
  activeHrefs: readonly string[];
  badge?: string;
};

export const publicNavItems: NavItem[] = [
  { href: "/courses", label: "과정" },
  { href: "/guide", label: "학습 가이드" },
  { href: "/about", label: "시큐리움 소개" },
];

export const learnerPrimaryNavItems: NavItem[] = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/my-courses", label: "이론 학습" },
  { href: "/practice", label: "문제풀이" },
  { href: "/practical", label: "실무" },
  { href: "/my-learning", label: "내 학습" },
];

export const learnerUtilityNavItems: NavItem[] = [
  { href: "/ai-tutor", label: "AI 튜터" },
  { href: "/bookmarks", label: "북마크" },
  { href: "/wrong-notes", label: "오답노트" },
  { href: "/reviews", label: "복습" },
  { href: "/analytics", label: "학습 분석" },
];

export const learnerShellPrimaryItems: readonly LearnerShellNavItem[] = [
  { href: "/dashboard", label: "홈", icon: "home", activeHrefs: ["/dashboard"] },
  { href: "/my-courses", label: "학습", icon: "book-open", activeHrefs: ["/my-courses", "/my-learning", "/learn", "/lectures", "/practical"] },
  { href: "/practice", label: "문제", icon: "file-question", activeHrefs: ["/practice", "/questions"] },
  { href: "/mock-exams", label: "모의고사", icon: "clipboard-check", activeHrefs: ["/mock-exams"] },
];

export const learnerShellSecondaryItems: readonly LearnerShellNavItem[] = [
  { href: "/wrong-notes", label: "오답노트", icon: "rotate-ccw", activeHrefs: ["/wrong-notes", "/reviews"] },
  { href: "/bookmarks", label: "북마크", icon: "bookmark", activeHrefs: ["/bookmarks"] },
  { href: "/analytics", label: "학습 분석", icon: "chart", activeHrefs: ["/analytics"] },
];

export const learnerShellAccountItems: readonly LearnerShellNavItem[] = [
  { href: "/profile", label: "마이페이지", icon: "user", activeHrefs: ["/profile", "/settings"] },
];

export const learnerShellSupportItems: readonly LearnerShellNavItem[] = [
  { href: "/ai-tutor", label: "AI 튜터", icon: "sparkles", activeHrefs: ["/ai-tutor"], badge: "Beta" },
];

export const mobileBottomNavItems = [
  { href: "/dashboard", label: "홈", icon: "home", activeHrefs: ["/dashboard"] },
  { href: "/my-courses", label: "학습", icon: "book-open", activeHrefs: ["/my-courses", "/my-learning", "/learn", "/lectures", "/practical"] },
  { href: "/practice", label: "문제", icon: "file-question", activeHrefs: ["/practice", "/questions"] },
  { href: "/mock-exams", label: "모의고사", icon: "clipboard-check", activeHrefs: ["/mock-exams"] },
  { href: "/profile", label: "MY", icon: "graduation-cap", activeHrefs: ["/profile", "/settings", "/wrong-notes", "/reviews", "/analytics", "/bookmarks"] },
] as const;

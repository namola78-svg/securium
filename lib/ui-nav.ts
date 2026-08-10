export type NavItem = {
  href: string;
  label: string;
  disabled?: boolean;
};

export type MobileBottomNavItem = {
  href: string;
  label: string;
  icon: string;
  activeHrefs: readonly string[];
};

export const publicNavItems: NavItem[] = [
  { href: '/courses', label: '과정' },
  { href: '/guide', label: '학습 가이드' },
  { href: '/about', label: '시큐리움 소개' },
];

export const learnerPrimaryNavItems: NavItem[] = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/my-courses', label: '이론 학습' },
  { href: '/practice', label: '문제풀이' },
  { href: '/practical', label: '실무' },
  { href: '/my-learning', label: '내 학습' },
];

export const learnerUtilityNavItems: NavItem[] = [
  { href: '/ai-tutor', label: 'AI 튜터' },
  { href: '/bookmarks', label: '북마크' },
  { href: '/wrong-notes', label: '오답노트' },
  { href: '/reviews', label: '복습' },
  { href: '/analytics', label: '학습 분석' },
];

export const mobileBottomNavItems = [
  {
    href: '/dashboard',
    label: '홈',
    icon: 'H',
    activeHrefs: ['/dashboard'],
  },
  {
    href: '/my-courses',
    label: '학습',
    icon: 'L',
    activeHrefs: ['/my-courses', '/learn', '/courses'],
  },
  {
    href: '/practice',
    label: '문제',
    icon: 'Q',
    activeHrefs: ['/practice', '/questions'],
  },
  {
    href: '/practical',
    label: '실무',
    icon: 'P',
    activeHrefs: ['/practical'],
  },
  {
    href: '/my-learning',
    label: '내 학습',
    icon: 'M',
    activeHrefs: ['/my-learning', '/reviews', '/analytics', '/bookmarks', '/wrong-notes'],
  },
] as const;

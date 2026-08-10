# SECURIUM FULL PRODUCT UI/UX AUDIT REPORT

Audit date: 2026-08-10 (Asia/Seoul)

## A. Repository 조사 범위

실제 저장소의 `app/**`, `components/**`, `lib/**`, `db/**`, `tests/**`, `scripts/**`, `public/**`, `package.json`, `app/globals.css`, 주요 shared primitive/header 파일과 Git 상태를 조사했다.

파일 inventory: app 140, components 50, lib 66, db 43, tests 67, scripts 29, public 5.

실제 route inventory: `app/**/page.tsx` 71개, `app/**/route.ts` 60개를 확인했다. 전체 목록은 [ui-route-inventory.md](./ui-route-inventory.md)에 기록했다. 주요 learner route는 `/dashboard`, `/my-courses`, `/my-learning`, `/learn/**`, `/practice/**`, `/practical/**`, `/reviews`, `/wrong-notes`, `/bookmarks`, `/analytics/**`, `/ai-tutor`, `/profile`, `/settings`이다.

## B. 발견 문제

- P0 / 수정: dark hero 안의 white AI preview card에서 본문·결과 텍스트가 상속 색상 때문에 거의 보이지 않았다.
- P0 / 수정: dark header의 ghost 로그인 버튼과 hero outline CTA가 dark ink를 사용해 대비가 부족했다.
- P1 / PARTIAL: learner/admin 화면은 인증 세션이 없어 production에서 직접 상호작용 검증하지 못했다.
- P1 / 수정: Reviews에서 `summary.byCourse` empty-state와 `!hasDue` 하단 empty-state가 동시에 렌더될 수 있던 중복 조건을 정리했다.
- P1 / 남음: 10–11px metadata/caption이 여러 selector에 존재한다. 이번 변경에서는 전면 typography 재설계 없이 P0 대비만 수정했다.
- P2 / 남음: media query breakpoint가 375/520/640/680/760/820/900/960/1024/1100px로 분산되어 있어 후속 통합 audit이 필요하다.

## C. Design System

기존 dark navy/charcoal + lime/aqua/neutral 토큰을 유지했다. `ActionButton`의 기존 variant와 `StatusBadge` tone을 유지했으며 dependency나 새 UI library는 추가하지 않았다.

수정 파일: `app/globals.css`

- `.site-header .ds-button.variant-ghost`: inverse text와 명시적 border 적용
- `.hero .ds-button.variant-outline`: inverse text와 dark-context border 적용
- `.hero-panel .ai-result-card`: light surface용 primary/secondary hierarchy 및 outcome card 색상 명시

## D. Contrast

수정 전: dark surface의 기본 `.ds-button.variant-ghost/outline`가 `var(--ink)`를 사용했고, `.ai-result-card` 내부 일부 child가 hero용 white text를 상속했다.

수정 후: dark context는 `--color-text-inverse`, light preview card는 `--color-text-primary`, `--color-text-secondary`, `--color-info`로 분리했다. 정적 CSS cascade 기준으로 의도한 selector가 기존 global rule보다 높은 specificity를 갖는다.

WCAG 결과: 수정 대상은 PASS 의도와 코드 근거를 확인했으나, 자동 axe 수치 측정은 실행하지 못했으므로 전체 contrast audit은 PARTIAL이다.

## E. Public UX

`/`, `/courses`, `/guide`, `/about`, `/login`을 Playwright MCP로 production에서 열고 title/주요 landmark를 확인했다. 랜딩의 핵심 메시지와 학습 흐름은 유지했고, fake statistic/social proof를 추가하지 않았다.

## F. Learner UX

코드 수준에서 dashboard, my-learning, practice session, reviews, wrong-notes, bookmarks, analytics, AI tutor, practical의 상태/CTA/component를 조사했다. 실제 로그인된 브라우저 세션이 없어 다음 항목의 직접 QA는 PARTIAL/BLOCKED다: dashboard hierarchy, practice 제출·채점·AI 설명, review empty-state 상호작용, analytics, AI tutor, practical.

## G. Navigation

기존 desktop primary/utility navigation, mobile drawer, 5-item bottom navigation, profile menu 및 Escape/focus 관련 구현을 보존했다. production 비로그인 상태에서 learner 보호 route가 `/login?return_to=...`로 리다이렉트되는 것을 확인했다.

## H. Responsive

Production `/`를 Playwright MCP로 390×844, 768×1024, 1024×768, 1440×900에서 확인했다. 각 viewport에서 `scrollWidth === clientWidth`였고 수평 overflow는 0이었다.

320, 375, 430, 960, 1280, 1920은 직접 브라우저 검증하지 않아 NOT VERIFIED/PARTIAL이다.

## I. Accessibility

Skip link, semantic main/header/footer, navigation labels, aria-expanded/controls 등 기존 구조를 확인했다. production console warning/error는 0건이었다. axe/스크린리더/키보드 전수 검증은 실행하지 못해 PARTIAL이다.

## J. Browser QA

Playwright MCP를 실제 호출했다. production 공개 route와 보호 route를 확인하고 home screenshot matrix를 생성했다.

- `/`, `/courses`, `/guide`, `/about`, `/login`: PASS
- 보호 learner route: redirect PASS, authenticated flow BLOCKED
- 390/768/1024/1440 screenshots: PASS (production 기준, 수정 전 배포 상태)
- in-app browser skill runtime: BLOCKED (`No browser is available`); Playwright MCP fallback은 사용 가능

## K. Console QA

Playwright MCP `browser_console_messages(level=warning, all=true)` 결과: total 0, errors 0, warnings 0.

## L. Test

- lint: PASS
- typecheck: PASS
- unit: PASS (312/312)
- integration: PARTIAL (14/23 pass, 9 fail; stale rendered-copy/fixture expectations 포함)
- build: PASS
- build:cloudflare: PASS
- vinext check: PASS (19 supported, 0 partial, 0 issues; overall 100% compatible)
- e2e: BLOCKED (전체 suite 244초 제한 내 미완료; 단독 `phase3-e2e.test.mjs`도 124초 제한 내 미완료)
- git diff --check: PASS

## M. Git

HEAD: `f8f24b5`

branch: `main`

UI audit 변경 파일: `app/globals.css`, `app/reviews/page.tsx`

기존 사용자 변경인 content-upgrade 산출물, Playwright 산출물, 기존 이미지 파일은 보존했다. commit/push: 수행하지 않음.

## N. Deployment

Vercel: 기존 project/URL 유지

Production URL: https://securium.vercel.app/

Smoke: 공개 route PASS. 이번 CSS 수정은 로컬 working tree에만 있으며 Vercel에 배포하지 않았으므로 production은 수정 전 배포 상태다.

## O. Remaining Problems

- P1 — authenticated browser fixture/session 부재: learner/admin 전체 화면과 실제 practice/review/AI flow를 직접 검증해야 한다.
- P1 — integration 9건 실패: UI를 과거 문구로 되돌리지 말고 각 assertion을 stale copy, fixture mismatch, domain/runtime issue로 재분류해 갱신해야 한다.
- P1 — e2e timeout: 단독 phase3 suite도 완료되지 않아 runtime fixture 또는 테스트 서버 lifecycle을 먼저 점검해야 한다. `vinext check`는 100% compatible이므로 정적 호환성 문제는 아니다.
- P2 — 전체 320–1920 breakpoint matrix와 axe audit 미실행: PASS로 간주하면 안 된다.
- P2 — 10–11px typography와 fragmented breakpoints: 후속 별도 refinement가 필요하다.

## P. FINAL VERDICT

PARTIALLY VERIFIED

# Sprint UI-1 Status

SECURIUM UI Foundation Sprint의 현재 완료 상태를 정리한다.

이 문서는 구현된 사실과 남은 설계 과제를 분리하기 위한 운영 체크리스트다.

## Overall Verdict

**CONDITIONAL COMPLETE**

Foundation 문서 체계, 핵심 디자인 원칙, 화면 인벤토리, Command Palette, Inspector Panel 기반은 구축되었다. 다만 전체 학생·관리자·AI·Ontology 화면의 세부 와이어프레임과 컴포넌트 전면 적용은 다음 Sprint에서 계속 진행해야 한다.

## Status Table

| Step | Status | Evidence | Remaining Work |
| --- | --- | --- | --- |
| Brand Foundation | Done | `docs/product/brand.md`, `docs/design/foundation.md` | 실제 로고·아이콘 에셋 고도화 |
| Design Principles | Done | `docs/design/foundation.md`, `docs/product/design.md` | 화면 리뷰 때 원칙 준수 체크 반복 |
| Design Token | Done | `docs/product/token.md`, `docs/design/design-system-direction.md`, `app/globals.css` | 토큰을 CSS 변수/컴포넌트 API로 더 엄격히 표준화 |
| Layout System | Partial | `docs/design/foundation.md`, `app/admin/layout.tsx`, `app/admin/page.tsx` | 학생 화면과 관리자 상세 화면까지 레이아웃 패턴 확장 |
| Navigation | Partial | `components/admin-nav.tsx`, `components/command-palette.tsx` | 모든 실제 라우트와 권한별 메뉴 동기화 검수 |
| Component Library | Partial | `docs/design/component-library.md`, `components/design-system-primitives.tsx` | Button, Card, Table, Tree, Dialog, Drawer, Search, Toast, Tabs 구현 표준화 |
| Screen Inventory | Done | `docs/design/screen-inventory.md` | 화면별 우선순위와 MVP/Advanced 구분 보강 |
| Wireframe | Pending | 화면 인벤토리는 완료 | 학생 핵심 15개, 관리자 핵심 20개, AI 10개, Ontology 15개 와이어프레임 작성 |
| Admin Console | Partial | `app/admin/page.tsx`, `docs/design/admin-console-ux.md` | Coverage, Ontology, AI Trace, Audit 등 콘솔별 공통 패턴 적용 |
| Student Console | Partial | 기존 학생 라우트와 `docs/design/learner-experience-ux.md` | Dashboard, Learn, Course, Question, Review, AI Tutor 화면 재정렬 |
| Inspector Panel | Done / Rollout Partial | `components/design-system-primitives.tsx`, `app/admin/page.tsx` | Curriculum, Ontology, Coverage, AI Trace 화면으로 적용 확대 |
| Command Palette | Done / Initial | `components/command-palette.tsx`, `app/layout.tsx` | 관리자 권한별 명령 필터, 최근 사용 명령, 검색 동의어 |
| Design Documentation | Done / Living | `docs/product/README.md`, `docs/design/*` | 구현 변경 시 계속 업데이트 |

## Implemented UI Foundation

- Global Command Palette: `Ctrl/Cmd + K`로 주요 학습·관리 라우트 검색
- Inspector Panel primitive: 선택한 리소스의 메타데이터와 상태를 우측 패널 형태로 표시할 수 있는 기반
- Admin overview refresh: 운영 지표와 설계 방향을 한 화면에서 볼 수 있도록 정리
- Product documentation hub: Brand, Design, UX, IA, Flow, Learning, Ontology, AI, Coverage, Admin, Student, Component, Token, Accessibility, Motion, Roadmap 분리

## Known Gaps

1. 아직 Figma 수준의 화면별 와이어프레임은 생성되지 않았다.
2. 컴포넌트 문서는 작성됐지만 모든 컴포넌트가 실제 코드 프리미티브로 구현된 것은 아니다.
3. Command Palette는 초기 버전이며 권한별 명령 노출 정책은 추가 검증이 필요하다.
4. Inspector Panel은 관리자 대시보드에 우선 적용됐고, 전체 관리자 콘솔에는 아직 확산되지 않았다.
5. 모바일·접근성 세부 측정은 별도 UX QA Sprint에서 다시 확인해야 한다.

## Recommended Next Sprint

**Sprint UI-2: Core Wireframe Sprint**

권장 순서:

1. Student Core Wireframe
   - Dashboard
   - My Courses
   - Course Detail
   - Learn Overview
   - Lesson
   - Question Practice
   - Review
   - AI Tutor
   - Analytics

2. Admin Core Wireframe
   - Admin Dashboard
   - Curriculum Tree
   - Content Mapping
   - Coverage Console
   - AI Explainability Console
   - Ontology Explorer
   - Audit Log

3. Component Implementation
   - Button
   - Card
   - Table
   - Tree
   - Drawer
   - Dialog
   - Tabs
   - Toast

## Operational Boundary

이번 Sprint에서는 Production DB, seed, 외부 배포 설정을 변경하지 않았다.


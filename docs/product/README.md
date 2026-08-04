# SECURIUM Product Documentation

`docs/product`는 SECURIUM의 제품 설계 문서 허브다.

기존 `docs/design` 문서가 UI/UX Foundation의 산출물을 담는다면, `docs/product`는 브랜드, IA, 학습 경험, AI, 온톨로지, 관리자, 접근성, 로드맵까지 제품 전체를 연결하는 상위 분류 체계다.

## Document Structure

| Area | Document | Purpose |
| --- | --- | --- |
| Brand | `brand.md` | SECURIUM 브랜드 정체성과 공식 문구 |
| Design | `design.md` | 제품 디자인 원칙 |
| UX | `ux.md` | 사용자 경험 기준 |
| IA | `ia.md` | 정보 구조와 사이트맵 |
| Flow | `flow.md` | 주요 사용자 흐름 |
| Learning | `learning.md` | 학습 경험과 커리큘럼 흐름 |
| Ontology | `ontology.md` | 개념 연결과 지식 구조 |
| AI | `ai.md` | AI Tutor, Retrieval, Explainability 방향 |
| Coverage | `coverage.md` | 공식 기준 대비 커버리지 관리 |
| Admin | `admin.md` | 관리자 콘솔 구조 |
| Student | `student.md` | 학습자 콘솔 구조 |
| Component | `component.md` | 컴포넌트 설계 기준 |
| Token | `token.md` | 디자인 토큰 기준 |
| Accessibility | `accessibility.md` | 접근성 기준 |
| Motion | `motion.md` | 전환과 인터랙션 모션 기준 |
| Roadmap | `roadmap.md` | 제품·디자인 로드맵 |

## Sprint Documents

| Sprint | Document | Status |
| --- | --- | --- |
| UI-1 Product Design Foundation | `sprint-ui-1.md` | Foundation 기준 문서 |
| UI-1 Status | `sprint-ui-1-status.md` | 현재 완료·미완료 체크리스트 |
| UI-2 Core Wireframe Sprint | `sprint-ui-2.md` | 핵심 화면 와이어프레임 기준 |
| UI-2 Review Gate | `../ui/review-gate.md` | 구현 전 핵심 화면 리뷰 기준 |
| Console Shell Wireframe | `../ui/console-shell-wireframe.md` | 관리자 공통 Shell 상세 기준 |
| Console Shell High-Fidelity | `../ui/console-shell-high-fidelity.md` | UI-2C 관리자 Shell 세부 설계 |
| Core Screen Review Package | `../ui/core-screen-review-package.md` | UI-2D 핵심 화면 리뷰 패키지 |
| Core Screen Review Checklist | `../ui/core-screen-review-checklist.md` | UI-2D 리뷰 체크리스트 |
| Component Implementation Readiness | `../ui/component-implementation-readiness.md` | UI-2E 컴포넌트 구현 준비도 |
| Component Implementation Map | `../ui/component-implementation-map.md` | UI-3 컴포넌트 구현 분할 |
| UI-3A Scope Lock | `../ui/ui-3a-scope-lock.md` | UI-3A 구현 범위 잠금 |
| UI-3A Implementation Checklist | `../ui/ui-3a-implementation-checklist.md` | UI-3A 파일별 구현 체크리스트 |

## Usage Rules

1. 제품 의사결정은 먼저 `docs/product`에서 위치를 잡는다.
2. 화면과 컴포넌트 상세 설계는 `docs/design` 문서를 참조한다.
3. 구현 세부, DB, 배포, 보안 운영 문서는 기존 `docs` 루트 문서를 참조한다.
4. 문서를 삭제하거나 이동하기보다 상위 인덱스에서 연결한다.
5. 구현이 변경되면 관련 제품 문서와 상태 문서도 함께 갱신한다.

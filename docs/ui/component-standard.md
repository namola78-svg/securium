# Component Standard

SECURIUM 컴포넌트 표준은 학습 화면과 관리자 Console에서 동일한 판단 기준을 제공한다.

컴포넌트 구현은 Console Shell과 핵심 학습 화면의 정보 구조가 리뷰된 뒤 진행한다. 먼저 Button, Card, Table, Tree, Drawer, Dialog를 우선 표준화한다.

## Button

| Variant | Use |
| --- | --- |
| Primary | 가장 중요한 단일 행동 |
| Secondary | 보조 행동 |
| Danger | 삭제, 비활성화, 권한 회수 |
| Ghost | 낮은 강조의 보조 이동 |
| Icon Button | compact action, 반드시 `aria-label` 필요 |
| FAB | 모바일에서 주요 생성 행동이 명확할 때만 제한 사용 |

기준:

- 최소 높이 44px
- loading 상태 제공
- disabled는 `cursor-not-allowed`와 시각적 대비 제공
- focus-visible ring 필수

## Card

- 정보 묶음 또는 비교 단위에 사용한다.
- 카드 제목은 내부 코드명이 아니라 사용자가 이해하는 이름을 우선한다.
- CTA는 가능하면 카드 하단에 고정한다.

## Badge

- 상태, 버전, 검수 여부, 공개 여부를 짧게 표시한다.
- 긴 설명 문장을 반복하지 않는다.

## Table

- 관리자 대량 데이터 검토에 사용한다.
- 정렬, 필터, pagination을 명확히 제공한다.
- 모바일에서는 카드형 대체 레이아웃을 고려한다.

## Tree

| Variant | Use |
| --- | --- |
| Compact | 학습자 커리큘럼 탐색 |
| Explorer | 관리자 리소스 탐색 |
| Ontology | 개념 관계 탐색 |

## Drawer

- 현재 맥락을 유지하면서 상세 정보를 보여줄 때 사용한다.
- 모바일 inspector의 기본 형태다.

## Dialog

- 사용자의 결정을 멈춰 세워야 하는 확인, 위험 작업, 짧은 입력에 사용한다.
- 긴 편집은 Dialog가 아니라 Drawer 또는 별도 페이지를 사용한다.

## Tabs

- 같은 리소스의 동등한 하위 관점을 전환할 때 사용한다.
- 서로 다른 작업 흐름을 Tabs로 숨기지 않는다.

## Search

- Command Palette: 전역 이동
- Page Search: 현재 화면 내 검색
- Filter Search: 데이터 목록 필터링

## Filter

- 과정, 과목, 주제, 상태, 난이도, 검수자, 기간을 우선 지원한다.

## Toast

- 저장, 복사, 간단한 실패 등 짧은 결과 알림에 사용한다.
- 중요한 오류는 Inline Error 또는 Error State로 표시한다.

## Pagination

- 관리자 Table의 기본 패턴이다.
- 무한 스크롤은 감사로그, 검수 목록처럼 정확한 위치가 중요한 화면에서는 피한다.

## Empty State

- 무엇이 비어 있는지와 다음 행동을 함께 안내한다.

## Loading Skeleton

- 실제 콘텐츠 크기와 비슷하게 표시해 layout shift를 줄인다.

## Error State

- 민감한 내부 오류를 노출하지 않는다.
- 재시도 버튼을 제공한다.

## Inspector Panel

- 선택한 리소스의 summary, metadata, relation, action을 보여준다.
- 목록에서 선택한 항목의 상세를 반복적으로 확인하는 화면에 적합하다.

## Command Palette

- 전역 이동, 관리자 빠른 작업, 최근 리소스 탐색에 사용한다.
- 권한이 없는 명령은 표시하지 않는다.

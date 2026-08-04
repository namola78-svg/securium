# Navigation Pattern

SECURIUM 내비게이션은 학습자와 관리자의 사용 맥락을 분리한다.

Navigation은 Console Shell과 학생 학습 흐름이 확정된 뒤 세부 구현한다. Header, Sidebar, Breadcrumb, Account Drawer는 화면마다 새로 만들지 않고 공통 패턴을 재사용한다.

관리자 내비게이션의 기준 골격은 [Console Shell High-Fidelity Wireframe](./console-shell-wireframe.md)을 따른다.

## Header

- 공개 화면: 과정, 학습 가이드, 시큐리움 소개, 로그인, 무료로 시작하기
- 로그인 후: 내 학습, 문제풀이, 오답노트, AI 튜터, 프로필 메뉴
- 관리자: Console Shell 안에서 Sidebar 중심

## Sidebar

관리자 Console에서 사용한다.

순서:

1. Dashboard
2. Curriculum
3. Content
4. Question
5. Ontology
6. Coverage
7. AI Trace
8. AI Feedback
9. Audit
10. Settings

## Breadcrumb

- 관리자 상세 화면과 깊은 학습 화면에서 현재 위치를 알려준다.
- 학습 화면에서는 Course → Subject → Topic → Lesson 순서를 따른다.

## Search

- 전역 검색: Command Palette
- 현재 화면 검색: Page toolbar
- 필터 검색: Table/Tree filter

## Account Drawer

포함:

- 프로필
- 학습 설정
- 관리자 화면: 권한 있는 경우만
- 로그아웃

## Notification

- 검수 대기, AI 피드백, 운영 경고 등 행동 가능한 알림에 사용한다.
- 학습자에게는 복습 예정, 완료 축하, 오류 복구 중심으로 제한한다.

## Inspector

- Tree, Table, Timeline, Explorer에서 선택한 항목의 상세를 제공한다.
- 모바일에서는 drawer로 전환한다.

## Console Shell

관리자 화면의 기본 구조다.

```text
Top Bar
Sidebar
Main Content
Inspector Panel
```

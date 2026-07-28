# Phase 0~4 통합 검수 보고서

기준일: 2026-07-27

이 문서는 확인된 사실과 후속 제안을 구분한다. 검수 중 로컬 데이터베이스 초기화, 기존 데이터 삭제, Seed 재실행은 수행하지 않았다.

## A. 현재 구현 완료 기능

### 확인된 사실

- 공개 화면: 랜딩, 과정 목록, 동적 과정 상세, 로그인, 회원가입 안내
- 사용자 화면: 통합 대시보드, 내 과정, 과정별 학습, 과목·주제, 단계 학습, 문제풀이, 오답노트, 즐겨찾기, 오늘의 복습, 모의고사, 통합·과정별 통계, 프로필
- 관리자 화면: 과정군·과정·과목·주제, 단계·단계 콘텐츠, 문제·검수·신고, 모의고사·섹션·문제 배정, 통계, 과정 특화 콘텐츠
- 과정 특화 화면: ISMS-P 기준·결함사례, CPPG 법령 버전, 기사 서술형 보조채점, ISRM 위험평가·위험등록부
- 인증: Sites가 전달하는 SIWC 사용자 헤더를 서버에서 확인하며 개발 환경에서만 `DEV_AUTH_EMAIL` 대체 인증을 허용
- 권한: USER, COURSE_MANAGER, CONTENT_EDITOR, CONTENT_REVIEWER, ADMIN, SUPER_ADMIN 역할을 서버 페이지와 API에서 검증
- 데이터: Cloudflare D1과 Drizzle ORM, 44개 테이블, 마이그레이션 5개
- 문제 유형: OX, 단일선택, 복수선택, 단답형 자동채점. 나머지 유형은 저장·검수 구조와 “준비 중” 표시만 제공
- 공통 컴포넌트 17개가 모두 실제 화면에서 참조됨

### 페이지 목록

- 공개: `/`, `/courses`, `/courses/[courseSlug]`, `/login`, `/signup`
- 사용자: `/dashboard`, `/my-courses`, `/learn/[courseSlug]`, `/learn/[courseSlug]/subjects/[subjectId]`, `/learn/[courseSlug]/levels/[levelId]`, `/practice/[courseSlug]`, `/wrong-notes`, `/bookmarks`, `/reviews`, `/mock-exams`, `/mock-exams/[mockExamId]`, `/mock-exams/attempts/[attemptId]`, `/analytics`, `/analytics/[courseId]`, `/specialized/[courseSlug]`, `/specialized/[courseSlug]/[contentType]/[contentId]`, `/profile`
- 관리자: `/admin`, `/admin/course-groups`, `/admin/courses`, `/admin/courses/[courseId]`, `/admin/courses/[courseId]/subjects`, `/admin/subjects/[subjectId]/topics`, `/admin/levels`, `/admin/questions`, `/admin/questions/new`, `/admin/questions/[questionId]`, `/admin/reviews`, `/admin/question-reports`, `/admin/mock-exams`, `/admin/mock-exams/[mockExamId]`, `/admin/analytics`, `/admin/specialized`
- 공통 상태: 전역 loading, 오류, 404 화면

### API 목록

- 수강·학습: enrollments, enrollment status, levels, learning settings
- 문제: attempts, bookmarks, wrong notes, reports
- 모의고사: start, answer save, submit
- 특화 학습: bookmarks, written grade, risk calculate, risk register
- 관리자: course groups, courses, subjects, topics, levels, level contents, questions, clone, workflow, reports, mock exams, sections, questions, specialized content

### 데이터 모델

핵심 44개 테이블은 다음 영역으로 구분된다.

- 계정·권한: users, roles, user_roles, audit_logs
- 과정: course_groups, courses, subjects, topics, user_course_enrollments, user_progress
- 문제은행: questions, question_choices, question_courses, question_subjects, question_topics, question_versions, question_attempts, wrong_notes, bookmarks, question_reports, learning_activities
- 단계·복습·시험: levels, level_contents, user_level_progress, review_schedules, mock_exams, mock_exam_sections, mock_exam_questions, mock_exam_attempts, mock_exam_answers, user_learning_settings
- 특화 학습: course_specializations, isms_standards, isms_defect_cases, legal_articles, legal_article_versions, written_answer_rules, risk_calculation_methods, risk_grade_criteria, risk_scenarios, risk_register_items, content_course_links, content_question_links, content_bookmarks

## B. 발견된 문제

### 수정이 필요했던 문제

1. 문제 제출, 단계 평가, 모의고사 시작·제출 버튼에 요청 진행 잠금이 없어 빠른 중복 클릭 위험이 있었다.
2. 문제풀이 재시도 시 새로운 멱등성 키를 만들 수 있어 네트워크 재시도가 별도 통계로 반영될 여지가 있었다.
3. 모의고사 단답 입력을 키 입력마다 저장해 응답 순서가 뒤바뀔 수 있었다.
4. 잘못된 Origin 헤더가 URL 파싱 예외를 만들 수 있었다.
5. 관리자 수정 API가 존재하지 않는 과정군·과정·과목·주제 ID를 성공처럼 반환할 수 있었다.
6. API 조작으로 과목을 다른 과정으로, 주제를 다른 과목으로 이동하면 기존 학습기록 의미가 훼손될 수 있었다.
7. 주제의 상위 주제가 같은 과목에 속하는지와 자기 참조 여부를 서버에서 검증하지 않았다.
8. 타 사용자의 모의고사 URL과 잘못된 동적 URL에서 공통 404 처리가 부족했다.
9. README 상단과 Phase 2 제한 설명이 현재 Phase 3~4 구현 상태와 맞지 않았다.
10. 관리자 위험 시나리오 폼에 특정 과정 ID가 기본값으로 하드코딩되어 있었다.

### 미완성 또는 기술 부채

- 과목·주제별 본문형 이론 레슨 엔티티와 완료 기록은 없다. 현재 주제는 개발용 “준비 중” 안내다.
- 문제 목록은 `limit` 기반이며 사용자 문제풀이와 관리자 검색 모두 커서 기반 페이지네이션이 없다.
- 빠른·과목별·실전·오답·취약영역 모의고사 유형은 데이터 enum이 준비되어 있지만 유형별 자동 조합 엔진은 완성되지 않았다.
- 통합 통계와 추천 서비스는 과정별 반복 조회가 있어 수강 과정이 많아지면 N+1 비용이 증가한다.
- 문제 수정은 선택지·연결·버전 저장이 하나의 D1 batch로 묶이지 않아 중간 실패 시 부분 상태가 생길 수 있다.
- 모의고사 제출의 상태 선점, 답안 채점 갱신, 학습활동·복습일정 기록이 하나의 원자적 작업으로 묶이지 않았다.
- rate limit은 단일 Worker 인스턴스 메모리 방식이라 분산 운영에서 일관되지 않고 인스턴스 재시작 시 초기화된다.
- CSP가 프레임워크 호환을 위해 inline script/style을 허용한다. nonce/hash 기반 CSP가 더 안전하다.
- `examples/d1`, `public/file.svg`, `public/globe.svg`, `public/window.svg`, `outputs`, 일부 `work` 파일은 런타임 미사용 또는 개발 산출물 후보이다. 이번 검수에서는 삭제하지 않았다.
- 세 E2E 파일에 개발 서버 부팅 코드가 중복되어 있다.
- 전역 loading/error/404 상태는 추가했지만 실제 모바일·태블릿 브라우저의 시각 회귀 기준 이미지는 아직 없다.

## C. 수정 완료 항목

### 확인된 수정

- 핵심 작업 버튼에 ref 기반 동시 요청 차단과 disabled 상태를 추가
- 문제별 멱등성 키를 재사용하여 동일 제출 재시도가 한 번만 반영되도록 보강
- 모의고사 단답 입력은 로컬 편집 후 blur 시 임시 저장하도록 변경
- CSRF Origin/Referer 파싱을 예외 안전하게 변경
- 관리자 수정 대상 존재 여부 검사 추가
- 과목의 과정, 주제의 과목 소속을 학습기록 보호를 위해 수정 불가로 처리
- 상위 주제의 동일 과목 범위와 자기 참조 검사 추가
- 타 사용자 모의고사, 잘못된 단계·특화 콘텐츠 ID에 안전한 404 또는 안내 리다이렉트 적용
- 전역 loading, 오류, 404 상태 추가
- 긴 과정명·문제 지문에 `overflow-wrap: anywhere` 적용
- 관리자 위험 시나리오 과정 선택에서 특정 과정 ID 하드코딩 제거
- README의 현재 구현 범위와 자동채점·모의고사 제한 설명 수정

## D. 자동화 테스트 결과

### 실행 순서와 결과

| 검증 | 결과 | 비고 |
|---|---:|---|
| 패키지 설치 상태 | 통과 | `npm ls --depth=0`, 누락·invalid 의존성 없음 |
| Prisma validate/generate | 해당 없음 | Prisma 미사용 |
| Drizzle schema/generate | 통과 | 44개 테이블, 스키마 변경 없음 |
| TypeScript | 통과 | `tsc --noEmit` |
| Lint | 통과 | 오류·경고 없음 |
| 단위 테스트 | 통과 | 39개 |
| 통합/E2E | 통과 | 23개, 비로그인·권한·CSRF·멱등성·소유권 포함 |
| Production Build | 통과 | Vinext/Vite/Cloudflare Worker 빌드 |

총 62개 자동화 테스트(단위 39개, 통합/E2E 23개)가 통과했다.

### 데이터베이스 읽기 전용 검사

- 적용 대기 migration: 없음
- `PRAGMA foreign_key_check`: 오류 없음
- 중복 수강, 중복 오답노트, 중복 진도 scope, 중복 시험 답안 그룹: 모두 0
- 정보보안기사와 정보보안산업기사는 서로 다른 course ID를 기준으로 수강·진도·문제·오답·시험·통계·추천 조건이 분리됨

## E. 수동 검수 결과

### 코드와 렌더링 검수에서 확인

- 보호 페이지는 서버에서 인증을 요구하고, 관리자 layout과 API는 서버 역할 검사를 수행한다.
- 사용자별 조회는 user ID와 course/attempt/note ID를 함께 조건으로 사용한다.
- 정답과 선택지 해설은 문제 제출 전 공개 DTO와 시험 응답에서 제거된다.
- 복수선택은 정답 선택지 집합의 정확한 일치를 요구한다.
- 오답노트는 user/question/course 유일 키로 누적 갱신된다.
- 통계 정답률은 분모가 0이면 0을 반환한다.
- React 기본 escaping을 사용하며 `dangerouslySetInnerHTML`, 직접 SQL 문자열 조립, 비밀번호 저장, 파일 업로드 기능은 발견되지 않았다.
- 상태 변경 API는 same-origin 검사를 수행하고 오류 응답에 stack trace를 넣지 않는다.
- 키보드 focus-visible, reduced-motion, 폼 label, 정답·오답 텍스트 표시는 구현되어 있다.
- 960/900/760/680px 반응형 규칙과 긴 문자열 줄바꿈 처리가 존재한다.

### 확인하지 못한 항목

- 로컬 개발 서버는 자동화 HTTP 테스트에서는 정상 동작했지만, 현재 데스크톱 브라우저 격리 환경에서 localhost 연결이 허용되지 않아 실제 viewport 스크린샷 기반 모바일·태블릿·데스크톱 검수는 완료하지 못했다.
- 운영 Sites의 세션 만료 시간, 헤더 위조 방지, 분산 rate limit은 로컬 환경에서 검증할 수 없다.
- 대규모 운영 데이터에서의 쿼리 실행계획과 성능은 확인하지 않았다.

## F. 남아 있는 위험과 기술 부채

### 5단계와 병행 가능한 항목

- 이론 레슨 모델과 완료 기록 설계
- 문제·관리자 목록 커서 페이지네이션
- 통계·추천 쿼리 집계화
- D1 batch/멱등성 경계를 문제 수정과 모의고사 제출 전체로 확대
- Durable Object 또는 외부 저장소 기반 분산 rate limit
- 실제 브라우저 시각 회귀와 접근성 자동검사
- 미사용 샘플·정적 파일과 E2E 서버 helper 정리

### 5단계 전에 재확인이 필요한 조건

- 5단계가 본문형 이론 레슨 완료 데이터를 직접 사용한다면 레슨 엔티티를 먼저 구현해야 한다.
- 5단계가 운영 배포를 포함한다면 브라우저 시각 검수, 운영 인증 헤더, 원격 D1 migration 상태를 별도로 확인해야 한다.

## G. 5단계 진행 가능 여부

**CONDITIONAL GO: 명시된 경미한 항목을 관리하면서 진행 가능**

핵심 인증·권한·과정 격리·채점·오답·모의고사·통계 흐름과 Production Build는 통과했다. 이론 레슨, 페이지네이션, 분산 rate limit, 일부 트랜잭션 경계와 실제 브라우저 시각 검수는 5단계 요구사항의 의존 여부에 따라 선행 또는 병행해야 한다.

## 후속 보강 기록 · 2026-07-27

당시 선행 또는 병행 대상으로 분류한 다음 항목은 후속 작업에서 완료했다.

- `lessons` 본문형 이론 레슨과 관리자 등록·수정·공개 화면
- `user_lesson_progress` 사용자별 시작·완료 원천 기록
- 최초 완료만 `user_progress.completed_lessons`와 학습활동에 반영하는 멱등 처리
- 문제 본문·선택지·연결·버전·감사로그 수정의 단일 D1 batch
- 모의고사 답안 채점·제출 상태·학습활동·복습일정의 단일 D1 batch

검증 결과는 타입 검사, Lint, 단위 테스트 39개, 통합/E2E 테스트 25개, Production Build 모두 통과했다. 페이지네이션, 분산 rate limit, 실제 브라우저 기반 시각 검수는 계속 남아 있다.

### 5단계 선행 이론 학습 기반 추가 보강

- 기존 `Lesson`을 유지하면서 `LearningUnit` 계층을 추가하고 기존 레슨을 비파괴 백필했다.
- 사용자 진도에 `lastViewedAt`, 0~10000 읽기 위치, 서버 계산 학습시간을 추가했다.
- 직접 완료, 본문 하단 자동 완료, 최소 읽기·학습시간 조건 정책을 구현했다.
- 검증된 Markdown을 React 요소로 변환해 HTML 실행 없이 제목·목록·표·인용·강조·코드·HTTPS 첨부 참조를 표시한다.
- 과정·과목별 공개 레슨 수, 완료 수, 진도율, 최근 레슨과 다음 추천 레슨을 대시보드에 연결했다.
- 관리자 학습단위·레슨 CMS, 비공개 미리보기와 완료 기록을 보존하는 soft delete를 추가했다.

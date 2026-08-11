# Security Content Upgrade V3 검증 보고서

작성일: 2026-08-11
대상: `course-ise`, `course-isie`
적용 환경: 로컬 D1
Production 적용: 미수행

## 범위와 원본 보호

- 읽기 원본: `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-content-upgrade-v2`
- 읽은 제어 자료: PDF/TXT 인벤토리, `manifest.json`, `content.schema.json`, `content-policy.ts`, `data/`, `reports/`, `scripts/`
- 원본 디렉터리 쓰기·삭제·이름변경: 0건
- 원본 파일 repository 복사: 0건
- 생성 SQL 위치: OS 임시 디렉터리. 실행 종료 후 삭제
- repository 산출물: 이 보고서와 V3 adapter/runner/test만 추가

V2 보고서에는 전체 파일 50/51, 필기 원문 2,094/2,194 등 서로 다른 집계가 남아 있다. V3는 해당 보고서 수치를 완료 근거로 사용하지 않고 실제 `normalized-knowledge-base.json`과 로컬 DB를 다시 검증했다. 실제 V3 입력은 Lesson 32, 필기 초안 19, 실기 초안 12이다.

## 변경 내용

- 기존 `sec-upgrade-lesson-*` Content PK 32개 유지
- 기존 `sec-upgrade-written-*`, `sec-upgrade-practical-*` Question PK 31개 유지
- 빈 `course_lessons.curriculum_node_id` 32건을 공식 2027–2029 기사 세부 node에 연결
- Question 7건의 Subject/Topic을 공식 범위에 맞게 교정
  - DNS, 이메일 인증: 네트워크보안 → 어플리케이션보안
  - 로그 분석·침해 대응, 취약점 관리: 기존 일반/법규 추론 → 시스템보안 세부항목
- Content–Question link 31건 생성
- QuestionVersion 31건 생성
- canonical ontology Concept 32개와 course-scoped edge 158개 생성
- 모든 신규/보강 콘텐츠와 문제는 `DRAFT`, `is_sample=0` 유지
- V2 provenance가 정보보안기사로 명시한 자료는 `course-ise`에만 연결. 파일명이나 `practical` ID만으로 `course-isie`에 연결하지 않음

## 과정별 최종 로컬 DB 수치

| 지표 | 정보보안기사 (`course-ise`) | 정보보안산업기사 (`course-isie`) |
| --- | ---: | ---: |
| Subject | 5 | 4 |
| Topic | 5 | 4 |
| LearningUnit | 5 | 4 |
| Lesson | 5 | 4 |
| Content | 285 | 77 |
| Question | 130 | 85 |
| 필기 문제 | 118 | 85 |
| 실기 문제 | 12 | 0 |
| V3 이동/연결 Content | 32 | 0 |
| V3 과목 이동 Question | 7 | 0 |
| Progress migration | 0 | 0 |
| orphan | 0 | 0 |
| Course/Subject mismatch | 0 | 0 |
| Subject/Topic mismatch | 0 | 0 |
| V3 ontology edge | 158 | 0 |
| 남아 있는 `is_sample=1` Subject | 0 | 0 |
| placeholder 문자열 | 0 | 0 |

`course-isie`에 V3 콘텐츠가 0건인 이유는 source package의 변환 산출물 자체가 정보보안기사/정보보안기사 실기로 provenance를 고정하고 있기 때문이다. 공통 Concept는 canonical ontology에서 재사용할 수 있지만, 이 근거만으로 산업기사 curriculum 또는 QuestionCourse 관계를 새로 만들지는 않았다.

## 사용자 데이터 보호

적용 전 대상 과정의 사용자 참조는 다음과 같았다.

| 과정 | QuestionAttempt | WrongNote | Bookmark | ReviewSchedule |
| --- | ---: | ---: | ---: | ---: |
| `course-ise` | 227 | 0 | 0 | 1 |
| `course-isie` | 227 | 0 | 0 | 1 |

V3 DRAFT 문항에 연결된 산업기사 progress/reference는 0건이었다. `question_attempts`, `wrong_notes`, `bookmarks`, `user_progress`, `user_lesson_progress`, `user_course_lesson_progress`, `review_schedules`는 삭제하지 않았다. 적용 후 대상 과정의 기존 참조 수가 유지되었고 progress migration은 0건이다.

## 다른 Course 보호 검증

V3 runner는 적용 직전과 직후 모든 비대상 Course의 Subject/Topic/LearningUnit/Lesson/Question 수를 비교하고 하나라도 다르면 실패한다. 로컬 idempotent 재적용에서 보호 스냅샷 비교가 통과했다.

| Course | Subject | Topic | LearningUnit | Lesson | Question |
| --- | ---: | ---: | ---: | ---: | ---: |
| ISMS-P (`course-isms-p`) | 3 | 3 | 359 | 359 | 393 |
| ISRM (`course-isrm`) | 3 | 3 | 3 | 3 | 30 |
| SW 보안약점 진단원 (`course-sw-vuln`) | 3 | 3 | 3 | 3 | 45 |
| CPPG (`course-cppg`) | 3 | 3 | 3 | 3 | 36 |
| 개인정보 영향평가 (`course-pia`) | 3 | 3 | 3 | 3 | 40 |

이 과정들에 대한 INSERT/UPDATE/DELETE, migration, UI 변경은 수행하지 않았다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| V3 plan | PASS — Content 32, Question 31, Concept 32, edge 158 |
| V3 로컬 D1 적용 | PASS — transaction 적용 |
| Idempotent 재적용 | PASS — 동일 수치 유지 |
| DB V3 validation | PASS — orphan/mismatch/wrong course link 0 |
| Typecheck | PASS |
| Lint | PASS |
| Unit tests | PASS — 319/319 |
| Integration tests | PASS — 23/23 |
| Drizzle schema check | PASS |
| PostgreSQL migration validation | PASS — 9 files, 78 tables |
| Production build | PASS — Next.js 16.2.6 |

## 운영 적용 안전장치

- `seed:postgres`는 `--confirm-production-seed`와 `SECURIUM_CONFIRM_SECURITY_CONTENT_UPGRADE_V3=APPLY_SECURITY_CONTENT_UPGRADE_V3`가 모두 필요하다.
- 적용 전 필수 Course/Subject/Topic/Curriculum/actor를 검사한다.
- `course-isie`에 잘못 연결된 V3 문항에 attempt/wrong note/bookmark/review schedule이 있으면 자동 삭제 대신 작업을 중단한다.
- 다른 Course의 전후 스냅샷이 달라지면 실패한다.
- Production DB에는 이번 작업에서 적용하지 않았다.

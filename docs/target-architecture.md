# 정보보호·개인정보보호 통합 학습 플랫폼 목표 아키텍처

작성일: 2026-07-25

## 문서 원칙

- “현재 상태”는 저장소에서 확인된 사실이다.
- “목표 구조”는 다음 구현 단계에서 검증해야 할 제안이다.
- 외부 공개 인증, 운영 데이터 규모, 법적 보유기간은 아직 확정되지 않았다.

## 현재 상태

### 확인된 사실

- 단일 App Router 루트 페이지와 Cloudflare Worker 엔트리만 활성화돼 있다.
- D1/Drizzle 골격은 있으나 바인딩과 스키마가 없다.
- ChatGPT/SIWC 헤더 인증 헬퍼는 있으나 적용되지 않았다.
- 사용자, 역할, 과정, 학습 콘텐츠, 평가 데이터가 없다.

## 목표 구조

### 제안사항

초기 아키텍처는 모듈형 모놀리스를 권장한다. 일관된 학습 트랜잭션, 작은 운영 복잡도, 현재 Worker 배포 구조 재사용이 목적이다.

```text
Browser
  └─ Next.js App Router UI
      ├─ Public: 과정 소개/카탈로그
      ├─ Learner: 대시보드/학습/평가/복습
      └─ Admin: 콘텐츠/과정/사용자 권한
          └─ Server Components + Route Handlers/Server Actions
              ├─ Identity & Authorization
              ├─ Course Catalog
              ├─ Content
              ├─ Assessment
              ├─ Learning Progress
              ├─ Review
              └─ Audit
                  ├─ D1: 관계형 데이터
                  └─ R2: 향후 이미지·문서·오디오 파일
```

### 도메인 경계

| 모듈 | 책임 |
|---|---|
| `identity` | 플랫폼 신원 연결, 사용자 프로필, 역할, 과정별 권한 |
| `catalog` | 과정, 분류체계, 모듈, 학습 단위 |
| `content` | 본문, 카드, 법령/기준 연결, 버전 및 공개 상태 |
| `assessment` | 문제, 선택지, 시험 구성, 채점 |
| `learning` | 등록, 진도, 학습 세션, 완료 처리 |
| `review` | 오답, 복습 일정, 북마크 |
| `admin` | 콘텐츠 작성·검수·발행 워크플로 |
| `audit` | 관리자 변경 및 민감 작업 감사기록 |

## 라우팅 제안

### 공개 또는 선택적 인증

- `/`: 통합 플랫폼 소개
- `/courses`: 7개 과정 목록
- `/courses/[courseSlug]`: 과정 개요와 커리큘럼

### 학습자 보호 라우트

- `/dashboard`
- `/learn/[courseSlug]`
- `/learn/[courseSlug]/units/[unitId]`
- `/practice/[courseSlug]`
- `/review/[courseSlug]`
- `/profile`

### 관리자 보호 라우트

- `/admin`
- `/admin/courses`
- `/admin/content`
- `/admin/questions`
- `/admin/users`
- `/admin/audit`

### 설계 규칙

- 과정 컨텍스트는 URL의 `courseSlug`로 명시한다.
- 내부 관계는 변경 가능한 slug가 아니라 `course_id`를 사용한다.
- API/Server Action은 항상 서버에서 인증과 역할을 다시 검사한다.
- 관리자 경로를 숨기는 것만으로 권한을 통제하지 않는다.

## 인증 및 권한

### 확인된 사실

- 현재 제공되는 신원은 배포 플랫폼이 전달하는 이메일·전체 이름 헤더뿐이다.
- 현재 권한 모델은 없다.

### 제안사항

1. `getChatGPTUser`로 플랫폼 신원을 얻는다.
2. 정규화한 이메일 또는 별도 외부 식별자를 `users`에 연결한다.
3. 전역 역할과 과정별 역할을 DB에서 조회한다.
4. 정책 함수가 각 작업의 권한을 판정한다.
5. 관리자 변경은 `audit_logs`에 기록한다.

권장 최소 역할:

- `LEARNER`
- `CONTENT_EDITOR`
- `REVIEWER`
- `COURSE_ADMIN`
- `PLATFORM_ADMIN`
- `AUDITOR`

주의:

- SIWC는 신원 확인이지 조직 소속 또는 관리자 권한 증명이 아니다.
- 일반 대중 대상 Google/이메일 로그인은 현재 starter의 인증 범위를 벗어난다. 제품 공개 범위 결정 후 별도 인증 아키텍처로 검토한다.

## 권장 DB 구조

### 공통 규칙

- ID는 애플리케이션에서 생성 가능한 문자열 ID 또는 D1에 적합한 정수 ID 중 하나로 일관되게 사용한다.
- 모든 운영 테이블에 `created_at`, 필요한 경우 `updated_at`을 둔다.
- 소프트 삭제는 규제·복구 요구가 있는 엔터티에만 적용하고 무분별하게 추가하지 않는다.
- 사용자 진도와 평가 데이터는 `course_id` 범위를 명시한다.
- 공개 콘텐츠는 발행 버전을 고정해 시험 도중 내용이 바뀌지 않게 한다.

### 신원·권한

#### `users`

- `id`
- `email` unique
- `display_name`
- `status`
- `last_signed_in_at`
- `created_at`, `updated_at`

#### `roles`

- `id`
- `code` unique
- `name`

#### `user_roles`

- `user_id`
- `role_id`
- `course_id` nullable: null이면 전역 역할
- `granted_by`
- `granted_at`
- unique(`user_id`, `role_id`, `course_id`)

### 과정 카탈로그

#### `courses`

- `id`
- `slug` unique
- `code` unique
- `name`
- `short_name`
- `description`
- `status`
- `display_order`
- `created_at`, `updated_at`

초기 seed:

| code | slug | name |
|---|---|---|
| `ISMS_P` | `isms-p` | ISMS-P |
| `ISE` | `information-security-engineer` | 정보보안기사 |
| `ISIE` | `information-security-industrial-engineer` | 정보보안산업기사 |
| `ISRM` | `isrm` | 정보보호위험관리사(ISRM) |
| `SW_VULN_DIAG` | `sw-vulnerability-diagnostician` | SW 보안약점 진단원 |
| `CPPG` | `cppg` | CPPG 개인정보관리사 |
| `PIA` | `privacy-impact-assessment` | 개인정보 영향평가 |

#### `course_domains`

- `id`
- `course_id`
- `parent_id` nullable
- `code`
- `name`
- `description`
- `display_order`
- unique(`course_id`, `code`)

#### `modules`

- `id`
- `course_id`
- `domain_id` nullable
- `title`
- `description`
- `display_order`
- `status`

#### `learning_units`

- `id`
- `module_id`
- `title`
- `unit_type`
- `estimated_minutes`
- `display_order`
- `status`

### 콘텐츠

#### `content_items`

- `id`
- `content_type`
- `title`
- `current_version_id` nullable
- `status`
- `created_by`, `created_at`, `updated_at`

#### `content_versions`

- `id`
- `content_item_id`
- `version`
- `body`
- `source_name` nullable
- `source_url` nullable
- `effective_date` nullable
- `created_by`, `created_at`
- unique(`content_item_id`, `version`)

#### `content_course_mappings`

- `content_item_id`
- `course_id`
- `domain_id` nullable
- `learning_unit_id` nullable
- unique on the intended mapping scope

이 매핑으로 개인정보보호법, 접근통제, 위험관리처럼 여러 과정에 걸친 콘텐츠를 중복 저장하지 않는다.

### 문제·평가

#### `questions`

- `id`
- `question_type`
- `prompt`
- `explanation`
- `difficulty`
- `status`
- `version`
- `created_by`, `created_at`, `updated_at`

#### `question_choices`

- `id`
- `question_id`
- `label`
- `content`
- `is_correct`
- `display_order`

#### `question_course_mappings`

- `question_id`
- `course_id`
- `domain_id` nullable
- `weight`

#### `exams`

- `id`
- `course_id`
- `title`
- `exam_type`
- `time_limit_seconds` nullable
- `passing_score` nullable
- `status`

#### `exam_questions`

- `exam_id`
- `question_id`
- `display_order`
- `points`

### 학습·복습

#### `enrollments`

- `id`
- `user_id`
- `course_id`
- `status`
- `enrolled_at`
- unique(`user_id`, `course_id`)

#### `learning_progress`

- `user_id`
- `course_id`
- `learning_unit_id`
- `status`
- `progress_percent`
- `completed_at` nullable
- `updated_at`
- unique(`user_id`, `learning_unit_id`)

#### `quiz_attempts`

- `id`
- `user_id`
- `course_id`
- `exam_id` nullable
- `status`
- `score`
- `started_at`
- `submitted_at` nullable

#### `quiz_answers`

- `id`
- `attempt_id`
- `question_id`
- `selected_choice_id` nullable
- `answer_payload` nullable
- `is_correct`
- `response_time_ms` nullable
- unique(`attempt_id`, `question_id`)

#### `review_items`

- `id`
- `user_id`
- `course_id`
- `question_id`
- `state`
- `next_review_at`
- `interval_days`
- `error_count`
- `success_count`
- unique(`user_id`, `course_id`, `question_id`)

#### `bookmarks`

- `id`
- `user_id`
- `course_id`
- `target_type`
- `target_id`
- `created_at`
- unique(`user_id`, `target_type`, `target_id`)

### 운영·감사

#### `audit_logs`

- `id`
- `actor_user_id`
- `action`
- `target_type`
- `target_id`
- `course_id` nullable
- `request_id`
- `metadata_json`
- `created_at`

감사로그에는 비밀번호, 토큰, 문제의 정답 원문, 불필요한 개인정보를 남기지 않는다.

## 데이터 접근 패턴

### 제안사항

```text
app route
  → auth/policy
  → use case/service
  → repository/query
  → Drizzle D1
```

- `env.DB` 접근은 `db` 계층 밖으로 확산하지 않는다.
- 읽기 모델은 필요한 컬럼만 선택한다.
- 쓰기 작업은 입력 검증, 권한 검사, 트랜잭션 가능 여부 확인, 감사기록 순으로 처리한다.
- 대량 콘텐츠 import는 즉시 도입하지 않고 스키마와 검증 규칙이 안정된 뒤 추가한다.

## UI 아키텍처

### 제안사항

- 공통 셸: 브랜드, 과정 전환, 사용자 메뉴, 모바일 내비게이션
- 공통 컴포넌트: `CourseSwitcher`, `ProgressBar`, `StatusBadge`, `LearningCard`, `QuestionForm`, `EmptyState`, `ErrorState`
- 도메인 컴포넌트는 `features/<domain>`에 배치하고 범용 UI와 분리한다.
- 서버 데이터를 브라우저 전역 상태로 중복 저장하지 않는다.
- 과정별 색상은 보조 표현으로만 사용하고 텍스트·아이콘과 함께 상태를 전달한다.
- 한국어 문서 언어, 키보드 탐색, 명확한 포커스, 충분한 대비를 기본으로 한다.

## 보안 아키텍처

### 제안사항

- 인증·권한: 서버 측 역할 검사, 최소권한, 과정별 권한 범위
- 입력: 스키마 검증, 예상하지 못한 필드 거부, 길이·형식 제한
- 출력: React 기본 escaping 유지, 임의 HTML 저장 시 별도 sanitize 정책
- 요청: 쓰기 엔드포인트 요청 제한과 재시도 안전성
- 세션: 플랫폼 소유 인증 쿠키를 앱에서 재구현하지 않음
- 헤더: CSP, frame 정책, MIME sniffing 방지, referrer 정책 검토
- 개인정보: 최소 수집, 목적별 보유기간, 탈퇴·파기, 관리자 열람 통제
- 감사: 권한 변경, 콘텐츠 발행, 사용자 상태 변경을 기록
- AI: 향후 도입 시 개인정보·시험 비공개 정보를 외부 모델에 보내지 않음

## 배포 및 관찰 가능성

### 확인된 사실

- 현재 빌드 결과는 Cloudflare Worker 호환 형태다.
- 배포 프로젝트 및 D1/R2 바인딩은 연결되지 않았다.

### 제안사항

- 환경을 `local`, `preview`, `production`으로 구분한다.
- D1 마이그레이션은 코드 리뷰 가능한 SQL로 생성·보관한다.
- 배포 전에 build, lint, unit, integration을 실행한다.
- 민감정보를 제외한 구조화 로그와 요청 ID를 도입한다.
- 오류율, 학습 API 지연, DB 오류, 권한 거부 이벤트를 관찰한다.

## 의사결정이 필요한 항목

1. 일반 대중 서비스인지 OpenAI workspace 내부 서비스인지
2. Google/이메일 로그인이 필수인지
3. 과정별 공식 출제기준·법령 콘텐츠의 라이선스
4. 학습기록과 개인정보 보유기간
5. D1로 시작할지, 예상 데이터 규모 때문에 PostgreSQL을 별도 채택할지
6. 관리자 승인·검수 워크플로의 단계


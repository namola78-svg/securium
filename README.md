# Shield Academy

## Repository and deployment guides

- [GitHub and CI preparation](docs/github.md)
- [Vercel compatibility review](docs/vercel.md)
- [Deployment checklist](docs/deployment-checklist.md)
- [Rollback and recovery](docs/rollback.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Supabase preparation](docs/supabase.md)
- [Storage policy](docs/storage-policy.md)
- [Database provider](docs/database-provider.md)
- [PostgreSQL repository runtime](docs/postgres-repository-runtime.md)
- [D1 to Supabase migration](docs/d1-to-supabase-migration.md)
- [Supabase Storage](docs/supabase-storage.md)
- [Supabase RLS](docs/supabase-rls.md)
- [Vercel with Supabase](docs/vercel-supabase.md)
- [Initial administrator bootstrap](docs/admin-bootstrap.md)
- [Backup and recovery](docs/backup-and-recovery.md)
- [Data retention and disposal](docs/data-retention.md)
- [Integrated operations readiness](docs/operations-readiness.md)

## 실무형 과정 기능

### SW 보안약점 진단원

- `/practical/[courseSlug]`에서 DB에 연결된 실무형 콘텐츠를 조회합니다.
- Java 20개, C/C++ 10개의 독립 작성 개발용 코드 샘플을 제공합니다.
- 취약 라인, 보안약점, CWE, 정탐·오탐, 조치 키워드와 수정코드 제출 여부를 서버에서 부분 채점합니다.
- 샘플과 사용자 코드는 React 텍스트 노드로만 출력하며 서버에서 실행하지 않습니다.
- `CodeExecutionProvider`는 확장 인터페이스만 있으며 기본 구현은 항상 `CODE_EXECUTION_DISABLED`를 반환합니다.
- 코드 분석 결과는 공통 `QuestionAttempt`, 학습 활동과 오답노트에 연결됩니다.

### 개인정보 영향평가

- 평가자 시험 대비와 영향평가 실무 트랙을 DB에서 관리합니다.
- 대상 판단, 평가항목 매핑, 침해요인과 개선방안 답안을 사용자별로 저장합니다.
- SVG 흐름도는 키보드 탐색과 텍스트 대체 목록을 함께 제공하며 모바일에서는 목록을 우선 표시합니다.
- 규칙 기반 점수는 개발용 학습 참고이며 공식 평가 결과가 아닙니다.

관리자는 `/admin/practical-specializations`에서 보안약점·CWE·코드 샘플·부분점수 규칙과 영향평가 항목·시나리오·노드·연결을 관리할 수 있습니다.

정보보호·개인정보보호 전문 과정을 하나의 공통 구조에서 등록하고 수강하는 통합 학습 플랫폼입니다. 현재 Phase 0~4의 공통 기반, 문제은행, 단계 학습, 복습·모의고사·통계, 과정 특화 학습을 포함합니다.

## 현재 구현 범위

- DB 기반 과정군, 과정, 과목, 계층형 주제
- 7개 초기 과정과 과정별 개발용 과목·주제 Seed
- DB 기반 공개 과정 목록과 동적 과정 상세
- 플랫폼 SIWC 인증과 자동 USER 프로필 생성
- 여러 과정 동시 수강
- 중복 수강 및 비활성·비공개 과정 수강 방지
- 사용자별 수강 소유권 검증
- 과정별 진도·정답률·최근 학습일 분리
- 수강 상태 변경
- 통합 대시보드, 내 과정, 과정 대시보드, 과목·주제 화면
- DB 기반 LearningUnit·본문형 이론 레슨, 사용자별 읽기 위치·시작·완료 기록
- 직접 완료·본문 하단 완료·최소 조건 완료 정책
- 검증된 Markdown 기반 제목·문단·목록·표·인용·강조·코드·첨부 참조
- 레슨 완료 멱등 처리와 과정·과목·주제 진도 반영
- 역할 기반 관리자 접근
- 과정군·과정·과목·주제 등록 및 수정
- 관리자 학습단위·이론 레슨 등록·수정·미리보기·공개·soft delete
- 공개·비공개, 활성·비활성, 정렬순서 관리
- 관리자 변경 감사로그 확장 구조
- 레슨별 오디오 메타데이터와 사용자별 이어 듣기·완료 기록
- 재생·일시정지·10초 탐색·배속·스크립트·현재 문장 강조
- 오디오 파일이 없을 때 명시적으로 구분된 브라우저 음성 합성
- DB 기반 과정·과목·주제별 강의 목록과 검색·필터
- 무료·수강 전용·비공개 강의 접근 통제
- 안전한 외부 영상 재생, 이어보기·완료·즐겨찾기·개인 메모
- 강의별 관련 이론·문제와 다음 추천 강의
- 법령·기준·평가항목·과목·이론·문제 해설·오디오·강의 공통 버전 이력
- 콘텐츠 기준일·검수일·최신 여부 표시와 관리자 게시·보관·비교

문제풀이·채점·오답복습·단계 학습·모의고사와 과목·주제별 본문형 이론 레슨을 구현했습니다. 레슨 본문과 공개 상태는 DB에서 관리하며, 사용자별 시작·완료 기록은 과정별로 분리되고 같은 완료 요청은 한 번만 집계됩니다.

본문은 HTML을 직접 실행하지 않습니다. Markdown을 React 요소로 안전하게
변환하며 링크와 이미지·첨부 참조는 HTTPS 또는 동일 출처 상대 경로만
허용합니다.

## 기술 구성

- Native Next.js App Router API, React, TypeScript
- Vinext/Vite Cloudflare Worker target retained for rollback
- Supabase PostgreSQL runtime with Cloudflare D1 local/rollback support
- Tailwind CSS와 제품 전용 CSS
- Zod 입력 검증
- Node 내장 테스트 러너

## 오디오 학습

- 공개 레슨의 `AudioContent`를 DB에서 조회하고, `AudioProgress`에 사용자별 마지막 위치와 완료 상태를 저장합니다.
- 재생 위치는 오디오 길이 범위로 서버에서 검증하며, 완료는 끝부분에 도달한 경우만 허용합니다.
- 진행 저장은 15초 단위로 제한하고 일시정지·탐색·종료 시 즉시 반영합니다.
- 오디오 URL은 동일 출처 상대 URL 또는 `AUDIO_ALLOWED_HOSTS`에 등록된 HTTPS 호스트만 허용합니다. `javascript:`와 `data:` URL은 거부합니다.
- 개발용 Seed는 실제 강사 음원을 포함하지 않으며, 오디오 파일이 없는 경우 사용자 조작으로만 브라우저 제공 음성을 재생합니다.
- 브라우저 음성은 공식 기관·강사 음성이 아니며 지원하지 않는 브라우저에서는 안전한 안내를 표시합니다.

## 강의 학습

- `/lectures/[courseSlug]`에서 DB에 등록된 공개 강의를 과정·과목·주제별로 조회하고 검색합니다.
- `/lectures/[courseSlug]/[lectureId]`에서 이어보기, 완료, 즐겨찾기, 사용자별 메모, 관련 이론·문제와 다음 강의를 제공합니다.
- 무료 강의는 비수강 사용자도 조회할 수 있지만 진행·메모 저장은 로그인 후 가능합니다. 수강 전용 강의는 서버에서 해당 과정의 수강 상태를 검증합니다.
- 영상 Provider와 허용 도메인은 `lib/services/video-provider-service.ts`에 중앙화되어 있습니다. HTTPS URL만 허용하며 임의 HTML embed, `javascript:` URL과 미등록 호스트는 거부합니다.
- iframe은 서버가 생성한 검증 URL만 사용하고 제한된 `sandbox`, `allow`, `referrerPolicy`를 적용합니다. 진행 위치와 완료 조건도 서버에서 영상 길이 기준으로 다시 검증합니다.
- Seed 영상은 Provider 연동과 보안 동작을 검증하는 `Mock 개발용 영상`이며 실제 강의나 공식 교육 콘텐츠가 아닙니다.

## 콘텐츠 기준일·버전 관리

- 공통 `ContentRevision` 구조가 법령, ISMS-P 인증기준, 개인정보 영향평가 항목, 시험과목, 보안약점 분류, 학습단위, 이론 레슨, 문제 해설, 오디오와 강의의 기준일·버전·검수·게시 이력을 관리합니다.
- `/admin/content-revisions`에서 기존 콘텐츠를 바탕으로 새 버전 초안을 만들고, 변경 요약과 JSON 스냅샷을 비교한 뒤 게시하거나 이전 버전을 보관할 수 있습니다.
- 새 버전 게시 시 기존 최신 버전의 `superseded` 처리, 콘텐츠 반영과 새 최신 버전 지정이 하나의 D1 원자적 batch에서 실행됩니다.
- 콘텐츠별 최신 버전은 부분 unique index로 하나만 허용합니다. 초안은 일반 사용자 화면과 AI Retrieval에서 제외됩니다.
- 레슨·문제 해설·오디오·강의 화면에는 기준일, 버전, 최신 검수일과 최신 여부를 표시합니다. 구버전 상세에는 명시적인 경고를 표시합니다.
- 버전 게시가 콘텐츠의 기존 ID를 바꾸지 않으므로 레슨·오디오·강의 진도와 문제 풀이 기록은 유지됩니다.
- 기존 `legal_article_versions`는 이전 기능의 호환성을 위해 보존하며 신규 공통 워크플로는 `content_revisions`를 사용합니다.

## AI 학습 보조 기능

- `/practice/[courseSlug]`에서 답안을 제출한 인증 사용자가 문제별 AI 참고 해설을 요청할 수 있습니다.
- 기존 관리자 검수 해설은 변경하지 않으며, AI 생성 해설과 `Mock AI 해설`을 별도 영역에 표시합니다.
- 서술형 답안은 예상 점수 범위·포함/누락 키워드·장단점·예시 답안을 참고용으로 제시하며 기존 규칙 점수나 관리자 점수를 변경하지 않습니다.
- ISRM 위험 시나리오, 개인정보 영향평가 답안, SW 보안약점 코드 분석 결과에 과정별 AI 검토를 제공합니다.
- 보안약점 AI 설명은 등록된 코드와 분석 결과를 텍스트로만 검토하며 코드를 실행하지 않습니다.
- `/admin/ai-reviews`에서 AI 원본을 유지한 채 별도 수정본으로 검수 완료·수정 승인·반려·논리 삭제·검수 콘텐츠 복사를 처리합니다.
- 검색 근거는 현재 과정의 공개 레슨·학습단위·법령·인증기준·검수 문제 해설·사례·보안약점·영향평가 항목으로 제한합니다.
- API Key가 없거나 AI 기능이 비활성화된 환경에서는 외부 호출 없이 명시적으로 표시된 Mock 또는 안전한 비활성 응답을 사용합니다.
- AI 설명은 참고용이며 공식 기준·법령·시험 채점 결과가 아닙니다.
- AI 로그에는 답안·사용자 코드 원문 대신 입력 지문만 저장합니다. 도메인 답안 원문은 기존 소유권 검증이 적용된 학습 기록에만 유지됩니다.
- 학습 추천 AI는 Provider 인터페이스만 준비되어 있고 이번 Sprint의 활성 범위에 포함하지 않습니다.

## 요구사항

- Node.js `>=22.13.0`
- npm

## 설치

```bash
npm install
```

## 환경변수

`.env.example`을 참고해 로컬 전용 `.env.local`을 생성할 수 있습니다.

```dotenv
DEV_AUTH_EMAIL=dev-super-admin@example.invalid
AI_PROVIDER=mock
OPENAI_MODEL=gpt-5.6-luna
AI_DAILY_LIMIT=20
AI_TIMEOUT_MS=8000
AI_MAX_RETRIES=1
AI_RETENTION_DAYS=90
AUDIO_ALLOWED_HOSTS=
# OPENAI_API_KEY는 실제 외부 연동 환경에서만 비밀 바인딩으로 설정
```

`DEV_AUTH_EMAIL`은 `NODE_ENV !== production`일 때만 로컬 신원으로 사용합니다. 배포 환경에서는 설정하지 않습니다. 운영 인증은 Sites가 전달하는 SIWC 사용자 헤더를 사용합니다.

비밀번호, OAuth secret, API key는 저장소에 포함하지 않습니다.

`AI_PROVIDER=openai`와 유효한 `OPENAI_API_KEY`를 함께 설정해야 실제 OpenAI
Responses API를 호출합니다. Key가 없으면 Provider Factory가 외부 요청을
수행하지 않습니다. 배포 환경에서는 Key를 평문 설정 파일이나 클라이언트
환경변수에 넣지 말고 호스팅 환경의 비밀 바인딩으로 관리합니다.

## DB 구조와 실행

논리 D1 바인딩은 `.openai/hosting.json`의 `DB`입니다. 로컬 Wrangler 설정은 `wrangler.local.jsonc`에만 있으며 실제 운영 DB ID를 포함하지 않습니다.

### 마이그레이션 생성

```bash
npm run db:generate
```

### 로컬 마이그레이션

```bash
npm run db:migrate
```

### Seed

```bash
npm run db:seed
```

마이그레이션과 Seed를 함께 적용:

```bash
npm run db:setup
```

Seed는 반복 실행할 수 있도록 `INSERT OR IGNORE`를 사용합니다.

## 개발용 계정

개발 Seed는 비밀번호가 없는 식별용 계정만 생성합니다.

| 역할 | 이메일 |
|---|---|
| SUPER_ADMIN | `dev-super-admin@example.invalid` |
| ADMIN | `dev-admin@example.invalid` |
| USER | `dev-user-1@example.invalid` |
| USER | `dev-user-2@example.invalid` |

로컬에서 `DEV_AUTH_EMAIL`을 위 이메일 중 하나로 설정해 권한 흐름을 확인합니다. 이 주소는 `.invalid` 도메인의 개발 전용 식별자이며 실제 계정이나 비밀정보가 아닙니다.

운영 관리자 계정은 다음 절차를 권장합니다.

1. 운영 SIWC로 한 번 로그인해 `users` 레코드를 생성합니다.
2. 승인된 데이터베이스 운영 절차로 해당 사용자에게 `ADMIN` 또는 `SUPER_ADMIN` 역할을 부여합니다.
3. 역할 부여 행위자와 사유를 감사로그에 기록합니다.
4. 일반 화면이나 공개 API로 `SUPER_ADMIN` 역할을 생성하지 않습니다.

## 개발 서버

```bash
npm run dev
```

기존 Cloudflare/Vinext 로컬 경로가 필요한 경우:

```bash
npm run dev:cloudflare
```

## 검증

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:e2e
npm test
npm run build
npm run build:cloudflare
```

`test:e2e`는 Production Build 결과를 Worker로 직접 렌더링해 랜딩과 로그인 흐름을 확인합니다. 실제 SIWC 리디렉션과 운영 D1 연결은 배포 환경 검증이 필요합니다.

## 주요 라우트

### 공개

- `/`
- `/courses`
- `/courses/[courseSlug]`
- `/login`
- `/signup`

### 로그인 사용자

- `/dashboard`
- `/my-courses`
- `/learn/[courseSlug]`
- `/learn/[courseSlug]/subjects/[subjectId]`
- `/learn/[courseSlug]/lessons/[lessonId]`
- `/profile`

### 관리자

- `/admin`
- `/admin/course-groups`
- `/admin/courses`
- `/admin/courses/[courseId]`
- `/admin/courses/[courseId]/subjects`
- `/admin/subjects/[subjectId]/topics`
- `/admin/lessons`

## 보안 적용

- SIWC 헤더 기반 인증, 운영 비밀번호 미저장
- 서버 측 역할 검증
- 사용자별 수강·진도 소유권 검증
- Zod 서버 입력 검증과 HTML 제약 기반 클라이언트 검증
- Drizzle prepared query를 통한 SQL Injection 방어
- React 기본 escaping을 통한 XSS 위험 축소
- 쓰기 요청의 Origin/Referer 동일 출처 검사
- 관리자 API 개별 권한 검증
- 공개용 오류 메시지와 내부 오류 분리
- 관리자 변경 감사로그
- AI 원본과 관리자 수정본의 분리 보존 및 관리자 검수 API의 서버 역할 검증
- AI 답안·코드 원문 로그 금지와 SHA-256 입력 지문 저장
- 비활성화 중심 데이터 보존
- 문제 수정 전체와 모의고사 제출 후처리의 D1 원자적 batch
- 결정적 활동 키를 이용한 레슨 완료·모의고사 중복 반영 차단
- 기존 완료 기록을 보존하는 레슨·학습단위 soft delete

## 미구현 기능

- ESSAY·ORDERING·FILL_BLANK·CASE_ANALYSIS·CODE_ANALYSIS·LOG_ANALYSIS·CALCULATION의 완전 자동채점
- 과정 관리자 권한의 과정별 범위 UI
- 관리자 역할 부여 UI
- 이메일·비밀번호 또는 Google OAuth 기반 일반 대중 인증
- 파일 업로드와 R2
- 운영 모니터링과 분산형 rate limit 저장소
- 대규모 목록의 커서 페이지네이션
- R2 기반 실제 이미지·첨부 파일 업로드
- R2 기반 실제 오디오 파일 업로드와 음원 관리자 CMS
- 강의 관리자 CMS와 자체 영상 업로드·트랜스코딩
- 공통 버전 스냅샷을 위한 시각적 필드 편집기와 법령 원문 diff 뷰
- AI 기반 학습 추천과 관리자 수정본의 일반 학습 콘텐츠 자동 게시

## 알려진 제한사항

- 인증은 현재 Sites/SIWC 배포 모델을 전제로 합니다.
- `/signup`은 별도 비밀번호 계정을 만들지 않고 플랫폼 계정 생성 방식을 안내합니다.
- Seed의 과목과 주제는 구조 검증용 샘플이며 공식 학습 콘텐츠가 아닙니다.
- 로컬 D1과 운영 D1은 별도이므로 운영 배포 시 플랫폼 마이그레이션 적용을 확인해야 합니다.
- 초기 MVP는 D1에 맞춰 설계됐습니다. 대규모 분석 쿼리나 동시 쓰기 요구가 커지면 PostgreSQL 전환 기준을 별도로 수립해야 합니다.
- 현재 요청 제한은 Worker 인스턴스 메모리 기반의 기본 방어입니다. 다중 인스턴스에 걸친 정밀 제한은 플랫폼 rate limiting 또는 Durable Object 등으로 확장해야 합니다.
- AI 분당 제한은 현재 Worker 인스턴스 메모리, 일일 제한은 D1 생성 기록을 기준으로 합니다. 강한 분산형 burst 제어는 후속 인프라 연동이 필요합니다.
- OpenAI Provider 코드는 준비되어 있으나 실제 API Key를 사용한 운영 외부 호출과 비용·품질 검증은 수행하지 않았습니다.
- `.openai/hosting.json`의 R2 바인딩이 `null`이므로 이번 Sprint는 오디오 파일 업로드 없이 URL 메타데이터와 브라우저 음성 합성만 제공합니다.
- 강의 Seed는 외부 Provider 연동용 Mock이며 운영 콘텐츠로 사용할 수 없습니다. 썸네일 URL은 저장할 수 있지만 별도의 이미지 도메인 정책이 마련될 때까지 화면에서 직접 렌더링하지 않습니다.
- 영향 콘텐츠 수는 현재 직접 연결 또는 동일 과정 범위를 기준으로 계산합니다. 의미 기반 영향 분석은 후속 검색 인덱스가 필요합니다.

## 문서

- `docs/current-project-analysis.md`
- `docs/target-architecture.md`
- `docs/development-roadmap.md`

## Phase 2 구현 범위

- 한 문제를 여러 과정·과목·주제에 연결하는 통합 문제은행
- OX, 단일선택형, 복수선택형, 단답형 서버 자동채점
- 서술형, 순서형, 빈칸형, 사례·코드·로그 분석형, 계산형 확장 인터페이스
- 과정·과목·주제·난이도·문제 수·무작위 조건 문제풀이
- 제출 후 정답, 해설, 오답 해설 즉시 확인
- 오답 자동 저장, 반복 오답 횟수 갱신, 숙지 상태와 사용자 메모
- 과정 범위를 포함한 문제 즐겨찾기
- 문제 신고 접수와 관리자 처리 상태
- 문제 초안, 검수 요청, 검수 중, 승인, 게시, 반려, 보관 워크플로
- 문제 버전 스냅샷과 관리자 감사로그
- 문제 제출 시 과정·과목·주제별 진도와 학습 활동 갱신
- 멱등 키와 D1 원자적 batch를 통한 중복 통계 증가 방지
- 독립 제작 개발용 샘플 문제 105개, 각 과정 최소 15개

### Phase 2 사용자 경로

- `/practice/[courseSlug]`
- `/wrong-notes`
- `/bookmarks`

### Phase 2 관리자 경로

- `/admin/questions`
- `/admin/questions/new`
- `/admin/questions/[questionId]`
- `/admin/reviews`
- `/admin/question-reports`

### 개발용 콘텐츠 역할 계정

아래 계정도 비밀번호가 없는 `.invalid` 개발용 식별자입니다.

| 역할 | 이메일 |
|---|---|
| CONTENT_EDITOR | `dev-editor@example.invalid` |
| CONTENT_REVIEWER | `dev-reviewer@example.invalid` |

`dev-admin@example.invalid`에는 로컬 통합 검증을 위해 ADMIN과 함께
COURSE_MANAGER, CONTENT_EDITOR, CONTENT_REVIEWER 역할도 Seed로 부여됩니다.
운영 환경에서는 직무 분리 원칙에 따라 각 역할을 별도 사용자에게 최소
권한으로 부여해야 합니다.

### 자동채점 제한

현재 완성된 자동채점 유형은 OX, 단일선택형, 복수선택형, 단답형입니다.
나머지 문제 유형은 저장·버전·검수 구조만 제공하며 학습 화면에서
`자동채점 준비 중`으로 표시됩니다. 지원 유형의 시험 세션, 제한 시간,
임시 저장과 제출 확정은 구현되어 있으며 서술형 수동 채점 큐는 미구현입니다.

### 테스트 데이터 주의

Phase 2 Seed 문제는 공식 기출문제나 유료 교재를 복제하지 않은 독립 제작
샘플이며 제목·해설·출처에 개발용 샘플임을 표시합니다. 운영 반영 전에는
전문가 검수 콘텐츠로 교체해야 합니다.

## Phase 3 구현 범위

### 학습자 경로

- `/learn/[courseSlug]`: DB 기반 단계 학습 경로와 잠금 상태
- `/learn/[courseSlug]/levels/[levelId]`: 단계별 필수 문제 학습
- `/reviews`: 오늘의 복습, 연체 복습, 과정별 복습 수
- `/mock-exams`: 응시 가능한 과정별 모의고사
- `/mock-exams/[mockExamId]`: 시험 안내 및 시작
- `/mock-exams/attempts/[attemptId]`: 서버 제한시간, 임시저장, 제출 및 결과
- `/analytics`: 통합 학습분석과 우선 복습 영역
- `/analytics/[courseId]`: 과정별 과목·주제·난이도·유형 통계

### 관리자 경로

- `/admin/levels`: 단계 등록·수정, 선행 단계, 통과점수, 공개 상태, 콘텐츠 연결
- `/admin/mock-exams`: 모의고사 등록과 응시 현황
- `/admin/mock-exams/[mockExamId]`: 섹션 및 자동채점 지원 문제 배정
- `/admin/analytics`: 과정별 응시 통계, 점수 분포, 많이 틀린 문제

### Phase 3 데이터 초기화

기존 설치 절차와 동일하게 다음 명령을 사용합니다.

```bash
npm run db:migrate
npm run db:seed
```

개발 Seed는 7개 과정에 과정당 3단계, 단계당 5개 필수 문제, 과정당
10문제 빠른 모의고사를 생성합니다. 개발용 반복 E2E 검증을 위해 Seed
모의고사의 최대 응시 횟수는 100회이며, 관리자가 생성하는 시험에는 폼에서
설정한 제한이 그대로 적용됩니다.

### Phase 3 알고리즘과 보안

- 복습 스케줄러는 교체 가능한 `ReviewScheduler` 인터페이스 뒤에서 동작하며
  연속 정답에 따라 1·3·7·14·30일 간격을 적용합니다. 오답은 당일 복습으로
  되돌립니다.
- 추천은 연체 복습, 반복 오답, 모의고사 오답, 낮은 정답률, 미완료 단계,
  장기 미학습 과목, 미풀이 문제 순의 규칙 기반 서비스입니다.
- 단계 접근, 시험 소유권, 응시 가능 기간과 최대 횟수, 제한시간, 제출 상태를
  서버에서 다시 검증합니다.
- 시험 문제 응답은 제출 전 정답·선택지 정오·해설을 제거합니다. 결과 공개
  시점이 미래이면 제출 후에도 정답과 해설을 숨깁니다.
- 점수와 학습 통계는 클라이언트 답안을 신뢰하지 않고 DB 정답으로 계산합니다.

### Phase 3 알려진 제한사항

- 자동채점 모의고사에는 현재 OX, 단일선택, 복수선택, 단답형만 배정합니다.
  서술형·사례·코드·로그·계산형의 수동 채점 큐는 후속 단계입니다.
- 빠른·과목별·실전·오답·취약영역·관리자 지정 시험의 데이터 유형은
  준비되어 있으나, 자동 조합 UI는 현재 관리자 지정 문제 배정과 개발용
  빠른 모의고사 중심입니다.
- 복습 알고리즘은 초기 규칙 기반이며 SM-2의 품질 점수나 사용자별 난이도
  최적화는 아직 적용하지 않았습니다.
- 운영 환경의 분산 rate limit, 시험 감독, 부정행위 탐지, 대규모 통계
  사전 집계는 별도 운영 인프라가 필요합니다.

## 과정 특화 학습 구현

공통 수강·진도·문제은행·단계·복습·모의고사 엔진은 그대로 유지하고,
과정별 특화 데이터만 공통 연결 테이블을 통해 추가했습니다.

### 학습자 경로

- `/specialized/[courseSlug]`: 과정 설정을 DB에서 읽는 공통 특화 학습 화면
- `/specialized/[courseSlug]/[contentType]/[contentId]`: 기준·법령·사례·위험 시나리오 공통 상세 화면
- ISMS-P: 인증기준, 확인사항, 증적, 결함사례, 심사 포인트, 관련 법령·문제
- CPPG: 법령·조문, 시행·개정 기준일, 버전 이력, 유사 조문 비교 기반
- 정보보안기사: 서술형 문제와 키워드 기반 참고용 보조채점
- 정보보안산업기사: 별도 과정·과목·난이도·단계·진도의 기초 실무 문제
- ISRM: 위험 시나리오, 계산 방법 변경, 등급 판정, 개인 위험등록부

### 관리자 경로

- `/admin/specialized`
- ISMS-P 기준·결함사례 관리
- 법령·조문 및 버전 관리
- 서술형 채점규칙 관리
- 위험평가 방법·등급 구간·시나리오 관리
- 하나의 콘텐츠를 여러 과정·문제에 연결

### 자료 구분 원칙

- Seed 자료는 공식 기출문제나 유료 교재를 복제하지 않은 독립 제작
  개발용 샘플입니다.
- 모든 샘플 제목·설명·출처에 `개발용 샘플` 또는 `개발용 독립 샘플`을
  표시합니다.
- 법령 원문 전체를 애플리케이션 코드에 저장하지 않습니다. 관리자가
  내용, 버전, 시행일, 개정일, 출처 URL을 DB에서 관리합니다.
- ISMS-P 기준과 사례에는 버전·시행일 또는 사례 기준일을 저장합니다.
- 키워드 채점 결과는 공식 점수가 아닌 학습 참고용 결과로 명시합니다.

### 특화 샘플 수량

- ISMS-P 기준 20개, 결함사례 10개, 특화 문제 20개
- CPPG 법령 학습 20개, 법령 문제 20개
- 정보보안기사 객관식 10개, 단답형 5개, 서술형 5개,
  로그·코드 분석 5개
- 정보보안산업기사 객관식 15개, 기초 실무 단답형 5개
- ISRM 위험 시나리오 10개, 위험평가 문제 15개
## Authentication provider

Use `AUTH_PROVIDER=sites` for the retained Sites/Cloudflare path. That mode
continues to read the platform SIWC identity headers and does not show an
application password form.

Use `AUTH_PROVIDER=supabase` for the Native Next.js/Vercel path. Configure
`SUPABASE_URL` and `SUPABASE_ANON_KEY` as deployment environment variables.
The app uses Supabase Auth email/password endpoints, stores session tokens in
HttpOnly cookies, and keeps application roles in the existing `users`,
`roles`, and `user_roles` tables.

Do not put database passwords, service role keys, OAuth tokens, or API keys in
`NEXT_PUBLIC_*` variables. `@supabase/ssr` and `@supabase/supabase-js` are
installed, but the current runtime still uses the small REST-based provider.
Those SDK packages can replace the provider internals later without changing
the application RBAC model.

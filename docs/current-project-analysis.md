# 현재 프로젝트 분석

작성일: 2026-07-25

이 문서는 현재 작업공간에서 직접 확인한 사실과 향후 제안을 구분한다.

## 현재 프로젝트 요약

### 확인된 사실

- 현재 프로젝트는 완성된 학습 서비스가 아니라 `site-creator-vinext-starter`라는 Vinext/Cloudflare Sites 초기 템플릿이다.
- 실제 앱 라우트는 루트(`/`) 하나뿐이며, 제품 화면 대신 개발용 로딩 스켈레톤을 렌더링한다.
- 인증 헬퍼와 D1/Drizzle 연결 헬퍼는 포함되어 있으나 어떤 페이지나 기능에도 적용되지 않았다.
- 데이터베이스 스키마, 실제 마이그레이션, 사용자·권한 모델, 학습 데이터가 없다.
- `.git` 디렉터리를 확인할 수 없어 커밋 이력, 기준 브랜치, 기존 변경 내역은 분석하지 못했다.
- 소스 구현을 변경하지 않고 문서만 추가했다.

### 제안사항

- 이 상태는 기존 제품 마이그레이션보다 신규 제품 구축에 가깝다.
- 기존 런타임·빌드·배포 골격을 보존하면서, 먼저 “과정”을 최상위 도메인으로 도입한 모듈형 모놀리스로 확장하는 것이 안전하다.

## 기술 스택

### 확인된 사실

| 구분 | 현재 구성 |
|---|---|
| 런타임 | Node.js `>=22.13.0` 요구, 분석 환경 `v24.16.0` |
| 언어 | TypeScript `5.9.3`, strict 모드 |
| UI | React `19.2.6`, React DOM `19.2.6` |
| 프레임워크 | Next.js `16.2.6` App Router API + Vinext `0.0.50` |
| 빌드 | Vite `8.0.13`, Vinext, React/RSC Vite 플러그인 |
| 스타일 | Tailwind CSS `4.2.1`, PostCSS |
| 배포 런타임 | Cloudflare Worker, `@cloudflare/vite-plugin`, Wrangler |
| ORM | Drizzle ORM `0.45.2`, Drizzle Kit `0.31.10` |
| DB 대상 | Cloudflare D1용 Drizzle 어댑터, SQLite dialect |
| 테스트 | Node 내장 테스트 러너 기반 렌더링 테스트 |
| 정적 분석 | ESLint `9.39.4`, Next.js Core Web Vitals/TypeScript 규칙 |

### `package.json` 직접 의존성

- 프로덕션: `drizzle-orm`, `next`, `react`, `react-dom`, `react-loading-skeleton`
- 개발: Cloudflare/Vite 플러그인, Tailwind/PostCSS, TypeScript 타입 패키지, Drizzle Kit, ESLint, Vinext, Vite, Wrangler
- 현재 설치되지 않은 주요 제품 후보: 폼 검증 라이브러리, 차트 라이브러리, 별도 상태 관리·서버 캐시 라이브러리, E2E 테스트 도구

### 제안사항

- 초기에는 현재 의존성을 최대한 유지한다.
- 제품 기능이 실제로 필요해질 때만 입력 검증, E2E, 접근성 테스트 도구를 추가한다.
- Next.js API를 Vinext가 변환하는 구조이므로 Next.js 전용 기능을 도입할 때 Cloudflare Worker/Vinext 호환성을 매 단계 검증한다.

## 프로젝트 폴더 구조

### 확인된 사실

```text
.
├─ .openai/
│  └─ hosting.json
├─ app/
│  ├─ _sites-preview/
│  ├─ chatgpt-auth.ts
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
├─ build/
│  └─ sites-vite-plugin.ts
├─ db/
│  ├─ index.ts
│  └─ schema.ts
├─ drizzle/
│  └─ meta/_journal.json
├─ examples/d1/
│  ├─ app/api/notes/route.ts
│  └─ db/schema.ts
├─ public/
├─ tests/
│  └─ rendered-html.test.mjs
├─ worker/
│  └─ index.ts
└─ 주요 빌드·린트·TypeScript 설정 파일
```

- `examples/d1`은 활성 앱 라우트 밖의 예제이며 현재 제품 기능이 아니다.
- `work`, `outputs`, `.wrangler`, `node_modules`, 생성된 `dist`는 제품 소스가 아니다.

## 페이지 및 라우팅 구조

### 확인된 사실

| 경로 | 파일 | 상태 |
|---|---|---|
| `/` | `app/page.tsx` | 개발용 스켈레톤만 표시 |
| 전역 레이아웃 | `app/layout.tsx` | 영문 starter 메타데이터와 Geist 폰트 |

- 활성 Route Handler는 없다.
- 로그인, 대시보드, 과정, 학습, 문제, 관리자 라우트가 없다.
- `signin-with-chatgpt`, `signout-with-chatgpt`, `callback` 경로는 플랫폼이 소유한다고 README와 인증 헬퍼가 전제하지만 앱 라우트로 구현돼 있지는 않다.

## 인증 방식

### 확인된 사실

- `app/chatgpt-auth.ts`는 요청 헤더의 `oai-authenticated-user-email`과 선택적 전체 이름을 읽는다.
- `getChatGPTUser`, `requireChatGPTUser`, 안전한 로그인·로그아웃 경로 생성 헬퍼가 있다.
- `returnTo`는 동일 오리진 상대 경로만 허용하며 예약된 인증 경로로의 복귀를 차단한다.
- 현재 어떤 페이지나 API도 이 헬퍼를 호출하지 않으므로 실제 인증 강제는 없다.
- 앱 자체 비밀번호, Google OAuth, 세션 테이블, 토큰 저장소는 없다.

### 확인하지 못한 항목

- 배포 플랫폼에서 SIWC 또는 workspace access policy가 실제로 활성화됐는지 확인할 배포 프로젝트 ID가 없다.
- 목표 서비스가 OpenAI workspace 내부 전용인지, 일반 대중 대상 외부 로그인 서비스인지 결정되지 않았다.

## 사용자 및 권한 구조

### 확인된 사실

- 사용자 테이블, 역할 enum, 역할 매핑, 관리자 allowlist가 없다.
- 서버 측 권한 검사나 관리자 페이지가 없다.
- 현재 인증 헬퍼는 신원 확인만 다루며 권한 부여는 다루지 않는다.

### 제안사항

- `LEARNER`, `CONTENT_EDITOR`, `INSTRUCTOR`, `ADMIN`, `AUDITOR` 같은 역할을 DB에서 관리한다.
- 인증은 플랫폼 신원으로, 권한은 애플리케이션 DB와 서버 측 정책으로 분리한다.
- 모든 관리자 쓰기 작업에 감사로그를 남긴다.

## 현재 기능

### 확인된 사실

- 반응형 로딩 스켈레톤
- 전역 레이아웃, 폰트, 기본 Tailwind 설정
- 선택적으로 사용할 수 있는 ChatGPT 사용자 헤더 인증 헬퍼
- 선택적으로 사용할 수 있는 D1/Drizzle DB 연결 헬퍼
- Cloudflare 이미지 최적화 요청 처리
- 빌드 결과에 Sites 메타데이터와 Drizzle 마이그레이션을 패키징하는 플러그인

다음 기능은 구현되지 않았다.

- 7개 과정 카탈로그 및 과정 전환
- 회원 프로필과 역할
- 학습 콘텐츠, 진도, 문제은행, 채점, 오답복습
- 시험, 통계, 관리자 콘텐츠 관리
- 검색, 알림, 파일 업로드, 감사로그

## 현재 데이터 구조

### 확인된 사실

- `.openai/hosting.json`의 `d1`, `r2` 값이 모두 `null`이다.
- `db/schema.ts`는 비어 있고 export만 존재한다.
- `db/index.ts`는 `env.DB`가 있을 때 Drizzle D1 인스턴스를 반환하지만 현재 바인딩은 선언되지 않았다.
- `drizzle/meta/_journal.json`에는 마이그레이션 항목이 없다.
- 실제 데이터 저장은 이루어지지 않는다.
- `examples/d1`의 `notes` 테이블과 API는 예제일 뿐 활성 앱에 연결되지 않았다.

### 환경변수

- `.env`, `.env.local`, `.env.example` 등 환경변수 파일이 없다.
- 코드가 읽는 비밀 애플리케이션 환경변수도 없다.
- 빌드 도구용으로 `CODEX_SANDBOX`, `WRANGLER_WRITE_LOGS`, `WRANGLER_LOG_PATH`, `MINIFLARE_REGISTRY_PATH`만 참조한다.

## 재사용 가능한 요소

### 유지 권장

- App Router 기반 `app` 구조와 전역 레이아웃
- Vinext/Vite/Cloudflare Worker 빌드 파이프라인
- `.openai/hosting.json` 기반 D1/R2 논리 바인딩 방식
- `db/index.ts`의 DB 접근 집중화 패턴
- `app/chatgpt-auth.ts`의 헤더 파싱, 안전한 복귀 경로 검증
- `build/sites-vite-plugin.ts`의 배포 패키징
- ESLint, TypeScript strict, Tailwind 기본 설정
- Worker 이미지 최적화 프록시

### 제한적 재사용

- `_sites-preview` 로딩 스켈레톤은 제품 로딩 UI의 참고가 될 수 있지만 starter 전용 문구와 구조이므로 제품 구현 시 제거 대상이다.
- D1 notes 예제는 CRUD/마이그레이션 구현 참고용으로만 사용하고 제품 코드로 승격하지 않는다.

## 테스트 환경

### 확인된 사실

- `npm test`는 빌드 후 Node 내장 테스트 러너로 `tests/rendered-html.test.mjs`의 2개 테스트를 실행하도록 정의돼 있다.
- 테스트는 starter 로딩 스켈레톤과 그 제거 가능성을 검증한다. 제품 도메인 테스트는 없다.
- Windows에서 `npm test`를 실행하면 Unix 방식 환경변수 할당 때문에 빌드 스크립트 시작 전에 실패한다.
- 동일한 환경변수를 PowerShell에서 먼저 설정한 뒤 Vinext 빌드를 직접 실행한 결과 빌드가 성공했다.
- 빌드 결과를 대상으로 테스트 2개가 모두 통과했다.

### 제안사항

- 패키지 스크립트를 운영체제 중립적으로 바꾼다.
- 도메인 단위 테스트, Route Handler 통합 테스트, Playwright 기반 핵심 사용자 흐름 E2E를 단계적으로 추가한다.

## 배포 환경

### 확인된 사실

- Cloudflare Worker 호환 ESM 출력을 만드는 Vinext/Vite 구성이 있다.
- 빌드 플러그인은 `.openai/hosting.json`과 `drizzle` 디렉터리를 `dist/.openai`에 복사한다.
- `.openai/hosting.json`에 `project_id`가 없어 연결된 Sites 배포 프로젝트를 확인할 수 없다.
- D1과 R2 바인딩도 비활성 상태다.
- Vercel 설정은 없고 README는 Wrangler JSON 설정을 사용하지 않는다고 명시한다.

## 주요 문제점

### 확인된 문제

1. 제품 기능이 전혀 없는 starter 상태다.
2. DB 바인딩과 스키마가 비어 있어 어떤 데이터도 영속화할 수 없다.
3. 인증 헬퍼가 있지만 적용된 보호 라우트와 권한 모델이 없다.
4. 테스트가 starter UI에 결합돼 있어 제품 구현과 동시에 교체해야 한다.
5. `package.json` 스크립트가 Windows에서 실행되지 않는다.
6. `app/page.tsx`와 스켈레톤 문구에 깨진 apostrophe 문자열(`it?셲`)이 있다.
7. 전역 `<html lang="en">`이므로 한국어 서비스 접근성·검색 메타데이터에 맞지 않는다.
8. 보안 헤더, CSP, 입력 검증, 요청 제한, 감사로그가 없다.
9. 배포 프로젝트와 데이터 리소스가 연결되지 않았다.
10. Git 메타데이터가 없어 변경 추적과 롤백 기준을 확인할 수 없다.

### 보안상 문제가 될 수 있는 부분

- 인증 헤더를 사용할 수 있다는 사실과 실제 라우트 보호는 다르다. 현재는 모든 활성 화면이 익명 접근 가능하다.
- 신원 헤더만으로 관리자 권한을 추론하면 안 된다. 서버 측 역할 검증이 별도로 필요하다.
- Worker 이미지 최적화 경로는 허용 폭을 제한하지만 외부 이미지 원본 정책은 아직 제품 요구에 맞게 정의되지 않았다.
- API 입력 검증, CSRF 정책, rate limit, 콘텐츠 보안 정책이 구현되지 않았다.
- 개인정보 보유·파기, 최소 수집, 관리자 열람 제한, 감사 추적 구조가 없다.
- 의존성 취약점 감사와 실제 배포 보안 설정은 이번 로컬 분석에서 확인하지 않았다.

## 멀티과정 전환 방안

### 제안사항

1. 모든 콘텐츠를 특정 시험명에 하드코딩하지 않고 `course`를 최상위 테넌트와 유사한 범위로 둔다.
2. 공통 학습 엔진과 과정별 분류체계를 분리한다.
3. 공통 콘텐츠는 여러 과정에 매핑할 수 있도록 다대다 연결 테이블을 사용한다.
4. URL에 과정 slug를 명시해 새로고침과 공유 시 선택 과정이 유지되게 한다.
5. 사용자 진도·점수·복습 일정의 유일성 키에 `course_id`를 포함한다.
6. 관리자 권한도 전역 역할과 과정별 역할로 분리할 수 있게 설계한다.
7. 초기 7개 과정은 seed 데이터로 관리하고, 코드 enum에만 고정하지 않는다.

초기 과정:

1. ISMS-P
2. 정보보안기사
3. 정보보안산업기사
4. 정보보호위험관리사(ISRM)
5. SW 보안약점 진단원
6. CPPG 개인정보관리사
7. 개인정보 영향평가

## 유지해야 할 기존 기능

- Cloudflare Worker/Vinext 빌드 가능 상태
- App Router 및 TypeScript strict 설정
- 안전한 ChatGPT 인증 복귀 경로 처리
- D1 접근을 한곳으로 모으는 DB 헬퍼 패턴
- 배포 메타데이터·마이그레이션 패키징
- 이미지 최적화 처리
- 현재 통과하는 빌드 기준선

## 제거 또는 리팩터링 후보

### 제품 구현 시작 시 제거 후보

- `app/_sites-preview`와 `react-loading-skeleton`: 다른 제품 화면에서 사용하지 않을 경우 제거
- starter 전용 메타데이터, 영문 문구, 기본 아이콘
- 제품과 무관한 notes 예제: 문서 예제로 유지할지 별도 결정

### 리팩터링 후보

- Windows 비호환 npm 스크립트
- `worker/index.ts`의 `DB`를 항상 필수로 선언한 타입과 실제 `d1: null` 설정의 불일치
- 하나의 `db/schema.ts`가 커지는 것을 막기 위한 도메인별 schema 모듈
- 인증과 권한을 분리한 서버 측 정책 계층
- starter 테스트를 제품 행동 중심 테스트로 교체

## 권장 아키텍처

### 제안사항

- 초기에는 별도 마이크로서비스 없이 하나의 App Router 애플리케이션과 Worker를 사용하는 모듈형 모놀리스로 유지한다.
- 도메인 모듈은 `identity`, `catalog`, `content`, `assessment`, `learning`, `review`, `admin`, `audit`로 나눈다.
- Server Component는 읽기 화면, Route Handler/Server Action은 검증된 쓰기 작업에 사용한다.
- DB 접근은 repository/query 모듈에 집중하고 UI에서 D1을 직접 호출하지 않는다.
- 과정 선택은 URL을 진실의 원천으로, 마지막 선택값 같은 편의 설정만 사용자 프로필에 저장한다.
- 자세한 목표 구조는 `docs/target-architecture.md`를 따른다.

## 권장 DB 구조

### 제안사항

핵심 테이블 그룹:

- 신원·권한: `users`, `roles`, `user_roles`, `course_memberships`
- 과정 카탈로그: `courses`, `course_domains`, `modules`, `learning_units`
- 콘텐츠: `content_items`, `content_versions`, `content_course_mappings`, `tags`
- 평가: `questions`, `question_choices`, `question_course_mappings`, `exams`, `exam_questions`
- 학습 기록: `enrollments`, `learning_progress`, `quiz_attempts`, `quiz_answers`
- 복습: `review_items`, `wrong_answer_notes`, `bookmarks`
- 운영: `audit_logs`, `content_publication_events`

상세 필드와 관계는 `docs/target-architecture.md`에 제안한다.

## 구현 우선순위

1. 과정 도메인과 7개 과정 seed, URL 기반 과정 전환
2. 실제 인증 적용과 최소 역할 모델
3. 과정별 콘텐츠 분류체계 및 읽기 화면
4. 학습 진도 저장
5. 문제은행·채점·오답복습
6. 관리자 콘텐츠 관리와 감사로그
7. 통계·모의시험·고급 추천

## 위험요소

### 예상 마이그레이션 위험

- 현재 DB가 비어 있어 데이터 변환 위험은 낮지만, 초기에 과정 범위를 잘못 설계하면 이후 모든 진도·문제·통계 테이블을 다시 바꿔야 한다.
- 공통 문제·법령·기준을 과정마다 복제하면 정합성 문제가 발생한다.
- D1/SQLite 제약을 고려하지 않고 PostgreSQL 전용 타입이나 쿼리를 설계하면 현재 배포 구조와 충돌한다.
- SIWC 신원과 애플리케이션 권한을 혼동하면 관리자 권한 상승 위험이 있다.
- Vinext는 Next.js 전체 동작과 항상 동일하다고 가정할 수 없으므로 동적 API와 미들웨어 사용에 호환성 위험이 있다.
- 기존 starter 테스트를 너무 일찍 삭제하면 빌드 기준선을 잃는다. 제품 테스트로 교체하면서 제거해야 한다.
- Git 이력이 없는 상태에서 대규모 변경을 시작하면 안전한 롤백이 어렵다.

## 첫 번째 구현 범위

### 제안사항

다음 단계의 첫 구현은 “멀티과정 기반 골격”으로 제한한다.

- `courses` 및 최소 분류 테이블 정의
- 7개 초기 과정 seed
- `/courses`와 `/courses/[courseSlug]` 라우트
- 공통 헤더의 과정 전환 UI
- 과정 slug 검증과 존재하지 않는 과정 처리
- 과정 목록·상세 조회 repository
- DB 마이그레이션 및 seed 검증 테스트
- 기존 빌드 파이프라인과 인증 헬퍼 유지

아직 포함하지 않을 범위:

- 대규모 문제은행
- 모의시험
- AI 추천
- 파일 업로드
- 고급 통계
- 일반 대중 대상 이메일/Google 로그인

## 확인하지 못한 항목

- 실제 운영 배포 URL과 Sites 프로젝트 설정
- SIWC/access policy 활성화 상태
- 운영용 D1/R2 리소스
- 실제 사용자·콘텐츠·개인정보 데이터
- 목표 서비스의 공개 범위와 로그인 제공자
- 과정별 공식 출제기준과 콘텐츠 저작권 상태
- 의존성 취약점 감사 결과
- Git 커밋 이력과 현재 변경 기준선


# 운영 보안 점검 보고서

기준일: 2026-07-27

## 점검 범위

확인된 실제 구조를 기준으로 다음 영역을 점검했다.

- Vinext/Next.js App Router와 Cloudflare Worker 응답 헤더
- `app/api` 변경 요청과 `lib/http.ts`의 CSRF 검증
- Sites/SIWC 인증 헤더, `lib/auth.ts`의 사용자 상태 및 RBAC
- 관리자 API, AI API, 데이터 내보내기와 Rate Limit
- 오류 응답, request ID, 감사로그의 민감정보 처리
- 오디오·영상 외부 URL 정책과 향후 파일 업로드 입력 정책
- Cloudflare/Sites 환경변수와 `.openai/hosting.json`
- `package.json`, `package-lock.json`, 직접 의존성 및 자동 업데이트 설정

## 적용 보호조치

### 보안 헤더

모든 Worker 응답과 이미지 최적화 응답에 다음 헤더를 중앙 적용한다.

- Content-Security-Policy
- Strict-Transport-Security: `APP_ENV=production`이고 요청이 HTTPS일 때만 적용
- X-Content-Type-Options: `nosniff`
- X-Frame-Options: `DENY`
- Referrer-Policy: `strict-origin-when-cross-origin`
- Permissions-Policy
- Cross-Origin-Opener-Policy

CSP는 `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`,
`form-action 'self'`를 고정한다. Production에서는 `unsafe-eval`을 허용하지
않으며 `upgrade-insecure-requests`를 적용한다. 영상 프레임은 중앙 영상
공급자 정책의 YouTube nocookie와 Vimeo Origin만 기본 허용한다. 이미지와
오디오는 환경변수의 HTTPS Origin allowlist로 확장한다.

Vinext가 현재 HTML에 inline RSC bootstrap script와 inline style을 생성하므로
`unsafe-inline`을 즉시 제거하면 페이지 실행이 중단된다. CSP 생성기는 nonce
입력을 지원하도록 분리했으며, 런타임이 동일 nonce를 렌더링된 script/style에
주입할 수 있게 되면 `unsafe-inline`을 제거한다.

### 인증과 권한

- 인증은 Sites가 소유하는 SIWC 경로와 전달 헤더를 사용한다.
- 보호 페이지는 서버 컴포넌트에서 인증 및 역할을 검사한다.
- API는 `requireApiUser`와 역할별 서버 검증 함수를 사용한다.
- 사용자 상태가 `ACTIVE`가 아니면 모든 앱 사용자 생성 단계에서 차단한다.
- 감사로그 조회는 ADMIN 이상, 내보내기는 SUPER_ADMIN으로 제한한다.
- 개발용 신원 대체는 `NODE_ENV !== production`에서만 작동한다.

세션 만료, SameSite 쿠키, 로그아웃 토큰 무효화와 인증 callback은 Sites/SIWC가
소유하며 애플리케이션에 callback Route를 만들지 않는다. 현재 역할 변경 및
관리자 계정 관리 API가 없으므로 마지막 SUPER_ADMIN 보호와 자기 권한 상승
차단은 실제 변경 흐름에 적용할 대상이 없다. 향후 해당 API를 추가할 때
트랜잭션 안에서 마지막 활성 SUPER_ADMIN 수와 행위자/대상 동일성 검사가
필수다.

### CSRF

- 모든 확인된 POST/PUT/PATCH/DELETE API가 `assertSameOrigin`을 호출한다.
- Origin 또는 Referer 중 하나가 현재 요청 Origin과 정확히 같아야 한다.
- Origin과 Referer가 모두 없거나 파싱할 수 없으면 요청을 거부한다.
- Sites가 소유하는 로그인·로그아웃·callback은 앱 변경 API가 아니며 예외
  Route를 추가하지 않았다.
- 인증 쿠키의 SameSite 설정은 Sites/SIWC 운영 설정에서 별도 확인해야 한다.

### Rate Limit

`RateLimitProvider` 인터페이스와 `MemoryRateLimitProvider`를 적용했다.
AI 요청, 관리자 변경, 데이터 내보내기, 수강·학습 기록 등 기존 제한 대상은
동일 중앙 API를 사용한다. 관리자 변경은 기본 30회/분, 감사로그 내보내기는
5회/시간으로 제한한다.

로그인과 비밀번호 재설정은 Sites 소유 인증 흐름이며 앱 Route가 없다. 파일
업로드 Route도 현재 존재하지 않는다. 메모리 Provider는 단일 Worker
인스턴스 범위이므로 Production의 다중 인스턴스에서 전역 한도를 보장하지
않는다. 운영 전 KV, Durable Object 또는 외부 Redis 기반 Provider를 구현하고
중앙 Provider 구성 지점에 주입해야 한다.

### 파일 업로드

현재 `.openai/hosting.json`의 R2 바인딩은 `null`이고 업로드 API도 없다.
실제 업로드 기능을 추가하지 않고 다음 사전검증 서비스만 준비했다.

- 파일 종류별 확장자와 MIME 조합 검증
- 크기 제한
- NFKC 파일명 정규화와 경로 구분자·제어문자 차단
- 실행 파일, JavaScript, HTML, SVG 차단
- 공개·비공개 저장 키 분리
- 원본 파일명 대신 UUID 기반 서버 저장 키 생성

실제 업로드를 도입할 때는 R2의 비공개 버킷 정책, 파일 signature 검사,
악성코드 검사, 다운로드 응답의 Content-Disposition과 CSP를 추가해야 한다.

### 오류와 로그

- 알려진 오류는 제한된 공개 오류 코드로 반환한다.
- 알 수 없는 오류는 내부 stack/DB 메시지 없이 `INTERNAL_ERROR`로 반환한다.
- 오류 응답과 Worker 응답에 request ID를 제공한다.
- 오류 응답은 `no-store`로 설정한다.
- 애플리케이션 코드에서 `console.log`, `console.debug` 또는 stack 출력은
  확인되지 않았다.
- 로컬 Wrangler 로그 기록은 기본 비활성화되어 있다.
- 감사로그 metadata는 action별 allowlist와 민감 키 차단을 적용한다.

### 환경변수

Worker 요청 처리 시작 시 운영 환경을 검증한다.

- `APP_ENV=production`에서 `DEV_AUTH_EMAIL` 금지
- Production `AUDIT_IP_HASH_SALT`는 32자 이상이며 기본·약한 값 금지
- OpenAI Provider 사용 시 서버 전용 API Key 필요
- 이름상 Secret인 `NEXT_PUBLIC_*` 값 차단
- 외부 미디어 CSP Origin은 HTTPS만 허용

`.env.example`에는 실제 Secret을 기록하지 않는다. 운영 값은 Sites 런타임
환경변수로 관리해야 한다.

## 발견 위험과 수정 항목

| 발견 사항 | 조치 | 상태 |
|---|---|---|
| CSP가 환경 구분 없이 고정됨 | Production/Development 정책 분리 | 수정 완료 |
| Development 외에도 `unsafe-eval` 가능성 | Production CSP에서 제거 | 수정 완료 |
| HSTS 미적용 | Production HTTPS 조건부 적용 | 수정 완료 |
| 외부 이미지 전체 HTTPS 허용 | 명시적 HTTPS Origin allowlist로 축소 | 수정 완료 |
| Rate Limit이 전역 Map 함수에 결합 | Provider 인터페이스와 메모리 구현체로 분리 | 수정 완료 |
| 일부 관리자 변경 Route에 제한 없음 | 모든 확인된 관리자 변경 Route에 중앙 제한 적용 | 수정 완료 |
| 내보내기 호출 제한 없음 | SUPER_ADMIN 권한과 5회/시간 제한 | 수정 완료 |
| 업로드 공통 검증기 없음 | MIME·확장자·크기·경로·SVG 차단 서비스 추가 | 수정 완료 |
| 일반 오류 응답에 추적 ID 없음 | 안전한 request ID와 `no-store` 추가 | 수정 완료 |
| 운영 환경변수 시작 검증 없음 | Worker 진입 시 검증 추가 | 수정 완료 |
| 자동 의존성 업데이트 정책 없음 | 주간 Dependabot 설정 추가 | 수정 완료 |

## 남은 위험

- Vinext inline bootstrap과 style 때문에 Production CSP에도
  `unsafe-inline`이 남아 있다.
- 메모리 Rate Limit은 분산 Worker 전체 한도를 보장하지 않는다.
- Sites/SIWC의 세션 수명, SameSite, 로그아웃 무효화 정책은 저장소 밖의
  호스팅 설정이다.
- 사용자/역할 관리 기능이 없어 마지막 SUPER_ADMIN 및 자기 권한 상승 정책을
  실제 흐름에서 검증할 수 없다.
- 업로드 기능이 없어 바이너리 signature와 악성코드 검사를 통합 검증하지
  않았다.
- npm 보안 advisory endpoint에 네트워크 접근할 수 없어 Dependency Audit
  결과를 취약점 0건으로 확정할 수 없다.
- `.openai/hosting.json`의 기존 Sites 프로젝트 ID가 현재 Sites API에서
  조회되지 않으므로 실제 Production 헤더와 환경변수 검증은 배포 환경에서
  수행하지 못했다.

## Production 확인 필요사항

1. `APP_ENV=production` 설정
2. 32자 이상의 고유 `AUDIT_IP_HASH_SALT` 설정
3. OpenAI 사용 시 `OPENAI_API_KEY`를 서버 전용 Secret으로 등록
4. 필요한 이미지·오디오·프레임 Origin만 allowlist에 등록
5. 실제 HTTPS 응답의 CSP와 HSTS 확인
6. Sites/SIWC의 SameSite, 세션 만료, 로그아웃 무효화 정책 확인
7. KV, Durable Object 또는 Redis 기반 RateLimitProvider 적용
8. 네트워크 가능한 CI에서 `npm audit` 실행
9. 역할 관리 기능 도입 전 마지막 SUPER_ADMIN 보호 테스트 추가
10. 업로드 도입 전 R2 비공개 정책, signature 및 악성코드 검사 추가

## 운영 전 필수 조치

Sites 프로젝트 연결을 복구한 뒤 환경변수 검증을 통과시키고, 배포된 HTTPS
응답 헤더를 확인해야 한다. 분산 Rate Limit과 SIWC 세션 정책이 확인되지
않은 상태에서는 고위험 관리자 기능의 공개 운영 범위를 제한한다.

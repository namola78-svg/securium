# 통합 운영 준비 검수

## 판정 기준

이 문서는 코드에 존재하는 기능, Mock/샘플 기능, 외부 연결이 필요한 기능을 구분한다. 실제 Production DB, Storage, OpenAI, GitHub, Vercel 또는 Sites 배포 변경은 이 검수에서 수행하지 않았다.

## 코드 구현 범위

- App Router와 `app/api`, `db` Repository 기반의 과정·수강·학습 플랫폼
- SIWC 사용자 식별, 서버 RBAC, 소유권 및 과정별 격리
- LearningUnit/Lesson과 사용자 진도
- 문제은행, 채점, 오답노트, 복습, 모의고사, 통계
- 오디오, 강의, 콘텐츠 revision, AI Provider/Retrieval, 관리자 AI 검수
- ISMS-P, CPPG, 정보보안기사·산업기사, ISRM, SW 보안약점, 개인정보 영향평가 특화 데이터와 화면
- 중앙 감사로그, 운영 보안 헤더·CSRF·rate limit·업로드 검증
- Supabase 준비용 provider와 정책 예시, GitHub CI 및 Vercel 문서

## Mock 및 외부 연결 구분

- Seed의 과정·문제·강의·오디오·특화 콘텐츠는 개발용 샘플이다.
- `AI_PROVIDER=mock`은 Mock AI이며 실제 OpenAI 연동 완료가 아니다.
- 브라우저 Speech Synthesis는 실제 강사 음성이 아니다.
- `STORAGE_PROVIDER=local`은 개발용이다. Production Storage 연결 완료가 아니다.
- Supabase SQL과 Storage provider는 준비 상태이며 실제 프로젝트·버킷·RLS 적용을 검증하지 않았다.
- GitHub Actions 파일은 준비되어 있으나 저장소 push와 원격 실행을 수행하지 않았다.
- Vercel 호환 문서는 준비되어 있으나 프로젝트 연결과 배포를 수행하지 않았다.
- `.openai/hosting.json`은 기존 Sites 프로젝트와 D1 binding 식별자다. 삭제하거나 Vercel 설정으로 대체하지 않는다.

## 운영 전 차단 조건

- Production 대상 DB/Storage 백업과 복구 시험
- 운영 SIWC와 최초 최고 관리자 부트스트랩 검증
- Production 환경변수와 secret 검증
- 분산 환경용 외부 rate limit provider 연결
- 실제 Storage signed URL, 정책과 객체 접근 검증
- Mock/샘플 콘텐츠의 운영 노출 여부 결정
- 운영 E2E, 접근성, 브라우저/모바일 수동 검수
- 의존성 취약점 조회가 가능한 CI 환경에서 audit 통과
- 외부 Supabase/OpenAI/GitHub/Vercel/Sites 연결은 각각 별도 승인

## 2026-07-27 검증 결과

| 항목 | 결과 |
|---|---|
| Drizzle schema validation | 통과 (`npm run db:check`) |
| Schema format | 전용 script 없음. 성공으로 간주하지 않음 |
| ORM generation | Drizzle migration generation 실행, 68 tables, 변경 없음 |
| Local migration 상태 | 적용 대기 migration 없음 |
| TypeScript | 통과 |
| Lint | 통과 |
| Unit | 91/91 통과 |
| Integration | 14/14 통과 |
| E2E | 63/63 통과 |
| Production Build | 통과 |
| 문서 내부 링크 | 12개 확인, 누락 0 |
| 미사용 TypeScript symbol | 강제 검사 통과 |
| 완전 동일 소스 파일 | 186개 대상, 중복 0 |
| 설치 의존성 | `npm ls --depth=0` 정상 |
| Dependency Audit | npm advisory endpoint 연결 실패로 미완료 |

E2E에는 비로그인 보호, CSRF 동일 출처 검사, 사용자·과정별 데이터 격리, 레슨·문제·오답·모의고사, 오디오·강의, AI, 콘텐츠 버전과 감사로그 흐름이 포함된다. Production SIWC, 원격 D1, 실제 Storage, 실제 OpenAI 및 실제 배포 도메인에 대한 수동 검증은 수행하지 않았다.

## 현재 결론

**CONDITIONAL GO**. 코드 검증은 통과했으나 Production 전에는 의존성 audit 재실행, 백업/복구 시험, 운영 SIWC·최초 관리자 검증, 실제 외부 서비스 연결과 운영 도메인 보안 확인이 필요하다.

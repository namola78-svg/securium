# PostgreSQL Repository Runtime

## 구현된 범위

`DB_PROVIDER=supabase`이면 기존 `getDb()` 기반 Drizzle Repository가
`DatabaseProvider` 경계를 통해 PostgreSQL runtime driver를 사용한다.
기존 D1 Repository와 API Route는 복제하거나 전면 재작성하지 않았다.

공통 호환 계층은 다음을 담당한다.

- D1 Drizzle의 `?` parameter를 PostgreSQL provider에 전달
- `LIKE`를 PostgreSQL의 `ILIKE`로 안전하게 정규화
- SQLite scalar `max(a, b)`를 PostgreSQL `greatest(a, b)`로 정규화
- `batch()`를 하나의 PostgreSQL transaction으로 실행
- 조회 결과를 기존 D1 Drizzle row mapping 형식으로 반환
- 지원하지 않는 raw multi-statement 실행과 dump 요청을 명시적으로 차단

따라서 AI, 오디오, 강의, 감사로그, 콘텐츠 버전, 단계·복습·추천·통계,
모의고사, 문제 workflow, 과정 특화 및 실무형 Repository도 동일한
provider 선택 경로를 사용한다.

## D1 보존

`DB_PROVIDER=d1` 경로와 `.openai/hosting.json`의 `DB` binding은 변경하지
않았다. 로컬 Integration/E2E 테스트는 `.env.local`에 Supabase 설정이
있어도 별도의 D1 테스트 실행기로 격리된다.

## 트랜잭션

기존 문제 수정, 모의고사 제출, 콘텐츠 버전 게시 등에서 사용하는
Drizzle `batch()`는 PostgreSQL에서 동일 connection transaction으로
순차 실행된다. 중간 statement가 실패하면 provider transaction 전체가
rollback된다.

## 아직 수행하지 않은 작업

- D1 운영 데이터 export 및 PostgreSQL import
- Production runtime의 `DB_PROVIDER` 전환
- 실제 Production API 쓰기 smoke test
- Sites 또는 Vercel Production 배포

위 작업은 백업, migration 검증, 데이터 정합성 확인 및 별도 승인 후
수행해야 한다.

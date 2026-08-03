# 정보보안기사·정보보안산업기사 문항 Seed 운영 가이드

이 문서는 SECURIUM의 정보보안 국가기술자격 과정 문항 seed를 로컬 D1 또는 PostgreSQL에 적용하기 전 확인해야 할 명령과 안전장치를 정리한다.

운영 PostgreSQL에 직접 적용하는 명령은 명시적 승인 플래그와 확인용 환경변수가 모두 있어야 실행된다. 이 문서는 절차 안내용이며, 문서 작성만으로 운영 DB 변경은 발생하지 않는다.

## 대상 과목

| 과목 | 공유 범위 | stats 명령 |
| --- | --- | --- |
| 네트워크 보안 | 정보보안기사, 정보보안산업기사 | `npm run curriculum:security-certification:network-questions:stats` |
| 시스템 보안 | 정보보안기사, 정보보안산업기사 | `npm run curriculum:security-certification:system-questions:stats` |
| 애플리케이션 보안 | 정보보안기사, 정보보안산업기사 | `npm run curriculum:security-certification:application-security-questions:stats` |
| 정보보안 일반 | 정보보안기사, 정보보안산업기사 | `npm run curriculum:security-certification:information-security-general-questions:stats` |
| 정보보호관리 및 법규 | 정보보안기사 전용 | `npm run curriculum:security-certification:management-law-questions:stats` |

## 로컬 D1 적용

로컬 D1 seed는 개발 검증용이다. 운영 데이터에는 영향을 주지 않는다.

```powershell
npm run curriculum:security-certification:network-questions:seed:d1-local
npm run curriculum:security-certification:system-questions:seed:d1-local
npm run curriculum:security-certification:application-security-questions:seed:d1-local
npm run curriculum:security-certification:information-security-general-questions:seed:d1-local
npm run curriculum:security-certification:management-law-questions:seed:d1-local
```

로컬 적용 후에는 다음 명령으로 실제 연결 상태를 검증한다.

```powershell
npm run curriculum:security-certification:network-questions:verify:d1-local
npm run curriculum:security-certification:system-questions:verify:d1-local
npm run curriculum:security-certification:application-security-questions:verify:d1-local
npm run curriculum:security-certification:information-security-general-questions:verify:d1-local
npm run curriculum:security-certification:management-law-questions:verify:d1-local
```

## PostgreSQL 적용 전 필수 확인

PostgreSQL seed는 데이터 변경 작업이다. 다음을 먼저 확인한다.

1. PostgreSQL base migration 적용 여부
2. 과정 seed 적용 여부
3. CourseLesson content seed 적용 여부
4. `user-admin`, `user-content-reviewer` 기준 사용자 존재 여부
5. 운영/Preview 대상 DB가 맞는지
6. 백업 또는 롤백 기준이 준비되어 있는지

## PostgreSQL seed 승인 플래그

PostgreSQL seed는 다음 두 조건을 모두 만족해야 실행된다.

1. 명령 인자: `--confirm-production-seed`
2. 과목별 확인 환경변수

| 과목 | 확인 환경변수 |
| --- | --- |
| 네트워크 보안 | `SECURIUM_CONFIRM_NETWORK_SECURITY_QUESTION_SEED=APPLY_NETWORK_SECURITY_QUESTION_SEED` |
| 시스템 보안 | `SECURIUM_CONFIRM_SYSTEM_SECURITY_QUESTION_SEED=APPLY_SYSTEM_SECURITY_QUESTION_SEED` |
| 애플리케이션 보안 | `SECURIUM_CONFIRM_APPLICATION_SECURITY_QUESTION_SEED=APPLY_APPLICATION_SECURITY_QUESTION_SEED` |
| 정보보안 일반 | `SECURIUM_CONFIRM_INFORMATION_SECURITY_GENERAL_QUESTION_SEED=APPLY_INFORMATION_SECURITY_GENERAL_QUESTION_SEED` |
| 정보보호관리 및 법규 | `SECURIUM_CONFIRM_MANAGEMENT_LAW_QUESTION_SEED=APPLY_MANAGEMENT_LAW_QUESTION_SEED` |

PostgreSQL seed 명령은 다음과 같다. 아래 명령은 각 스크립트 내부에서 `--confirm-production-seed`와 과목별 확인 환경변수를 추가로 요구한다.

```powershell
npm run curriculum:security-certification:network-questions:seed:postgres -- --confirm-production-seed
npm run curriculum:security-certification:system-questions:seed:postgres -- --confirm-production-seed
npm run curriculum:security-certification:application-security-questions:seed:postgres -- --confirm-production-seed
npm run curriculum:security-certification:information-security-general-questions:seed:postgres -- --confirm-production-seed
npm run curriculum:security-certification:management-law-questions:seed:postgres -- --confirm-production-seed
```

예시:

```powershell
$env:SECURIUM_CONFIRM_APPLICATION_SECURITY_QUESTION_SEED = "APPLY_APPLICATION_SECURITY_QUESTION_SEED"
node scripts/run-security-certification-question-seed.mjs application-security seed:postgres --confirm-production-seed
Remove-Item Env:SECURIUM_CONFIRM_APPLICATION_SECURITY_QUESTION_SEED
```

## PostgreSQL 검증

검증 명령은 seed나 migration을 수행하지 않고, 이미 적용된 문항 수·공개 상태·샘플 표시·과정 연결·콘텐츠 연결만 확인한다.

```powershell
npm run curriculum:security-certification:network-questions:verify:postgres
npm run curriculum:security-certification:system-questions:verify:postgres
npm run curriculum:security-certification:application-security-questions:verify:postgres
npm run curriculum:security-certification:information-security-general-questions:verify:postgres
npm run curriculum:security-certification:management-law-questions:verify:postgres
```

## 과정 분리 정책

- 네트워크 보안, 시스템 보안, 애플리케이션 보안, 정보보안 일반 문항은 기사·산업기사 양쪽 과정에 연결된다.
- 정보보호관리 및 법규 문항은 현재 정보보안기사 전용으로 연결된다.
- 기사와 산업기사는 문항 원문을 공유할 수 있지만, 풀이 기록·오답노트·진도·통계는 courseId 기준으로 분리되어야 한다.

## 안전 원칙

- 공식 기출문제나 유료 교재 문항을 복제하지 않는다.
- seed 문항은 SECURIUM이 독립 작성한 샘플임을 유지한다.
- 운영 DB 적용은 사용자 승인 없이 실행하지 않는다.
- seed 적용 전 stats를 먼저 확인한다.
- seed 적용 후 verify를 실행한다.
- 실패 시 오류 코드를 숨기지 말고 원인과 대상 DB를 분리해서 기록한다.

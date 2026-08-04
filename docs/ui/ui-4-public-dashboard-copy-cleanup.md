# UI-4 공개 가이드·대시보드 문구 정리

## 범위

- 대상 경로
  - `/guide`
  - `/dashboard`
- 변경 유형: 공개 화면과 학습자 화면의 문구 정리
- 데이터/API 변경: 없음
- DB 변경: 없음
- 배포: 없음

## 변경 내용

- 공개 학습 가이드 화면의 깨진 한글 문구를 정상 문구로 교체했다.
- 로그인 후 대시보드 화면의 깨진 한글 문구를 정상 문구로 교체했다.
- 기존 데이터 로딩 흐름은 유지했다.
  - `requireCurrentAppUser`
  - `listDashboardUserEnrollments`
  - `getTodayLearningPlan`
  - Suspense fallback 구조
- 대시보드 링크와 학습 흐름 동작은 변경하지 않았다.
- 로딩, 빈 상태, 추천 학습 문구를 사용자 친화적으로 정리했다.
- 내부 구현 상태처럼 보이는 표현을 공개 화면에서 제거했다.

## UX 메모

- `/guide`는 공개 진입 전환 화면이므로, 브랜드 신뢰감과 학습 시작 방법을 빠르게 이해하도록 문구를 정리했다.
- `/dashboard`는 로그인 후 첫 학습 화면이므로, 로딩·빈 상태·추천 학습을 내부 구현 용어 없이 설명하도록 정리했다.
- 수강, 진도, 추천, 통계 계산 로직은 변경하지 않았다.

## 검증

- `app`, `components`, `lib` 범위에서 대표 mojibake 패턴 검색: 추가 발견 없음
- `npm.cmd run typecheck`: 통과
- `npm.cmd run lint`: 통과
- `npm.cmd run test:unit`: 289/289 통과
- `tests/rendered-html.test.mjs`: 18/18 통과
- `npm.cmd run build`: 통과

## 운영 영향

- Production DB 변경 없음
- Seed 변경 없음
- API/Repository 변경 없음
- Secret 변경 없음
- 배포 없음

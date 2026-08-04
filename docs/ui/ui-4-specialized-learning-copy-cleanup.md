# UI-4 특화 학습·관리자 문구 정리

## 범위

이번 정리는 과정별 특화 학습 화면, 실무형 학습 화면, 관리자 특화 콘텐츠 화면,
AI 검수 화면의 깨진 한글과 내부 개발 문구를 정리했다.

데이터 구조, API 계약, Repository, Seed, Migration, 배포 설정은 변경하지 않았다.

## 변경 영역

### 특화 과정 학습 화면

- 특화 과정 개요 화면의 깨진 한글을 정상 문구로 교체했다.
- 내부 샘플 표현을 학습자용 안내 문구로 정리했다.
- ISMS-P 기준, 결함사례, 법령, 위험 시나리오, 관련 문제 연결 라벨을 정상화했다.
- 관련 콘텐츠 표시 구조와 라우팅은 유지했다.

### 개인정보 영향평가 실무 화면

- 개인정보 흐름도 제목, SVG 설명, 텍스트 대체 목록 라벨을 정상화했다.
- 시나리오 기본 정보 라벨을 정상화했다.
- 평가보고서형 답안, 영향평가 대상 판단, 평가 항목 매핑, 침해요인, 개선방안 문구를 정리했다.
- `publicCopy`를 적용해 공개 화면에서 `[개발용 샘플]` 접두어가 그대로 보이지 않게 했다.
- SVG와 모바일 텍스트 대체 목록 구조는 유지했다.

### 관리자 특화 콘텐츠 화면

- `/admin/specialized`의 깨진 한글 문구를 정상화했다.
- `/admin/practical-specializations`의 깨진 한글 문구를 정상화했다.
- 과정 간 콘텐츠 연결, 법령·조문, 위험관리 시나리오, 보안약점, 흐름도, 채점규칙 라벨을 정리했다.
- 관리자 입력 폼의 API 경로와 Repository 호출은 변경하지 않았다.

### 관리자 AI 검수 화면

- `/admin/ai-reviews`와 `AdminAIReviewConsole`의 깨진 한글 문구를 정상화했다.
- AI 원본, 관리자 수정본, 검수 의견, 검수 콘텐츠 제목, 검수 이력 라벨을 정리했다.
- Mock Provider는 숨기지 않고 관리자 화면에서 `모의 AI`로 표시한다.
- AI 원본과 관리자 수정본 분리 보존 원칙은 유지했다.

### AI fallback 및 공개 문구 정규화

- `MockAIProvider`의 안내 문구를 정상 한국어로 정리했다.
- AI disclaimer와 insufficient-context 문구를 유지했다.
- `publicCopy`는 공개 화면에 노출되는 내부 샘플 접두어와 Phase 문구를 제거하도록 정리했다.

## 검증

- `npm.cmd run typecheck`: 통과
- `npm.cmd run lint`: 통과
- `npm.cmd run test:unit`: 289/289 통과
- `tests/ai-e2e.test.mjs`, `tests/ai-specialized-e2e.test.mjs`: 11/11 통과
- `tests/practical-e2e.test.mjs`: 5/5 통과
- `tests/specialized-e2e.test.mjs`: 7/7 통과
- `tests/rendered-html.test.mjs`: 18/18 통과
- `npm.cmd run test:e2e`: 75/75 통과
- `npm.cmd run build`: 통과

## 운영 영향

- Production DB 변경 없음
- Seed 변경 없음
- Migration 변경 없음
- API/Repository 계약 변경 없음
- Secret 변경 없음
- 배포 없음

## 커밋 전 주의

현재 환경에서는 `.git/index.lock` 생성 권한 문제로 Codex가 직접 커밋하지 못했다.
사용자 터미널에서 커밋/푸시가 필요하다.

# 정보보안 자격 커리큘럼 온톨로지 Coverage 기반

이 문서는 정보보안기사·정보보안산업기사 공식 커리큘럼과 공통 학습 콘텐츠를
온톨로지 관점에서 연결하고 검수하기 위한 로컬 기반 구조를 설명한다.

## 확인된 사실

- 공식 커리큘럼은 `CurriculumTree`와 `CurriculumNode`로 관리한다.
- 공통 이론 콘텐츠는 `Content`로 관리하고, 과정별 제공 맥락은
  `CourseLesson`으로 분리한다.
- 현재 공식 과목·실기 개요와 네트워크·시스템보안·애플리케이션보안 일부 세부 CourseLesson seed는 61개 연결을 제공한다.
- 온톨로지 전용 DB 테이블은 아직 생성하지 않았다.
- 운영 DB seed 적용은 별도 승인 후에만 수행한다.

## 현재 로컬 기반

`lib/curriculum/security-certification-ontology.ts`는 운영 DB를 변경하지 않고
다음 정보를 계산한다.

- 공식 커리큘럼 노드 기반 Concept
- 공통 Content의 `coreConcepts` 기반 Concept
- `CurriculumNode -> CourseLesson` edge
- `CourseLesson -> Content` edge
- `Content -> Concept` edge
- 과정별 linked node count
- 과정별 ontology coverage gap

현재 로컬 계산 기준 linked curriculum node는 정보보안기사 31개, 정보보안산업기사 30개다. 운영 DB 상태가 아니라 seed 코드 기준이며, Production 반영은 별도 승인 절차가 필요하다.

## 관리자 화면 연동

`/admin/curriculum` 화면은 선택된 공식 정보보안 자격 커리큘럼 트리에 대해
다음 정보를 표시한다.

- 온톨로지 노드 연결률
- 연결된 공식 노드 수
- CourseLesson edge 수
- Concept edge 수
- 우선 연결 후보 gap 목록
- 노드 상세의 규칙 기반 콘텐츠 추천 후보
- 추천 후보 클릭 시 노드 수정 폼의 연결 체크박스 임시 선택

추천은 자동 저장하지 않는다. 관리자가 노드 수정 폼에서 내용을 확인한 뒤
저장해야 실제 `metadata.linkedContent`에 반영된다.

## 안전 원칙

- 동일 Content를 여러 과정에서 재사용하더라도 edge에는 `courseId`를 포함해
  과정 범위를 분리한다.
- 정보보안기사와 정보보안산업기사의 진도, CourseLesson, 문제풀이 기록은
  공유하지 않는다.
- 공식 문서 원문이나 유료 교재 콘텐츠를 복제하지 않는다.
- 운영 seed 적용은 별도 승인 전에는 실행하지 않는다.
- 온톨로지 DB 테이블 도입은 additive migration으로만 설계한다.

## 검증

현재 로컬 검증 대상:

- `tests/ontology-domain.test.ts`
- `tests/security-certification-ontology.test.ts`
- `tests/curriculum-content-recommendations.test.ts`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run test:unit`
- `npm.cmd run build`

## 후속 작업

1. 공식 leaf node별 실제 학습 Content 확장
2. Question과 Concept 연결
3. RetrievalProvider에서 Concept alias 기반 검색 우선순위 적용
4. 관리자 화면에서 추천 후보 필터와 연결 이력 표시 고도화
5. 운영 DB용 additive ontology migration 설계

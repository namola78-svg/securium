# 정보보안 자격 온톨로지 Coverage 기반

이 문서는 정보보안기사·정보보안산업기사 공식 커리큘럼을 온톨로지 관점에서
점검하기 위한 로컬 도메인 기반을 설명한다.

## 확인된 사실

- 공식 커리큘럼은 `CurriculumTree`와 `CurriculumNode`로 관리된다.
- 공통 이론 콘텐츠는 `Content`로 관리되고, 과정별 제공 맥락은
  `CourseLesson`으로 분리된다.
- 현재 공식 과목/실기 개요 CourseLesson seed는 11개 연결을 제공한다.
- 온톨로지 DB 테이블은 아직 생성하지 않았다.

## 이번 로컬 기반

`lib/curriculum/security-certification-ontology.ts`는 운영 DB를 수정하지 않고
다음 정보를 계산한다.

- 공식 커리큘럼 노드 기반 Concept
- 공통 Content의 coreConcept 기반 Concept
- `CurriculumNode -> CourseLesson` edge
- `CourseLesson -> Content` edge
- `Content -> Concept` edge
- 과정별 linked node count
- 남은 ontology coverage gap

## 의도

공식 학습 콘텐츠를 대량 작성하거나 운영 DB에 적용하기 전에, 어떤 노드가
이미 연결되어 있고 어떤 노드가 비어 있는지 코드 수준에서 검증한다.

## 안전 원칙

- 동일 Content를 여러 과정에서 재사용하더라도 `courseId`가 있는 edge로
  과정 범위를 분리한다.
- 정보보안기사와 정보보안산업기사의 진도 및 CourseLesson은 공유하지 않는다.
- 공식 문서 원문이나 유료 교재 콘텐츠를 복제하지 않는다.
- 운영 seed 적용은 별도 승인 후에만 수행한다.

## 후속 작업

1. 관리자 화면에 ontology coverage gap 지표 표시
2. 공식 leaf node별 개요 Content 확장
3. Question과 Concept 연결
4. RetrievalProvider에서 Concept alias 기반 검색 우선 적용
5. 운영 DB용 additive ontology migration 설계

# 정보보안기사·정보보안산업기사 CurriculumNode별 Content 매핑 현황

이 문서는 공식 CurriculumTree의 최상위 학습 노드가 어떤 CourseLesson, Content, 문항 seed와 연결되어 있는지 로컬 코드 기준으로 정리한다. 운영 DB를 변경하지 않는다.

## 현재 매핑 요약

| 과정 | 최상위 학습 노드 | Content 연결 | 문항 연결 |
| --- | ---: | ---: | ---: |
| 정보보안기사 | 6 | 6 | 5 |
| 정보보안산업기사 | 5 | 5 | 4 |
| 합계 | 11 | 11 | 9 |

현재 최상위 `SUBJECT` / `PRACTICAL` 노드는 모두 Content에 연결되어 있다. 네트워크 보안 문항은 최상위 과목 개요가 아니라 공식 세부항목 Content에 연결되어 있어 최상위 문항 연결 수에는 포함되지 않는다. 실기 개요 노드는 두 과정이 같은 실무형 샘플 문항 묶음을 공유하되, CourseLesson과 진도는 과정별로 분리한다.

## 세부 노드 커버리지 요약

최상위 노드 기준 커버리지는 100%이며, 네트워크 보안과 시스템 보안 일부는 공식 출제기준의 `MAJOR_ITEM` / `SUB_ITEM` 단위 Content로 확장되어 있다. 현재 로컬 계측 기준은 다음과 같다.

| 범위 | 학습 노드 | Content 연결 | 문항 연결 | 커버리지 |
| --- | ---: | ---: | ---: | ---: |
| 정보보안기사 | 77 | 21 | 14 | Content 27.3% / 문항 18.2% |
| 정보보안산업기사 | 62 | 20 | 13 | Content 32.3% / 문항 21.0% |
| 합계 | 139 | 41 | 27 | Content 29.5% / 문항 19.4% |

노드 유형별 현황:

| 노드 유형 | 노드 수 | Content 연결 | 문항 연결 |
| --- | ---: | ---: | ---: |
| 과목 / SUBJECT | 9 | 9 | 9 |
| 실기 / PRACTICAL | 2 | 2 | 2 |
| 주요항목 / MAJOR_ITEM | 33 | 12 | 0 |
| 세부항목 / SUB_ITEM | 95 | 18 | 18 |

이 수치는 운영 DB 상태가 아니라 로컬 seed 코드 기준이다. 네트워크 보안은 주요항목 3개와 세부항목 9개가 기사·산업기사 양쪽 CourseLesson으로 분할되었고, 9개 세부항목 모두 최소 1개 이상의 독립 작성 샘플 문항에 연결되어 있다. 시스템 보안은 주요항목 3개가 공유 Content로 분할되었고, CourseLesson과 진도는 기사·산업기사별로 분리된다. 다음 콘텐츠 확장은 시스템 보안 세부항목 분할 또는 시스템 보안 주요항목 문항 연결이다.

## 공유 Content 정책

다음 과목과 세부 분할 Content는 정보보안기사와 정보보안산업기사가 같은 Content를 공유한다.

- 시스템 보안 과목 개요
- 네트워크 보안
- 시스템 보안 주요항목
- 애플리케이션 보안
- 정보보안 일반
- 정보보안 실무

공유 Content를 사용하더라도 CourseLesson은 과정별로 별도 생성한다. 따라서 학습 진도, 문제 시도, 오답노트, 통계는 `courseId`와 `courseLessonId` 기준으로 분리되어야 한다.

## 기사 전용 Content 정책

`정보보호관리 및 법규`는 현재 정보보안기사 전용 노드와 Content로 관리한다.

- Course: `course-ise`
- CurriculumNode: `ISE-2027-2029-01-05`
- Content: `content-official-security-cert-management-law-overview`
- Question course scope: `course-ise`

정보보안산업기사에는 같은 stable key의 최상위 노드를 만들지 않는다.

## 실기 공통 문항 정책

정보보안기사 실기와 정보보안산업기사 실기 개요 노드는 같은 실무형 샘플 문항 묶음을 공유한다.

- Content: `content-official-security-cert-practical-overview`
- Question count: 6
- Question course scope: `course-ise`, `course-isie`
- 포함 유형: OX, 단일선택형, 복수선택형, 단답형

문항 내용은 공식 기출문제나 유료 교재를 복제하지 않은 독립 작성 샘플이다. 실제 운영 반영 시에는 공식 출제기준 기반 검수와 관리자 승인 절차를 거쳐야 한다.

## 검증 코드

정적 매핑 검증은 다음 모듈과 테스트에서 수행한다.

- `lib/curriculum/security-certification-content-map.ts`
- `lib/data/security-certification-practical-questions.mjs`
- `tests/security-certification-content-map.test.ts`
- `tests/security-certification-practical-questions.test.ts`

검증 항목:

1. 공식 최상위 노드 11개가 모두 Content에 연결되어 있는지
2. 최상위 노드와 세부항목 노드의 문항 seed 연결 상태가 의도한 계층에 반영되어 있는지
3. 공유 과목은 동일 Content를 사용하면서 CourseLesson은 분리되는지
4. 정보보호관리 및 법규가 산업기사 과정에 노출되지 않는지
5. 실기 공통 문항이 기사와 산업기사 양쪽 과정에 연결되어 있는지
6. 실기 문항이 모두 개발용 샘플이자 독립 작성 샘플로 표시되는지
7. 세부 노드 커버리지 계측이 `MAJOR_ITEM` / `SUB_ITEM`의 Content·문항 연결 상태를 정확히 보고하는지

## 다음 확장 후보

1. 시스템 보안 `SUB_ITEM` 단위의 세부 본문 분할
2. 시스템 보안 주요항목 단위 문항 연결 정책 보강
3. 실기 서술형·로그분석·설정분석 고급 문항 확대
4. 관리자 화면에서 미연결 노드와 문항 미연결 노드를 별도 표시
5. 온톨로지 PoC에서 노드·Content·문항 간 개념 연결 자동 추천

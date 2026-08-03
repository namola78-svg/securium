# 정보보안 국가기술자격 CurriculumNode별 Content 매핑 현황

이 문서는 공식 CurriculumTree의 최상위 학습 노드가 어떤 CourseLesson, Content, 문항 seed와 연결되어 있는지 로컬 코드 기준으로 정리한다. 운영 DB를 변경하지 않는다.

## 현재 매핑 요약

| 과정 | 최상위 학습 노드 | Content 연결 | 문항 연결 |
| --- | ---: | ---: | ---: |
| 정보보안기사 | 6 | 6 | 5 |
| 정보보안산업기사 | 5 | 5 | 4 |
| 합계 | 11 | 11 | 9 |

현재 최상위 `SUBJECT` / `PRACTICAL` 노드는 모두 Content에 연결되어 있다. 다만 실기 개요 노드 2개는 학습 Content만 준비되어 있고, 문항 seed는 아직 연결하지 않는다.

## 공유 Content 정책

다음 과목은 기사와 산업기사가 같은 Content를 공유한다.

- 시스템 보안
- 네트워크 보안
- 애플리케이션 보안
- 정보보안 일반

공유 Content를 사용하더라도 CourseLesson은 과정별로 별도 생성한다. 따라서 학습 진도, 문제풀이, 오답노트, 통계는 courseId와 courseLessonId 기준으로 분리되어야 한다.

## 기사 전용 Content 정책

`정보보호관리 및 법규`는 현재 정보보안기사 전용 노드와 Content로 관리한다.

- Course: `course-ise`
- CurriculumNode: `ISE-2027-2029-01-05`
- Content: `content-official-security-cert-management-law-overview`
- Question course scope: `course-ise`

정보보안산업기사에는 같은 stable key의 최상위 노드를 만들지 않는다.

## 검증 코드

정적 매핑 검증은 다음 모듈과 테스트에서 수행한다.

- `lib/curriculum/security-certification-content-map.ts`
- `tests/security-certification-content-map.test.ts`

검증 항목:

1. 공식 최상위 노드 11개가 모두 Content에 연결되어 있는지
2. 공유 과목은 동일 Content를 재사용하면서 CourseLesson은 분리되는지
3. 정보보호관리 및 법규가 산업기사 과정에 노출되지 않는지
4. 실기 노드는 Content 준비 상태이되 문항 미연결 상태로 구분되는지

## 다음 확장 후보

1. 실기 노드별 서술형·로그분석·설정분석 문항 seed 추가
2. `MAJOR_ITEM`, `SUB_ITEM` 단위의 세부 본문 분할
3. 노드별 문항 커버리지 비율 산정
4. 관리자 화면에서 미연결 노드와 문항 미연결 노드를 별도 표시
5. 온톨로지 PoC에서 노드·Content·문항 간 개념 연결 자동 추천

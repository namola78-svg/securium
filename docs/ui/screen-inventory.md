# SECURIUM UI Screen Inventory

Sprint UI-2의 화면 인벤토리다. 이 문서는 구현 범위가 아니라 제품 설계 기준이며, DB, API, Repository, Seed, 배포 변경을 포함하지 않는다.

## Screen Groups

| Group | Screens | Primary User |
| --- | --- | --- |
| Student | Home, Course, Curriculum, Lesson, Theory, Question, AI Explanation, Review, AI Tutor, Analytics | 학습자 |
| Admin | Dashboard, Curriculum, Content, Question, Ontology, Coverage, AI Trace, AI Feedback, Audit, Settings | 관리자 |
| AI Explainability | Question Trace, Query Expansion, Concept Detection, Retrieval Trace, Context Viewer, Citation Viewer, Answer Viewer, Feedback, Reviewer Note | 관리자, 검수자 |
| Ontology Explorer | Tree, Concept Detail, Inspector, Relation Map, Coverage, AI Usage, Audit, History | 관리자, 콘텐츠 설계자 |

## Product Design Priority

SECURIUM의 화면 설계 우선순위는 다음과 같다.

1. Console Shell
2. 학생 학습 화면
3. Ontology Explorer
4. AI Explainability Console
5. Component Standard
6. Navigation Pattern
7. Interaction Pattern

공통 레이아웃을 먼저 확정해야 관리자, 온톨로지, AI Trace, 커버리지 화면의 사용성이 흔들리지 않는다.

Console Shell의 세부 화면 구조는 [Console Shell High-Fidelity Wireframe](./console-shell-wireframe.md)에서 관리한다.

## Student Priority

| Priority | Screen | Main Question | Primary CTA |
| ---: | --- | --- | --- |
| 1 | Home | 무엇을 시작하면 좋을까? | 무료로 학습 시작하기 |
| 2 | Course | 어떤 과정을 선택할까? | 과정 자세히 보기 |
| 3 | Curriculum | 이 과정은 어떻게 구성되어 있나? | 커리큘럼 보기 |
| 4 | Lesson | 이 개념을 이해했나? | 학습 완료 |
| 5 | Theory | 공식 기준과 이론을 어떻게 읽을까? | 관련 문제 풀기 |
| 6 | Question | 왜 맞거나 틀렸나? | 답안 제출 |
| 7 | AI Explanation | AI 설명의 근거는 무엇인가? | 근거 보기 |
| 8 | Review | 무엇을 복습해야 하나? | 복습 시작 |
| 9 | AI Tutor | 내 질문에 맞는 설명을 받을 수 있나? | AI에게 질문하기 |
| 10 | Analytics | 어느 영역이 취약한가? | 추천 학습 시작 |

## Admin Priority

| Priority | Screen | Main Question | Primary CTA |
| ---: | --- | --- | --- |
| 1 | Dashboard | 운영 상태가 정상인가? | 이슈 확인 |
| 2 | Curriculum | 공식 기준 구조가 정확한가? | 노드 검토 |
| 3 | Content | 콘텐츠가 커리큘럼과 연결됐나? | 콘텐츠 매핑 |
| 4 | Question | 문제 품질과 검수 상태는 어떤가? | 문제 검수 |
| 5 | Ontology | 개념 연결이 정확한가? | 개념 편집 |
| 6 | Coverage | 누락 영역은 어디인가? | 커버리지 액션 생성 |
| 7 | AI Trace | AI 답변은 어떻게 생성됐나? | Trace 검토 |
| 8 | AI Feedback | 사용자 피드백을 처리했나? | 피드백 검수 |
| 9 | Audit | 중요한 변경 이력이 남았나? | 감사로그 조회 |
| 10 | Settings | 운영 정책이 올바른가? | 설정 저장 |

## Implementation Boundary

- DB 변경 없음
- Seed 변경 없음
- API 변경 없음
- Repository 변경 없음
- Secret 변경 없음
- 배포 없음

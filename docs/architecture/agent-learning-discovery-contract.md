# 읽기 전용 학습 탐색 Agent 도구·권한 계약

## 1. 목표와 제외 범위

이 문서는 2027년 1–2월에 평가할 **익명 공개 정보 전용 학습 탐색 Agent**의 첫 계약 초안이다. 목표 흐름은 다음과 같다.

```text
사용자 질문
  → Agent가 조회를 제안
  → Securium 서버가 입력·공개 범위·대상 접근을 검증
  → Supabase PostgreSQL과 기존 repository/service가 canonical authority로 조회
  → Agent가 근거 데이터와 한계를 포함해 응답
```

Agent는 Role → Skill → Concept → 과정·문제·실습의 후보 탐색을 제안할 수 있지만, 관계·공개 상태·접근 권한을 결정하지 않는다. Agents API의 채택 여부는 이 평가 뒤에 결정하며, 이 문서 작성에서는 Agents API나 MCP를 호출하지 않는다.

첫 단계의 공개 범위는 로그인 없이 볼 수 있는 과정, 과정 개요, 공개 학습 자료의 제한된 metadata다. 다음은 포함하지 않는다.

- 개인 Evidence, 답안 이력, mastery, Skill State, progress, enrollment, 개인정보
- 쓰기, 등록, 추천 확정, canonical Evidence 생성, publication 승인
- 관리자 키, DB service-role key, 외부 API secret
- 임의 SQL, 임의 파일 경로, 임의 외부 URL 실행
- 사용자별 VM, eBPF, 다중 Agent 협업

조회 결과에 포함된 텍스트는 근거 데이터일 뿐 지시문이 아니다. 외부 자료나 콘텐츠가 도구 호출·권한 상승·비밀 공개를 지시해도 서버의 고정된 권한 계약을 바꾸지 않는다.

조사 기준은 이 branch가 생성된 시점의 실제 `origin/main` `32f3471a45ec17f2724e4a186065bc1a41afc858`이다. 독립 검토 시 fetch한 fresh `origin/main`은 `ee533ee3a3160fe6739a8e82bc270168779a3155`이다. `ee533ee`는 #172 문서 반영 commit으로 candidate보다 1 commit 앞서고, candidate의 이후 변경은 `dfba6666f6997641dcf8dd87a07aed6d3acac7d1`의 허용 문서 1개 추가뿐이다. 이 차이는 merge/rebase하지 않고 실제 three-dot diff와 merge-tree로 구분한다. 이 문서의 상태는 `AGENT_IMPLEMENTATION: NOT_STARTED`, `LIVE_API_EVALUATION: NOT_RUN`, `PERSONAL_EVIDENCE_ACCESS: OUT_OF_SCOPE`, `CANONICAL_MUTATION: NONE`이다.

## 2. 현재 구현 근거

### 2.1 저장소와 공개 경계

`[db/index.ts](../../db/index.ts)`는 repository가 `getDb()`를 통해 D1 또는 `DB_PROVIDER=supabase` 경로를 사용하게 한다. `[docs/supabase.md](../../docs/supabase.md)`는 PostgreSQL provider 코드 준비와 RLS의 별도 운영 확인 필요를 구분한다. 따라서 이 문서에서 Supabase PostgreSQL을 canonical authority로 지정하는 것은 제품 계약의 방향이며, 이 작업에서 원격 DB의 실제 상태나 publication을 확인했다는 뜻은 아니다. Agent는 DB에 직접 연결하지 않고 Securium 서버의 repository/service만 호출한다.

`[db/schema.ts](../../db/schema.ts)`의 `courses`, `subjects`, `topics`, `learningUnits`, `lessons`, `contents`, `courseLessons`, `contentRevisions`, `questions`는 현재 학습 데이터의 저장 모델이다. 모델이 있거나 seed가 있다는 것만으로 runtime 등록, 공개 승인, 사용 가능한 공개 자료라고 간주하지 않는다.

### 2.2 구현 상태 표

| 대상 | 실제 조회·정책 근거 | 판정 | Agent에 대한 의미 |
| --- | --- | --- | --- |
| 공개 과정 목록 | `[listPublishedCourses](../../db/repositories.ts)`와 `[listPublishedCoursesCached](../../lib/cached-catalog.ts)`가 과정·그룹을 조회한다. 목록은 과정 `active=true`, `published=true`, `deletedAt IS NULL` 및 active 그룹을 제한한다. | **실제 조회 구현 + 공개 화면** | 공개 과정 검색의 안전한 기반이다. 다만 현재 `/courses`는 전체 목록을 읽어 서버에서 필터하며 cursor pagination은 없다. |
| 공개 과정 상세 | `[getPublicCourseBySlug](../../db/repositories.ts)`와 `[과정 상세 route](<../../app/courses/[courseSlug]/page.tsx>)`가 공개 과정과 `[listCurriculum](../../db/repositories.ts)`의 subject/topic 개요를 사용한다. | **실제 조회 구현 + 공개 화면** | `slug` 기반 과정·subject·topic 개요는 첫 익명 도구에 사용할 수 있다. lesson 본문이나 사용자 progress는 이 경로에 없다. |
| 과정·curriculum path | `[listCurriculum](../../db/repositories.ts)`가 공개 과정 상세에서 subject/topic 개요를 반환한다. `[curriculum repository](../../db/curriculum-repositories.ts)`에는 tree/node 조회 함수도 있으나 이 표의 공개 route 근거와 동일한 계약은 아니다. | **기존 공개 조회 구현을 재사용할 수 있음 (subject/topic 범위); 더 깊은 outline은 공개 정책·출력 계약 필요** | 더 깊은 outline을 공개 course의 하위 전체로 가정하지 않는다. 현재 `/learn`은 로그인·enrollment이 필요하므로 progress 없는 public projection과 publication 검사가 별도로 필요하다. |
| 공개 lesson/unit metadata | `[DatabaseRetrievalProvider](../../db/ai-repositories.ts)`가 active·published lesson/unit과 공개 과정 조건으로 검색하고 `[RetrievalContext](../../lib/ai/types.ts)`의 `id`, `kind`, `title`, `excerpt`, `courseId`, `topicId`, `version`, `reviewedAt`를 만든다. | **기존 내부 구현은 있으나 공개 정책·출력 계약이 필요함** | lesson/unit metadata의 후보 근거는 있다. 그러나 같은 provider가 question explanation을 context로 만들므로 그대로 노출하면 안 된다. |
| lesson 본문·revision | `[getPublishedLessonForUser](../../db/lesson-repositories.ts)`와 `[lesson route](<../../app/learn/[courseSlug]/lessons/[lessonId]/page.tsx>)`는 로그인·과정 enrollment을 확인한다. `[getLatestPublishedRevision](../../db/content-revision-repositories.ts)`는 `revisionStatus=published`와 `isLatest=true`만 찾는다. | **기존 내부 구현은 있으나 공개 정책·출력 계약이 필요함** | 본문·revision은 첫 익명 계약에 포함하지 않는다. revision 값은 실제 resolver가 제공할 때만 반환한다. |
| 문제 검색·필터 | `[listPublicQuestions](../../db/question-repositories.ts)`는 `questions.status=PUBLISHED`와 공개 과정 조건을 적용하고 최대 50개를 반환한다. `[practice route](<../../app/practice/[courseSlug]/page.tsx>)`는 로그인과 enrollment을 요구한다. | **기존 내부 구현은 있으나 공개 정책·출력 계약이 필요함** | 공개 과정에 연결된 published 문제라는 사실과 익명으로 문제 본문·선택지를 공개할 권한은 별개다. 답·해설은 Agent 도구에 포함하지 않는다. |
| Canonical Concept | `[canonical-concept-authority](../../lib/services/canonical-concept-authority.ts)`는 `ontology_concepts`를 canonical store로 선언한다. `[canonical-concept-repositories](../../db/canonical-concept-repositories.ts)`는 exact identity/alias resolve와 active Concept 후보 검색을 구현한다. | **기존 내부 구현은 있으나 공개 정책·출력 계약이 필요함** | Concept을 찾는 내부 근거는 있다. 그러나 `loadCanonicalConceptState`가 publication/access/revision을 `UNKNOWN`으로 반환하므로 anonymous 공개 승인으로 해석할 수 없다. |
| Occupational Role / Skill | `[occupational-role-repositories](../../db/occupational-role-repositories.ts)`, `[skill-repositories](../../db/skill-repositories.ts)`, `[typed-relation-repositories](../../db/typed-relation-repositories.ts)`가 Role·Skill과 `ROLE_REQUIRES_SKILL`, `SKILL_REQUIRES_CONCEPT` 관계를 읽는다. | **실제 서버 query 구현 + 모델** | 공개 endpoint는 아니지만 Role→Skill→Concept의 canonical 조회 근거는 충분하다. `ACTIVE`는 관계 lifecycle이며 익명 publication grant와 동일하지 않다. |
| 제한된 graph query | `[skill-graph-query](../../lib/services/skill-graph-query.ts)`와 `[skill-graph-query-repository](../../db/skill-graph-query-repository.ts)`가 exact identity/alias, 1–2 hop, cursor, fan-out 제한을 검증한다. 현재 app/API의 public call site는 확인되지 않았다. | **실제 service/repository, 공개 adapter 없음** | 후속 gated 도구의 기반으로만 기록한다. 현재 익명 도구가 바로 제공된다고 선언하지 않는다. |
| Concept ↔ resource 연결 | `content_revision_concepts`, `question_concepts`, `ontology_edges` 스키마와 승인 mapping 사용처는 있다. | **데이터 모델·일부 내부 사용, 안전한 public join 없음** | `list_related_learning_resources`는 첫 공개 도구에 넣지 않는다. published resource와 승인된 mapping을 함께 검증하는 repository가 선행되어야 한다. |

현재 `/courses`의 `q` 검색은 과정명·short name·그룹명·표시용 description/audience를 문자열로 필터한다. `[course-display](../../lib/course-display.ts)`의 `courseAudienceLabel`과 `courseLearningGoals`는 화면 표시용 규칙/문구이지 canonical Role, Skill, learning outcome 관계가 아니다. 또한 과정의 `questionCount`는 `questionCourses` 연결 수를 세므로 공개 문제 수나 공개 답안의 증거로 사용하지 않는다. `status=planned` UI 선택지는 이미 `listPublishedCourses`가 published 과정만 반환하는 현재 경로와 동일하지 않으므로 Agent 공개 상태 필터로 재사용하지 않는다.

설계 문서인 `[ontology-knowledge-graph.md](../../docs/architecture/ontology-knowledge-graph.md)`와 `[ontology-domain-foundation.md](../../docs/architecture/ontology-domain-foundation.md)`는 방향·후속 작업을 설명한다. 이 문서에서 실제 route/repository가 없는 내용은 “설계 문서에만 있음”으로 취급하며 runtime registry나 publication 완료로 승격하지 않는다.

### 2.3 `public-source-transparency.md`와의 대조

현재 fresh `origin/main`의 #172 문서와 대조하면, 공개 과정 projection과 화면에서 근거가 확인되는 값은 과정 식별자(`name`, `shortName`, `code`, `slug`), Securium이 작성한 설명·난이도·기대 수준·통과 기준, 집계값, 게시/활성 조건, `updatedAt` 및 과정 URL이다. 이 값들은 공개 조회의 현재 metadata일 뿐 공식 원문 source나 revision을 뜻하지 않는다.

`curriculumTrees`와 `contentRevisions`는 source/revision 후보 모델 및 내부 조회 근거이지만 현재 공개 과정 projection에 연결되어 있지 않다. 따라서 제안 응답의 `source`, `revision`, `asOf`는 실제 public resolver가 제공할 때만 반환하고, 없으면 `NOT_AVAILABLE`로 둔다. `updatedAt`, 게시 상태, validator 성공을 최신성·검수 승인·사용 권한으로 확대하지 않는다. 공식 자료와 Securium의 독립 설명은 별도 provenance로 구분하고, link/hash 일치는 사용권이나 기관 보증을 의미하지 않는다.

저장소에는 [MCP-A core](../../lib/mcp/mcpa-core.ts)와 [MCP-A adapter](../../lib/mcp/mcpa-adapter.ts)가 존재하지만, 현재 등록된 이름은 제안한 도구가 아닌 `search_learning_content`와 `get_question`이며 local stdio가 환경 변수로 제한된다. 이는 공개 HTTP route, 익명 배포, Agents API/MCP 계정 접근 또는 동작 검증의 근거가 아니다. 현재 MCP envelope의 `sourceAuthority`·revision 값도 이 public-source 계약으로 재사용하지 않는다.

## 3. 최소 도구 계약

아래 도구는 “새 Agent adapter가 만들 수 있는 최소 계약”이다. 이름과 envelope는 **제안 필드**이며 현재 저장소에 도구 등록이 이미 되어 있다는 뜻이 아니다. 구현 근거가 있는 필드만 실제 값으로 채우고, 없는 source/revision/publication 값은 만들지 않고 `NOT_AVAILABLE`로 남긴다.

### 3.1 공통 입력·출력 규칙

모든 호출은 Securium 서버에서 다음 순서로 처리한다.

1. JSON object인지, 허용 field만 있는지, 문자열 길이·UTF-8 길이·limit·cursor 형식을 검증한다. 호출자가 보낸 `userId`, `published`, `sourceHash`, `role`은 권한 근거가 아니다.
2. `callerScope=anonymous_public`을 서버가 결정한다. 공개 과정 slug나 내부 ID는 서버 repository에서 다시 resolve한다.
3. target kind별 public predicate와 삭제·lifecycle·publication 조건을 적용한다.
4. projection allowlist로 필요한 metadata만 만들고, question answer/config/explanation, progress, private notes, admin fields를 제거한다.
5. 실제로 존재하는 source/revision만 붙인다. `observedAt`는 조회 시각일 뿐 source currentness나 검수 증명이 아니다.
6. 결과·정책 결정을 최소 감사 로그에 남긴다. 결과 텍스트나 원문 query를 기본 로그에 남기지 않는다.

검색 query의 기존 근거는 `[retrieval-provider](../../lib/ai/retrieval-provider.ts)`의 NFKC/trim 계열 정규화와 `clampRetrievalLimit` 1–12, `[DatabaseRetrievalProvider](../../db/ai-repositories.ts)`의 query UTF-8 48-byte 제한이다. 이 제한을 공통 공개 검색에도 채택하는 것은 **제안**이다. Graph service의 현재 한도는 `perHopDefault=200`, `perHopHardMax=500`, `totalNodeHardMax=1000`, `totalEdgeHardMax=2000`이며, 익명 Agent에는 이보다 작은 제품 한도를 별도로 정한다.

공통 envelope의 제안은 다음과 같다.

```text
{
  schemaVersion: "agent-learning-discovery.v1",
  status: "OK | EMPTY | NOT_FOUND | UNAVAILABLE | INVALID_INPUT",
  data: <tool-specific projection>,
  page: { limit, hasMore, nextCursor } | null,
  evidence: [
    { kind, id, title, source, revision, observedAt }
  ]
}
```

`schemaVersion`, `status`, `page`, `evidence`는 제안 envelope다. 현재 Course/Outline 경로에는 cursor가 없고, 현재 Concept resolver에는 public source/revision이 없으므로 해당 값이 공급되지 않으면 `page=null` 또는 `source/revision=NOT_AVAILABLE`로 명시한다. 빈 결과와 unavailable은 다음처럼 구분한다.

- `EMPTY`: 유효한 공개 query였지만 공개 결과가 0개. Agent는 “현재 공개 데이터에서 찾지 못했다”고 말한다.
- `NOT_FOUND`: 단일 slug/identity가 canonical resolver에서 없거나 공개 범위 밖이다. private/draft의 존재를 확인해 주지 않는다.
- `UNAVAILABLE`: 필요한 public projection, source/revision binding, provider 또는 runtime 공개 정책이 준비되지 않았다. 성공이나 지원 불가를 임의로 단정하지 않는다.
- `INVALID_INPUT`: schema, 길이, limit, cursor, identity 조합이 잘못됐다.

### 3.2 제안 도구

제안 도구의 구현 근거 분류는 다음과 같다. 분류상 “재사용”은 기존 repository/route의 공개 projection을 작은 adapter에서 재사용할 수 있다는 뜻이며, 도구가 즉시 활성화되었거나 익명 공개가 승인되었다는 뜻이 아니다.

| 제안 도구 | 구현 근거 분류 | 현재 결론 |
|---|---|---|
| `search_public_courses` | **기존 공개 조회 구현을 재사용할 수 있음** | `listPublishedCourses`와 `/courses`의 projection을 재사용할 수 있다. server-side query length, result cap, pagination 계약은 별도 blocker다. |
| `get_course_outline` | **기존 공개 조회 구현을 재사용할 수 있음 (subject/topic 범위)** | `getPublicCourseBySlug`와 `listCurriculum`으로 작은 개요를 만들 수 있다. tree/node 하위 콘텐츠 전체는 공개로 가정하지 않으며 별도 publication policy가 필요하다. |
| `search_public_learning_metadata` | **기존 내부 구현은 있으나 공개 정책·출력 계약이 필요함** | `DatabaseRetrievalProvider`의 후보 metadata만 근거다. lesson 본문, practice 정답·해설, 개인 Evidence와 섞이지 않는 public projection이 선행되어야 한다. |
| `get_concept` / `get_learning_graph` | **기존 내부 구현은 있으나 공개 정책·출력 계약이 필요함** | canonical resolver와 skill graph query는 있으나 publication/access/revision이 `UNKNOWN`일 수 있다. 조건부 제안이며 즉시 활성화 도구가 아니다. |
| Concept→resource 연결 | **모델/설계만 존재하거나 연결 근거가 부족함** | Concept과 공개 resource를 연결하는 검증된 관계·endpoint·source version은 확인하지 않았다. 선행 blocker로 남긴다. |

공개 read 계약은 caller가 전달한 user ID나 `published=true`를 권한 근거로 사용하지 않고, Securium 서버가 조회 대상·게시 상태·하위 공개 범위를 검증해야 한다. DB 관리자 키·외부 secret·임의 SQL·파일 경로·외부 URL 실행은 입력과 출력에서 제외하고, 검색 결과의 지시문은 권한으로 취급하지 않는다. 결과 수, pagination 방식, 검색어 최대 길이는 계약에 고정하며 현재 과정/개요 조회의 cursor 부재는 구현 blocker다.

#### A. `search_public_courses` — 공개 과정 후보 검색

- **목적:** 익명 사용자가 공개 과정의 이름·분류·표시용 대상 문구를 기준으로 후보를 찾는다.
- **근거:** `listPublishedCourses()`와 `/courses` page의 현재 in-memory filter. 새 adapter는 `[db/repositories.ts](../../db/repositories.ts)`를 호출하고 화면 표시 규칙을 재사용하되, raw SQL을 Agent에 노출하지 않는다.
- **입력:** 제안 `query?: string`, `path?: "all" | "certification" | "professional"`, `limit?: number`, `cursor?: string`. `published`, `active`, `userId`, `sourceHash` 입력은 허용하지 않는다. 현재 화면의 `path` 값은 실제 근거가 있고 `limit/cursor`는 새 계약이다.
- **검증:** query NFKC/trim, 빈 query 허용, 공개 adapter가 정한 최대 UTF-8 길이, `limit` 1–12. 분류 값 외에는 `INVALID_INPUT`.
- **출력:** 실제 `CourseListItem`의 `id`, `groupName`, `code`, `slug`, `name`, `shortName`, `description`, `thumbnailUrl`, `totalLevels`, `difficulty`, `updatedAt`, `subjectCount`, `topicCount`를 public projection 후보로 삼는다. `published/active`는 서버가 확인하는 policy input이지 caller가 보낸 값이 아니며, `passingScore`·`questionCount`는 학습 추천의 확정 근거가 되지 않도록 별도 노출 여부를 결정한다.
- **Pagination:** 현재 repository/page는 전체 목록과 in-memory filter를 사용해 cursor를 공급하지 않는다. 안정적인 order와 server-side cursor를 먼저 구현하지 않으면 `page=null`과 bounded 결과만 허용하고, `hasMore`를 추측하지 않는다.
- **Source/revision/as-of:** `updatedAt`은 실제 과정 metadata지만 content revision/source claim이 아니다. 현재 `source`나 canonical revision은 없다. 자동 hash·source URL·검수 상태를 생성하지 않는다.
- **공개 정책:** 서버가 course와 course group의 active/published/deleted 상태를 매 호출 확인한다. 현재 list와 detail의 predicate가 완전히 같지 않으므로 adapter에서 하나의 보수적인 public predicate를 만든다.
- **처리:** 정상 무결과는 `EMPTY`; slug 단건이 아닌 검색 결과가 없다고 `NOT_FOUND`로 바꾸지 않는다. DB/provider 오류나 public projection 미구현은 `UNAVAILABLE`.

#### B. `get_course_outline` — 공개 과정 개요 조회

- **목적:** 과정 하나의 공개 설명과 subject/topic 순서를 확인한다.
- **근거:** 공개 과정 상세 page가 `getPublicCourseBySlug()` 후 `listCurriculum(course.id)`를 호출한다.
- **입력:** 제안 `slug: string`, 선택 `include?: ["subjects", "topics"]`, `maxNodes?: number`. `courseId`를 받아도 서버에서 slug/과정 scope와 일치하는지 다시 확인한다. progress, enrollment, `userId`는 입력에서 제외한다.
- **검증:** slug trim·최대 길이, include enum, node cap. active 과정이 아니거나 scope가 어긋나면 존재 여부를 과하게 노출하지 않고 `NOT_FOUND`.
- **출력:** 실제 subject와 topic의 `id`, `courseId/subjectId`, `code`, `name`, `description`, `displayOrder`, `isSample`가 근거 field다. public projection은 `active`, `deletedAt`, 내부 timestamps를 숨길 수 있다. `isSample`는 개설 예정 표시이지 publication grant가 아니다.
- **Pagination:** 현재 `listCurriculum`은 subject/topic 전체를 반환하고 cursor가 없다. 개요가 cap을 넘으면 임의로 잘라 “전체 outline”이라고 하지 말고 `UNAVAILABLE` 또는 후속 cursor 구현으로 처리한다.
- **Source/revision/as-of:** 현재 public detail projection은 curriculum tree version/source를 제공하지 않는다. 과정 `updatedAt`만 조회 시점의 metadata로 표시 가능하며 source/revision은 `NOT_AVAILABLE`이다. `[listCurriculumTrees](../../db/curriculum-repositories.ts)`의 tree version도 공개 승인 없이 그대로 가져오지 않는다.
- **공개 정책:** 공개 과정 검증 뒤 subject/topic의 active 및 deleted 조건을 서버에서 적용한다. lesson body, course lesson extension, user progress, practice question을 이 도구로 확장하지 않는다.
- **처리:** 공개 과정은 있으나 개요가 비어 있으면 `OK` + 빈 outline과 “개요 없음”을 반환한다. 과정 자체를 찾지 못하면 `NOT_FOUND`; provider/정책 결합이 준비되지 않으면 `UNAVAILABLE`.

#### C. `search_public_learning_metadata` — 공개 학습 자료 metadata 검색

- **목적:** 공개된 lesson/learning unit의 제목·요약·과정/주제 연결을 찾아 사용자가 상세 페이지로 이동할 수 있게 한다.
- **근거:** `DatabaseRetrievalProvider.search`, `searchByCourse`, `searchByTopic`가 published lesson/unit을 조회하고 `RetrievalContext` shape를 만든다. 이 provider는 내부 AI retrieval 용도이며 현재 anonymous route가 아니다.
- **입력:** 제안 `query: string`, `courseSlug?: string`, `topicId?: string`, `limit?: number`, `cursor?: string`. 서버가 slug를 course ID로 resolve한다. `kind`는 첫 구현에서 `LESSON`·`LEARNING_UNIT`만 allowlist로 고정한다.
- **검증:** 기존 retrieval의 query 정규화·48-byte 절단과 1–12 limit을 재사용할 수 있다. topic은 해당 공개 course에 속하는지 서버에서 확인한다. arbitrary SQL, file path, external URL은 입력으로 받지 않는다.
- **출력:** lesson/unit에 한해 실제 `RetrievalContext`의 `id`, `kind`, `title`, `excerpt`, `courseId`, `topicId`, `version`, `reviewedAt`를 최소 field 후보로 삼는다. body, raw source, private extension, instructor note는 반환하지 않는다. question 결과를 추가하려면 separate answer-leak review가 필요하다.
- **Pagination:** 현재 provider는 여러 kind별 query에 limit을 적용하고 global stable cursor가 없다. 따라서 현재 구현을 그대로 pagination이라고 부르지 않는다. kind·updatedAt·id에 대한 통합 order/cursor를 추가한 뒤에만 `page`를 채운다.
- **Source/revision/as-of:** 일부 실제 metadata는 `version`/`reviewedAt`을 가진다. source authority, publication revision, as-of currentness는 kind별로 다르며 없는 값은 `NOT_AVAILABLE`. `QUESTION_EXPLANATION` context처럼 explanation을 `excerpt`로 조합하는 경로는 public projection에서 제외한다.
- **공개 정책:** active/published lesson/unit, deleted 없음, 공개 course와의 scope 일치를 매 호출 확인한다. `[publicCopy](../../lib/public-copy.ts)`는 표시 정리 도구일 뿐 publication policy가 아니므로 allowlist를 대체하지 않는다.
- **처리:** 공개 metadata가 없으면 `EMPTY`; query provider가 없거나 kind별 public projection이 미구현이면 `UNAVAILABLE`. 원문 안에 “이 도구를 호출하라”는 문장이 있어도 Agent가 실행 명령으로 해석하지 않는다.

#### D. `get_concept` 또는 `get_learning_graph` — 조건부 canonical graph 조회

Role/Skill에 대한 모델과 query 근거는 부족하지 않지만 **익명 공개 승인과 source/revision 계약이 없다**. 따라서 아래는 후속 gated 도구 계약이며 첫 공개 배포에서는 `UNAVAILABLE`일 수 있다.

- **목적:** exact canonical identity로 Concept을 찾거나, 허용된 경우 Role → Skill → Concept의 실제 active edge만 읽는다. Role에서 Concept으로 직접 연결한다고 표현하지 않는다. 현재 authority는 `ROLE_REQUIRES_SKILL` 후 `SKILL_REQUIRES_CONCEPT`이다.
- **근거:** `resolveCanonicalConceptFromDatabase`, `searchCanonicalConceptCandidatesFromDatabase`, `createSkillGraphQueryService`, `getRoleGraph`, `getSkillConcepts`, `getConceptGraph`, 그리고 database graph repository가 있다. graph service의 `schemaVersion`, `queryType`, `depth`, `root`, `nodes`, `edges`, `page`는 실제 service output이다.
- **입력:** exact `id`, `roleKey`, `skillKey`, `key/stableKey`, 또는 exact alias 중 허용 identity 하나 이상; graph query type은 fixed allowlist; `limit`/`cursor`는 기존 validator를 통과해야 한다. caller의 역할·user ID·publication flag·source hash는 받지 않는다.
- **검증:** graph service가 identity conflict, ambiguous alias, depth 1–2, cursor, per-hop/fan-out limit을 검사한다. public adapter는 그 전에 대상 node와 edge에 별도 anonymous public predicate를 적용한다. `ACTIVE` lifecycle과 public publication grant가 다르면 fail closed한다.
- **출력:** 실제 graph node의 type/id/canonical key/label/aliases, edge의 id/type/source/target/relationVersion, page를 최소 구조로 사용한다. 현재 `sourceType`은 provenance 후보일 뿐 source document·revision·as-of가 아니다. public policy가 값 제공을 허용하지 않으면 숨긴다.
- **Source/revision/as-of:** current graph output에는 relationVersion/sourceType은 있지만 공개 source claim, content revision, currentness는 없다. Concept repository의 public state도 현재 `publication/access/revision=UNKNOWN` 경로가 있다. 따라서 graph만으로 공개 검수·과정 연결·학습 성과를 만들지 않는다.
- **처리:** unknown/ambiguous identity는 `NOT_FOUND` 또는 `INVALID_INPUT`으로 구분하고 후보를 과도하게 내보내지 않는다. relation fan-out 초과는 `UNAVAILABLE`에 가까운 bounded failure로 기록하며 자동으로 limit을 늘리지 않는다. 공개 policy 미구현은 `UNAVAILABLE`.

`list_related_learning_resources`는 이 단계의 callable 도구로 채택하지 않는다. Concept mapping과 published resource를 동시에 검증하는 repository가 없고, `content_revision_concepts`·`question_concepts`의 mapping status와 resource publication/revision을 하나의 익명 projection으로 묶는 경로가 확인되지 않았다. 선행 구현 후 별도 계약으로 추가한다.

### 3.3 감사 기록 최소 항목

각 서버 호출은 다음 metadata만 최소 보존한다. 익명 호출에는 user ID를 기록하지 않는다.

- server-generated `requestId`, tool name/version, caller scope `anonymous_public`
- 검증된 target kind와 canonical target ID 또는 식별자 fingerprint
- policy decision `ALLOW_PUBLIC_READ`, `DENY`, `UNAVAILABLE` 및 reason code
- provider/route 식별자, limit/cursor fingerprint, result count, latency, error code
- 실제 source/revision/as-of가 반환된 경우의 presence와 opaque ID

원문 query, lesson body, answer, credential, service key, 개인 절대 경로를 감사 metadata에 넣지 않는다. 감사 로그 자체는 승인·Evidence 생성이 아니며, 도구 결과도 canonical registry를 변경하지 않는다.

## 4. 요청 처리와 권한 검사 흐름

### 4.1 서버 권한 흐름

```text
Agent 제안
  → 도구 schema/limit/cursor 검증
  → 서버가 callerScope와 target을 결정
  → canonical repository/service 조회
  → 공개 predicate + resource kind allowlist
  → 민감 field redaction
  → source/revision이 실제로 있을 때만 부착
  → 감사 metadata 기록
  → 근거 데이터/빈 결과/한계를 반환
```

재사용할 것은 `getPublicCourseBySlug`, `listPublishedCourses`, `listCurriculum`, published lesson/unit 조건, `getLatestPublishedRevision`, Concept resolver, Skill Graph query validator다. 새로 필요한 것은 다음과 같다.

- anonymous public projection과 kind별 field allowlist
- Course/Group/Subject/Topic/Resource의 일관된 public predicate
- 현재 없는 stable pagination과 tool envelope
- source/revision/as-of가 실제로 공급되는지 확인하는 binding
- Concept/Role/Skill/edge의 public publication policy
- 호출 감사 adapter와 prompt-injection을 데이터로만 취급하는 실행 boundary

기존 `DatabaseRetrievalProvider`의 published 조건만으로 public Agent 권한이 완성되지 않는다. 특히 question context는 explanation과 wrong-answer explanation을 retrieval context로 만들 수 있으므로 public metadata adapter에서 차단해야 한다. 공개 문제를 훗날 추가하더라도 question prompt/choice와 answer/explanation/config는 서로 다른 계약으로 분리한다.

### 4.2 MCP·Agents API·Securium의 책임

| 구성요소 | 책임 | 하지 않는 일 |
| --- | --- | --- |
| MCP | 도구 이름, 입력/출력 연결, 호출 결과 전달 | DB 직접 접근, publication 승인, caller가 보낸 `published` 신뢰 |
| Agents API | 평가 단계의 session/execution 관리와 Agent의 제안 생성 | canonical 권한 판정, Supabase key 보관, Evidence 생성 |
| Securium server | identity resolve, 공개 범위, resource scope, redaction, rate/limit, 감사, 오류 의미 | Agent에게 관리자 키나 arbitrary executor 제공 |
| Supabase PostgreSQL 및 기존 repository/service | canonical 데이터와 lifecycle/relation authority | Agent prompt가 요구하는 관계를 즉석에서 생성 |

읽기 전용 공개 조회마다 사용자 승인 화면을 요구하지 않는다. 대신 모든 호출을 서버의 공개 read policy 아래에 둔다. 이후 쓰기, 로그인 사용자별 데이터, progress/mastery/Evidence 접근은 별도의 계약과 별도 승인 흐름으로 정의한다.

## 5. 시나리오 대조: “보안 개발자가 되려면 무엇을 공부해야 해?”

### 5.1 현재 저장소 근거로 가능한 순서

1. Agent는 질문을 “직무 기반 학습 후보를 공개 자료에서 찾아 달라”는 의도로 설명하고, 확정된 개인 학습 경로가 아님을 표시한다.
2. `search_public_courses`로 실제 공개 course 후보를 검색한다. `/courses`가 사용하는 과정명·그룹·표시용 audience 문자열은 검색할 수 있지만, `courseAudienceLabel`이 `개발자·보안 진단 담당자`라고 표시한다고 해서 canonical Role “보안 개발자”와 일치한다고 결론 내리지 않는다.
3. 후보 과정마다 `get_course_outline`을 호출해 실제 subject/topic 순서와 설명으로 연결한다. 이 단계는 공개 과정 상세 page와 같은 근거를 가질 수 있다.
4. public metadata adapter가 준비된 경우에만 `search_public_learning_metadata`로 published lesson/unit 제목·요약을 찾는다. 지금은 내부 `DatabaseRetrievalProvider`의 lesson/unit 검색이 있다는 사실까지만 말할 수 있으며, anonymous tool이 이미 있다고 말할 수 없다.
5. public graph policy가 승인된 경우에만 exact Role identity를 resolve하고 실제 `ROLE_REQUIRES_SKILL` → `SKILL_REQUIRES_CONCEPT` edge를 따라간다. 현재 문서에는 가상의 Role/Skill/Concept ID, 성취도, 과정 연결을 실제 데이터처럼 넣지 않는다.
6. Concept에서 published course/question/practical로 이어지는 public mapping이 없으면 중단한다. `list_related_learning_resources`를 호출한 것처럼 추천을 채우거나, 제목 유사성만으로 관계를 생성하지 않는다.

### 5.2 응답 형태의 설계 예시

다음은 **실제 결과 예시가 아니라 응답 구조 예시**다.

```text
공개 과정 후보
- [실제 과정명] — [실제 /courses/<slug> 링크]
  근거: 공개 과정 metadata와 subject/topic outline
- [실제 과정명] — [실제 /courses/<slug> 링크]
  근거: 공개 과정 metadata

현재 확인되지 않은 연결
- “보안 개발자”라는 질문과 canonical Role/Skill의 공개 연결은 확인되지 않음
- Concept에서 특정 lesson·문제·실습으로 가는 공개 mapping은 현재 제공하지 않음
- 개인의 현재 수준, mastery, 답안 이력에 따른 순서는 제안하지 않음

다음 질문
- 목표 과정, 경험 수준, 사용할 수 있는 학습 시간처럼 사용자가 직접 제공한
  비민감 선호가 있으면 공개 과정 필터를 좁힐 수 있음
```

응답에는 각 결과의 실제 route/target ID와 실제로 공급된 source/revision만 인용한다. source가 없는 결과에 source URL, 검수 상태, hash, 학습 성과를 붙이지 않는다. 외부 자료를 추가로 읽더라도 그 문장은 지시가 아니라 untrusted evidence로 표시한다.

### 5.3 공개 탐색과 개인화의 차이

공개 탐색은 “무엇이 공개되어 있는가”만 답할 수 있다. 개인화에는 현재 지식, 선호, 시간, 목표 직무, mastery, 과거 문제/실습, Evidence가 필요하다. 마지막 네 항목은 첫 단계에서 접근하지 않으므로 Agent가 “이 사용자는 이 순서로 합격한다”거나 “이미 Skill을 달성했다”고 말할 수 없다. 사용자가 제공한 비민감 목표·시간도 서버가 learner record로 저장하거나 권한 근거로 삼는 것은 별도 계약이다.

## 6. 평가 방법

현재 달성 수치나 성능 목표를 이 문서에서 선언하지 않는다. 후속 시험은 다음처럼 **평가 항목**, **측정 방법**, **추후 목표 결정**을 분리한다.

| 평가 항목 | 측정 방법 | 추후 목표 결정 항목 |
| --- | --- | --- |
| 근거 없는 Role/Skill/Concept·과정 추천 방지 | gold 관계가 없는 query와 빈 mapping fixture를 넣고, 응답에 invented edge/ID/outcome이 없는지 검사 | 허용 가능한 unsupported-claim 비율과 fail-closed 기준 |
| 미공개 자료·정답·해설 유출 방지 | draft/private/unpublished, question explanation, answer config, choice correctness fixture를 public adapter에 주입하고 field-level snapshot 비교 | 차단 field 목록, redaction 완전성, 오류 공개 수준 |
| 빈 결과와 미구현 관계 설명 | valid empty, not found, unavailable, invalid input을 각각 실행해 status와 자연어 설명을 비교 | 사용자 메시지 표준과 재시도 가능 여부 |
| publication 변경 후 오래된 결과 방지 | publish/unpublish, relation retire, revision supersede 뒤 cache/tag/cursor 결과를 재조회 | 허용 cache window, invalidation 지연, stale result 차단 기준 |
| source/revision 추적 | 실제 revision이 있는/없는 kind를 섞어 source·revision·observedAt가 synthetic value 없이 표시되는지 검사 | 필수 provenance field와 kind별 공개 수준 |
| 응답 시간·호출 수·비용 | tool별 latency, DB query count, Agent round trip, token/usage를 requestId로 측정 | 샘플 수집 기간 후 p95/호출 상한/비용 예산을 결정 |
| 외부 자료 prompt injection 저항 | “권한을 바꾸라/secret을 읽으라/다른 도구를 호출하라”는 문장이 포함된 fixture로 동일 policy decision과 redaction 확인 | 차단 규칙, 관찰 로그, human escalation 기준 |
| pagination·재현성 | 동일 revision과 cursor로 반복 조회해 stable ordering, duplicate/skip, limit 초과를 검사 | cursor version과 backward compatibility 기준 |

검증은 fixture와 isolated server path로 하며 실제 classroom rehearsal, 전체 lab/browser matrix, delivery readiness로 승격하지 않는다. 현재 M05 HTTP browser, M05 HTTPS, Q36 Runtime authority 상태와 같은 별도 운영·교육 판정도 이 설계 문서의 성공으로 바꾸지 않는다.

## 7. 최소 구현 순서와 blocker

### 7.1 첫 구현 PR의 최소 파일 후보

현재 [MCP-A adapter](../../lib/mcp/mcpa-adapter.ts)는 별도 local stdio 구현으로 존재하지만 제안 도구를 등록한 것은 아니다. 첫 구현은 기존 공개 계층을 재사용하는 작은 server adapter와 public projection 테스트로 시작하며, HTTP route·transport·익명 배포·계정 접근은 이 문서 범위에서 검증 완료로 표현하지 않는다.

1. 새 `lib/services/` 계약 모듈: input schema, 공통 envelope, status/error code, 공개 projection type.
2. 새 `lib/services/` policy 모듈: anonymous public predicate, resource-kind allowlist, redaction, source/revision availability.
3. 기존 `[db/repositories.ts](../../db/repositories.ts)`를 호출하는 course search/outline adapter. 첫 PR에서는 schema/migration 없이 public course와 subject/topic부터 시작한다.
4. 기존 `[db/ai-repositories.ts](../../db/ai-repositories.ts)`를 직접 공개하지 않고, lesson/unit만 허용하는 metadata adapter. question explanation과 private extension은 제외한다.
5. 서버 adapter가 있는 실제 API/MCP owner에 read-only registration을 추가한다. 현재 call site가 없으므로 owner와 route는 구현 시 확인한다.
6. 각 public predicate, redaction, empty/not-found/unavailable, prompt-injection fixture와 request audit의 단위 테스트를 추가한다.

### 7.2 선행 blocker와 후속 순서

| 순서 | 작업 | blocker / 완료 조건 |
| --- | --- | --- |
| 1 | 공개 과정 search/outline adapter | stable pagination이 없으므로 초기에는 bounded result 또는 cursor 구현이 필요하다. 과정 group predicate도 통일해야 한다. |
| 2 | lesson/unit metadata projection | 내부 retrieval의 kind별 source/revision 계약과 question explanation 차단을 확정해야 한다. |
| 3 | audit와 stale policy | cache/tag, revision supersession, relation retire 후 오래된 결과를 차단하는 운영 규칙이 필요하다. |
| 4 | Concept public read | `loadCanonicalConceptState`의 publication/access/revision `UNKNOWN`을 실제 public policy와 연결해야 한다. |
| 5 | Role/Skill graph public read | active lifecycle·review evidence·별도 publication authority를 anonymous read predicate로 확정하고, 현재 service 한도보다 작은 Agent limit을 결정해야 한다. |
| 6 | Concept → course/question/practical resource mapping | 승인된 mapping, published resource, course scope, revision을 한 번에 확인하는 repository가 필요하다. 이 전에는 `list_related_learning_resources`를 만들지 않는다. |
| 7 | MCP/Agents API 평가 | 도구 contract와 isolated server 검증이 끝난 뒤에만 session/execution 비용·호출 수를 측정한다. Agents API 채택은 평가 결과의 결정 사항이다. |

첫 PR은 기존 course/repository 경로로 구현 가능한 범위에서 출발한다. Role/Skill seed, ontology mapping, schema/migration, canonical registry, source-claims, workflow, dependency를 이 문서 작업에서 변경하지 않는다.

## 8. 상태와 보존 경계

- `AGENT_IMPLEMENTATION`: `NOT_STARTED`
- `LIVE_API_EVALUATION`: `NOT_RUN`
- `PERSONAL_EVIDENCE_ACCESS`: `OUT_OF_SCOPE`
- `CANONICAL_MUTATION`: `NONE`
- Supabase PostgreSQL runtime/publication/RLS: 저장소 문서와 provider 코드 근거만 기록했으며 이 작업에서 원격 DB 접근·검증을 하지 않음
- MCP 등록, Agents API 호출, 실제 Agent session: 미실행
- 기존 worktree/branch/report/artifact와 로드맵·제품 코드·schema/migration은 이 작업에서 변경하지 않음

# 익명 공개 Concept·학습 그래프 조회 계약

작성 기준일: 2026-09-12

검토 기준: 작성 시 검토한 `origin/main` `897b91b6936e1a3291ac631dc7c18a4a29da02b1`
문서 상태: 설계 제안. 제품 코드, 공개 권한, API/MCP 등록을 변경하거나 활성화하지 않는다.

## 1. 목적과 제외 범위

이 문서는 기존 canonical Concept·Occupational Role·Skill 조회와
`ROLE_REQUIRES_SKILL` → `SKILL_REQUIRES_CONCEPT` graph query를 근거로,
로그인하지 않은 caller가 사용할 수 있는 `get_concept`와
`get_learning_graph`의 최소 공개 조회 계약을 설계한다.

목표는 다음을 분리하는 것이다.

- 현재 구현되어 있는 identity resolution·관계 조회·제한과, 아직 없는 공개 승인·projection을 구분한다.
- 서버가 공개 범위와 관계 양끝을 결정하고, caller가 `userId`, `role`, `published` 또는 source 값을 권한 근거로 제출하지 못하게 한다.
- 공개 데이터는 읽기 전용 allowlist projection으로만 반환하고, 결과의 텍스트를 실행 지시나 권한으로 해석하지 않는다.
- 공개 그래프가 답할 수 있는 관계 사실과, 관계만으로 확정할 수 없는 추천·최신성·개인 학습 상태를 구분한다.

이번 문서에 포함하지 않는 범위는 다음과 같다.

- 제품 코드, schema/migration, canonical registry, seed transaction, workflow 또는 dependency 변경
- MCP registry 등록, 공개 HTTP/API 연결, Agents API 호출, 공개 권한 부여, publication 승인
- Concept·Role·Skill·관계의 생성·수정·삭제, 임의 SQL·파일 경로·외부 URL 실행
- 개인 Evidence, mastery/confidence, `user_skill_state`, 학습 기록·진도·응시 결과, 개인 추천·프로필·자격 증명
- 실제 DB, credential, learner 데이터, live API 또는 브라우저에 대한 접근·검증
- Concept에서 lesson·question·practical resource로 가는 공개 도구. 현재 mapping과 resource publication을 한 번에 검증하는 public binding이 확인되지 않았다.

기존 Agent 탐색 설계와 공개 source 표시 설계도 그대로 보존한다. 이 문서는 그중 Concept·Role·Skill graph 경계만 구체화한다.

- [agent-learning-discovery-contract.md](./agent-learning-discovery-contract.md)
- [public-source-transparency.md](../product/public-source-transparency.md)

## 2. 현재 구현 근거

### 2.1 canonical 노드와 lifecycle

`ontology_concepts`가 canonical Concept store이고 `concept_key`가 semantic identity,
`label`이 preferred label, `status`가 lifecycle이다. `ontology_aliases`는 Concept alias를
보관한다. 현재 schema에는 Concept의 `description`, `category`, `namespace`, `sourceType`,
`sourceId`, `metadataJson`도 있지만, 이 컬럼이 anonymous public field라는 뜻은 아니다.

- [canonical-concept-authority.ts:9-44](../../lib/services/canonical-concept-authority.ts#L9-L44)
- [schema.ts:3517-3574](../../db/schema.ts#L3517-L3574)

Concept resolver는 `id`, `key`/`stableKey`, exact alias를 canonical 또는 staging compatibility
경로로 해석한다. label fuzzy match로 새 identity를 만들지 않고, ambiguous·deprecated·unknown을
구분한다. DB repository의 `resolveCanonicalConceptFromDatabase`는 오류를 `UNKNOWN`으로
닫으며, `searchCanonicalConceptCandidatesFromDatabase`는 `ACTIVE` Concept의 key/label/alias를
검색한다.

- [canonical-concept-authority.ts:89-190](../../lib/services/canonical-concept-authority.ts#L89-L190)
- [canonical-concept-repositories.ts:20-66](../../db/canonical-concept-repositories.ts#L20-L66)
- [canonical-concept-repositories.ts:68-109](../../db/canonical-concept-repositories.ts#L68-L109)

Occupational Role과 Skill은 Concept와 별도 canonical entity다. RBAC `roles`와 Occupational
Role은 구분되며, Role key와 Skill key는 `role:<namespace>:<identity>`,
`skill:<namespace>:<identity>` 형식의 exact identity를 사용한다. Role·Skill의 lifecycle은
`DRAFT | ACTIVE | RETIRED`이고, active row에는 reviewed-by/reviewed-at/review evidence의
schema 조건이 있다.

- [occupational-role-authority.ts:3-31](../../lib/services/occupational-role-authority.ts#L3-L31)
- [skill-authority.ts:1-22](../../lib/services/skill-authority.ts#L1-L22)
- [schema.ts:43-135](../../db/schema.ts#L43-L135)

그러나 lifecycle 및 review 조건은 anonymous publication grant와 다른 개념이다. 현재
public visibility, anonymous access, 공개 source/revision 승인 상태를 이 세 노드에 대해
공통으로 판정하는 resolver는 확인하지 않았다.

### 2.2 실제 조회와 관계 방향

| 노드/관계 | 실제 모델·조회 위치 | 반환 가능한 필드 후보 | 현재 접근 조건 | 공개 허용 근거 | 근거가 없거나 추가 결정이 필요한 부분 |
| --- | --- | --- | --- | --- | --- |
| Concept | `ontology_concepts`, `ontology_aliases`; `resolveCanonicalConceptFromDatabase`, `searchCanonicalConceptCandidatesFromDatabase` | `id`, `conceptKey`, `label`, exact alias; schema에는 `description`, `category`, `namespace`, `sourceType`, `sourceId`도 존재 | identity/alias resolve; 검색은 `status=ACTIVE`; detail state도 active row만 찾음 | canonical identity와 active lifecycle은 내부 조회 근거 | anonymous publication/access/revision은 `UNKNOWN`; description·category·alias별 공개 허용과 source mapping을 결정해야 함 |
| Occupational Role | `occupational_roles`, `occupational_role_aliases`; `resolveOccupationalRoleFromDatabase`, `listActiveOccupationalRoles` | `id`, `roleKey`, `label`, `description`, alias; 내부 provenance 후보 | exact id/key/alias; 목록은 `status=ACTIVE` | canonical Role 모델과 exact resolver 존재 | active·review evidence를 공개 승인으로 해석할 수 없음. RBAC role, 개인 role, 공개 display policy가 없음 |
| Skill | `skills`, `skill_aliases`; `resolveSkillFromDatabase`, `listActiveSkills` | `id`, `skillKey`, `label`, `description`, alias; `sourceType/sourceId/provenanceJson`는 내부 후보 | exact id/key/alias; graph resolver는 `ACTIVE`만 통과 | canonical Skill 모델과 exact resolver 존재 | anonymous publication/access 및 raw provenance의 공개 허용이 없음 |
| Role → Skill | `role_skill_relations`; `skillsForRole`, `readRoleToSkills` | edge id/type/relationVersion/source·target; relation sourceType는 내부 후보 | relation `ACTIVE`, target Skill `ACTIVE`; canonical type은 `ROLE_REQUIRES_SKILL` | directed typed relation, endpoint FK, unique endpoint/type, positive version | relation 자체 public approval·usage policy가 없음. `ACTIVE`와 review evidence만으로 공개 허용하지 않음 |
| Skill → Concept | `skill_concept_relations`; `conceptsForSkill`, `readSkillToConcepts` | edge id/type/relationVersion/source·target; relation sourceType는 내부 후보 | relation `ACTIVE`, target Concept `ACTIVE`; canonical type은 `SKILL_REQUIRES_CONCEPT` | directed typed relation, endpoint FK, unique endpoint/type, positive version | relation 자체 public approval·usage policy가 없음. private Concept를 건너뛰는 direct edge 생성 금지 |
| 역방향 조회 | 동일 relation store; `rolesForSkill`, `skillsForConcept`, graph service의 reverse hop | canonical edge는 원래 방향으로 유지하고 view만 역방향 | source/target endpoint가 현재 active인지 확인 | 명시된 query 방향 구현 | 역방향 view가 새 relation을 만들지 않는다는 public contract 필요 |
| Concept → learning resource | `content_revision_concepts`, `question_concepts`, `ontology_edges` 등의 schema와 내부 사용 | mapping/resource/revision 후보 | 이 표에서 하나의 public query로 묶인 resolver 없음 | 확인된 anonymous binding 없음 | 이번 도구 범위에서 제외. mapping status, resource publication, revision, source를 함께 검증하는 provider 선행 필요 |

typed relation authority는 방향을 `ROLE -> SKILL -> CONCEPT`, inverse를 저장하지 않음,
관계 provenance 필수, lifecycle `DRAFT | ACTIVE | RETIRED`, learner state 미구현으로
명시한다. relation repository의 기본 read status는 `ACTIVE`지만, writer가 만드는 것은
항상 unpublished `DRAFT`다.

- [typed-relation-authority.ts:3-19](../../lib/services/typed-relation-authority.ts#L3-L19)
- [typed-relation-repositories.ts:20-56](../../db/typed-relation-repositories.ts#L20-L56)
- [typed-relation-repositories.ts:59-95](../../db/typed-relation-repositories.ts#L59-L95)
- [schema.ts:158-190](../../db/schema.ts#L158-L190)
- [schema.ts:3576-3611](../../db/schema.ts#L3576-L3611)

### 2.3 공개·source·revision·API 근거

기존 knowledge query facade에는 public projection과 eligibility 개념이 있으나, 현재 DB
authority가 Concept state를 `publication=UNKNOWN`, `access=UNKNOWN`,
`provenanceSourceType=UNKNOWN`, `revision=UNKNOWN`으로 반환하는 경로가 있다. 따라서
`ACTIVE` Concept을 찾는 내부 resolver나 `getPublicEntity` shape가 anonymous 공개 승인을
의미하지 않는다. public projection은 publication/access/mapping/source/revision 조건을
모두 통과해야 만들어지도록 되어 있지만, 현재 Concept state는 그 조건을 충족시키지 못한다.

- [knowledge-query-service.ts:1-19](../../lib/services/knowledge-query-service.ts#L1-L19)
- [server-knowledge-query-service.ts:65-143](../../lib/services/server-knowledge-query-service.ts#L65-L143)
- [server-knowledge-query-service.ts:158-195](../../lib/services/server-knowledge-query-service.ts#L158-L195)
- [server-knowledge-query-service.ts:266-277](../../lib/services/server-knowledge-query-service.ts#L266-L277)

현재 `server-knowledge-query-service`와 canonical resolver에는 `get_concept`라는 anonymous
HTTP route가 없고, graph service에도 app/API public call site가 확인되지 않았다. 관리자
ontology 상태 변경 route는 `requireOntologyAdministrator`, same-origin, rate limit을
요구하는 쓰기 경로이며 public read 근거가 아니다.

- [admin ontology review-status route](../../app/api/admin/ontology/review-status/route.ts#L26-L41)
- [admin ontology review-status route](../../app/api/admin/ontology/review-status/route.ts#L43-L69)

현재 MCP-A도 `search_learning_content`, `get_question`만 등록하고, published Course/Lesson/
Question을 대상으로 하는 local stdio adapter가 `SECURIUM_MCPA_ENABLE=1`일 때만 실행된다.
이는 `get_concept` 또는 `get_learning_graph`의 registry, public HTTP transport, anonymous
deployment, Agents API 접근의 근거가 아니다.

- [mcpa-core.ts:3-14](../../lib/mcp/mcpa-core.ts#L3-L14)
- [mcpa-core.ts:259-327](../../lib/mcp/mcpa-core.ts#L259-L327)
- [mcpa-adapter.ts:37-107](../../lib/mcp/mcpa-adapter.ts#L37-L107)

source taxonomy에는 authority·usage·currentness·source identity 같은 분류가 정의되어
있지만, Concept/Role/Skill resolver가 이를 anonymous public snapshot으로 공급한다는 연결은
확인되지 않았다. graph의 `sourceType` 또는 relation `relationVersion`은 raw provenance
후보와 relation schema version일 뿐, 기관 보증·사용권·공식 최신성·공개 source citation이
아니다.

- [source-taxonomy.ts:1-76](../../lib/provenance/source-taxonomy.ts#L1-L76)
- [public-source-transparency.md:20-25](../product/public-source-transparency.md#L20-L25)
- [public-source-transparency.md:56-85](../product/public-source-transparency.md#L56-L85)

## 3. 공통 anonymous public 원칙

### 3.1 서버가 결정하는 공개 predicate

caller scope는 요청이 anonymous인 경우 항상 서버가 `anonymous_public`으로 결정한다.
다음 입력은 받지 않거나 무시한다.

- `userId`, caller role, organization, enrollment, `published`, `active`, `access`, source hash
- arbitrary SQL, path, URL, tool name, relation type를 확장하는 free-form selector
- canonical node·edge·mapping을 쓰거나 publication을 승인하는 명령

후속 구현의 public predicate는 최소한 다음 단계의 별도 검증을 모두 통과해야 한다.

1. canonical identity가 정확히 하나로 resolve된다.
2. node lifecycle이 허용된 상태다. 기본 제안은 `ACTIVE`뿐이며 `DRAFT`, `RETIRED`, `ARCHIVED`, `DEPRECATED`, `SUPERSEDED`, `UNKNOWN`은 public node로 반환하지 않는다.
3. 별도 public publication/access read model이 `PUBLISHED`/`PUBLIC`을 명시한다.
4. node projection에 필요한 identity와 label이 완전하다.
5. source/revision을 public field로 표시하는 경우, 동일 snapshot에서 실제로 resolver가 공급하고 공개하도록 승인한 값이다.

관계는 다음을 모두 통과해야 한다.

- relation lifecycle `ACTIVE`
- relation 자체의 public publication/access 허용
- 관계 양끝 node의 public predicate 통과
- canonical type·방향·version·endpoint 일치
- public projection에 필요한 edge fields의 완전성

`ACTIVE`, `reviewedBy`, `reviewedAt`, `reviewEvidenceJson`, `sourceType`, canonical이라는
단일 사실은 위 public predicate를 대체하지 않는다. 특히 relation의 active review schema
조건은 내부 governance 조건이지 anonymous 공개 승인 그 자체가 아니다. 이 public state와
공개 책임 주체가 아직 확정되지 않았으므로 두 도구의 실제 활성화는 blocker다.

### 3.2 공통 응답과 오류

제안 envelope는 다음과 같다. 이름과 버전은 구현 시 고정하며, 이 문서 작성만으로 registry가
생기지는 않는다.

```json
{
  "schemaVersion": "public-learning-graph.v1",
  "status": "OK | EMPTY | NOT_FOUND | UNAVAILABLE | INVALID_INPUT | LIMIT_EXCEEDED",
  "data": {},
  "page": null
}
```

- `OK`: 요청한 public projection 또는 public graph 결과가 있다.
- `EMPTY`: public root는 확인되었지만 허용된 public edge가 없다. 전체 hidden count를 함께 주지 않는다.
- `NOT_FOUND`: 미존재, 비공개, retired/deprecated/ambiguous identity, 불완전 public predicate를 anonymous caller에게 같은 방식으로 처리한다. private 여부나 후보 ID를 확인시켜 주지 않는다.
- `UNAVAILABLE`: public authority/provider 또는 승인된 public projection을 일시적으로 사용할 수 없다. 내부 stack, SQL, DB 이름, raw error를 반환하지 않는다.
- `INVALID_INPUT`: schema, 식별자 조합, 형식, 길이, cursor, enum이 잘못됐다.
- `LIMIT_EXCEEDED`: caller가 허용 범위를 넘겼거나 query provider가 정한 bounded cost/response 조건을 충족할 수 없다. 자동으로 limit을 늘려 재시도하지 않는다.

오류 response에는 내부 SQL, table/column, stack, raw canonical row, alias candidate ID/count,
source JSON, reviewer ID, service key, query text를 넣지 않는다. 서버 로그도 이 public
projection과 같은 allowlist·bounded metadata만 사용한다.

## 4. `get_concept` 계약

### 4.1 목적과 식별자

`get_concept`는 공개가 승인된 canonical Concept 하나의 정의형 metadata와, 별도 graph
predicate를 통과한 관계 요약만 반환한다. 학습 resource 목록, 개인 상태, 추천 순서를 반환하지
않는다.

v1 입력은 다음처럼 설계한다.

```json
{
  "publicId": "concept:<canonical-id>"
}
```

지원 원칙은 다음과 같다.

- anonymous 안정 식별자는 기존 `publicKnowledgeId("concept", canonicalId)` 규칙과 호환되는 `concept:<id>` 하나를 1차 지원한다. `id`의 허용 문자는 현재 helper의 `[A-Za-z0-9._:-]` 근거를 사용한다.
- 내부 raw DB id를 별도 field로 받지 않는다. `publicId`를 서버가 parse한 뒤 canonical resolver로 다시 확인한다.
- `stableKey`와 exact `alias`는 기존 resolver가 지원하지만, anonymous 검색·존재 추정·alias ambiguity 정책이 확정되기 전에는 v1 public input으로 활성화하지 않는다. 후속으로 허용할 경우 `publicId`, `stableKey`, `alias` 중 정확히 하나만 허용하고 fuzzy search는 금지한다.
- 허용하지 않은 field, 여러 identity 동시 제출, 빈 문자열, NFKC/trim 후 빈 값은 `INVALID_INPUT`이다.

길이 상한은 기존 canonical Concept schema에 명시적인 public request limit이 없으므로
성능 측정값으로 가장하지 않는다. 구현 전 adapter가 제안 상한을 결정해야 한다. 최소 제안은
`publicId`와 `stableKey` 각각 255 UTF-8 bytes, alias를 추가할 경우 300 UTF-8 bytes이며,
provider가 query 전에 검증한다. 이 값은 DB column capacity나 공개 성공 근거가 아니다.

### 4.2 서버 처리와 공개 선택

서버 흐름은 다음과 같다.

```text
publicId parse
  → exact canonical resolve
  → public node predicate
  → allowlist projection
  → optional public relation projection
```

`public node predicate`는 다음을 요구한다.

- `ontology_concepts.status=ACTIVE`
- 별도로 승인된 public publication/access가 `PUBLISHED`/`PUBLIC`
- mapping/review 정책이 요구하는 경우 승인된 mapping과 source identity
- 반환할 `publicId`, `stableKey`, `label`이 완전
- `description`, alias, relation, source, revision 각각이 공개 allowlist를 통과

현재는 두 번째 이후 조건을 Concept resolver가 공급하지 않는다. 특히
`loadCanonicalConceptState`의 `UNKNOWN`을 `PUBLIC`으로 바꾸지 않으며, 이 상태에서는 정상
Concept 조회도 `NOT_FOUND` 또는 public projection 미구현에 따른 `UNAVAILABLE` 중 운영 정책이
정한 fail-closed 결과로 종료한다. private/unpublished/incomplete를 별도 공개 오류로
구분하지 않는다.

### 4.3 allowlist DTO

정책과 resolver가 실제로 공급하는 값만 다음 후보를 채운다.

```json
{
  "publicId": "concept:<canonical-id>",
  "stableKey": "<canonical concept key>",
  "label": "<preferred public label>",
  "description": "<approved public definition>",
  "aliases": ["<approved public alias>"],
  "relations": [
    {
      "type": "ROLE_REQUIRES_SKILL | SKILL_REQUIRES_CONCEPT",
      "source": { "type": "ROLE | SKILL | CONCEPT", "publicId": "..." },
      "target": { "type": "ROLE | SKILL | CONCEPT", "publicId": "..." }
    }
  ],
  "source": {
    "title": "<resolver-supplied public source title>",
    "url": "<resolver-supplied public URL or omitted>",
    "version": "<resolver-supplied version or omitted>"
  },
  "revision": "<resolver-supplied revision or omitted>",
  "asOf": "<resolver-supplied snapshot time or omitted>"
}
```

위 JSON은 최종 필드 승인 전의 DTO 후보이다.

- `label`은 schema와 canonical resolver에 실제 근거가 있다.
- `description`은 `ontology_concepts`에 실제 column이지만 현재 canonical public resolver projection에 연결되어 있지 않다. public definition을 별도 승인하기 전에는 생략한다.
- `aliases`는 `ontology_aliases`와 exact resolver에 실제 근거가 있으나 alias의 language/source와 public display 정책이 없다. raw alias row를 그대로 내보내지 말고 승인된 alias만 projection한다.
- `relations`는 두 typed relation family에 실제 근거가 있다. generic `ontology_edges`나 resource mapping을 Concept detail에 섞지 않는다. 관계 자체와 양끝 public predicate를 각각 통과한 경우만 포함한다.
- `source`, `revision`, `asOf`는 실제 public resolver/read model이 동일 snapshot에서 공급할 때만 반환한다. 현재 `sourceType`, `sourceId`, `provenanceJson`, `relationVersion`, `updatedAt`을 source citation·revision·출처 확인일·공식 최신성으로 이름을 바꾸지 않는다.
- `updatedAt`은 이 DTO에 포함하지 않는다. source link/hash 일치도 사용권, 기관 보증, 기관의 Securium 승인으로 표현하지 않는다.
- 내부 DB id, raw `metadataJson`, `weight`, reviewer user ID, review evidence, audit field, deletion/ops field, private source payload는 반환하지 않는다.

관계 없는 public Concept은 `relations: []`일 수 있지만, 전체 관계 수·hidden 관계 수·검색
후보 수를 넣지 않는다. 공개 predicate가 root 자체를 통과하지 못하면 root label, ID,
비공개 이유를 전혀 반환하지 않는다.

## 5. `get_learning_graph` 계약

### 5.1 지원 범위와 방향

기존 `skill-graph-query`가 허용하는 query type, resolver, hop composition을 재사용하되,
anonymous adapter는 그 결과를 public predicate로 다시 승인한다. 기존 service output의
`schemaVersion`, `queryType`, `depth`, `root`, `nodes`, `edges`, `page`는 실제 구현 근거다.

- [skill-graph-query.ts:11-28](../../lib/services/skill-graph-query.ts#L11-L28)
- [skill-graph-query.ts:65-143](../../lib/services/skill-graph-query.ts#L65-L143)
- [skill-graph-query-repository.ts:89-155](../../db/skill-graph-query-repository.ts#L89-L155)

public v1의 시작 노드와 traversal은 다음으로 고정한다.

| 시작 노드 | 허용 query | 방향/깊이 | 의미 |
| --- | --- | --- | --- |
| Role | `ROLE_SKILLS`, `ROLE_GRAPH` | `ROLE → SKILL`, 또는 `ROLE → SKILL → CONCEPT`; depth 1/2 | Role에 연결된 canonical Skill과 그 Skill의 Concept |
| Skill | `SKILL_CONCEPTS`, `SKILL_ROLES`, `SKILL_GRAPH` | `SKILL → CONCEPT`, `SKILL ← ROLE`, 또는 두 direct view; depth 1 | stored edge 방향은 바꾸지 않고 view만 역방향 |
| Concept | `CONCEPT_SKILLS`, `CONCEPT_GRAPH` | `CONCEPT ← SKILL`, 또는 `CONCEPT ← SKILL ← ROLE`; depth 1/2 | Concept에 연결된 Skill과 역방향 Role view |

지원 edge type은 정확히 다음 두 개다.

- `ROLE_REQUIRES_SKILL`: canonical source `ROLE`, target `SKILL`
- `SKILL_REQUIRES_CONCEPT`: canonical source `SKILL`, target `CONCEPT`

Role→Concept direct edge, Role hierarchy, generic ontology edge, Concept→resource edge는
지원하지 않는다. 역방향 query에서도 응답 edge의 `source`/`target`은 stored canonical
direction을 유지한다. private 중간 Skill을 제거한 뒤 Role→Concept synthetic edge를 새로
만들지 않는다.

### 5.2 입력 검증

입력은 다음처럼 existing service contract를 좁혀 사용한다.

```json
{
  "queryType": "ROLE_GRAPH",
  "root": {
    "type": "ROLE",
    "reference": { "roleKey": "role:<namespace>:<identity>" }
  },
  "depth": 2,
  "limit": 200,
  "cursor": "<direct-depth-1 cursor only>"
}
```

검증 규칙은 다음과 같다.

- JSON object와 allowlist field만 허용한다. root type과 query type이 일치해야 한다.
- exact `id`, `roleKey`, `skillKey`, Concept의 `key`/`stableKey`/`id`, 또는 exact alias 중 기존 resolver가 지원하는 identity만 받는다. public adapter가 alias를 열기 전에는 `publicId` root를 우선한다.
- identity field는 non-empty string이어야 하며 NFKC/trim/정규화 후 provider가 query한다. fuzzy, substring, arbitrary predicate는 금지한다.
- query type별 depth는 기존 validator처럼 고정한다. `ROLE_GRAPH`와 `CONCEPT_GRAPH`는 2, direct query는 1이며 `depth > 2`는 거부한다.
- 기존 cursor는 direct depth-1 query에만 허용하며, query fingerprint·cursor version·order version·integrity를 검증한다. 길이 4096을 넘는 cursor, 다른 root/query/limit용 cursor는 `INVALID_INPUT`이다.
- `limit`은 positive integer만 받고 기존 service의 per-hop default 200, hard max 500 관례를 우선한다. hard max 초과는 `LIMIT_EXCEEDED`로 거부한다.
- caller가 `userId`, `includePrivate`, `published`, `source`, `relationTypes` 확장값을 보내도 public scope·allowlist를 변경하지 않는다.

기존 validator 근거:

- [skill-graph-query.ts:364-400](../../lib/services/skill-graph-query.ts#L364-L400)
- [skill-graph-query.ts:607-647](../../lib/services/skill-graph-query.ts#L607-L647)

### 5.3 조회 비용과 응답 제한

기존 service가 제공하는 제한은 다음과 같다.

| 제한 | 현재 관례 | public 계약에서의 처리 |
| --- | --- | --- |
| depth | 최대 2 | 그대로 고정. 더 깊은 path는 별도 계약 없이는 거부 |
| per-hop default | 200 | 기본값으로 재사용하되, anonymous 공개 정책에서 더 작은 값을 정하면 그 adapter 값이 우선 |
| per-hop hard max | 500 | provider/query 전 단계에서 enforce; 자동 증액 금지 |
| total node hard max | 1000 | compose 전에 enforce |
| total edge hard max | 2000 | compose 전에 enforce |
| exact alias candidate hard max | 20 | 후보 ID/count를 public response에 노출하지 않고 overflow를 거부 |
| cursor encoded length | 4096 | decode 전 reject |
| D1 source-id chunk | 75 | provider 내부 query parameter 제한; public 응답 limit과 혼동하지 않음 |
| response bytes | 기존 graph contract에서 확인되지 않음 | 별도 public adapter 상한을 정하고, 측정값이 아닌 정책값으로 문서화해야 함 |

기존 graph service는 per-hop `overflow` 또는 hard overflow를 감지하고, depth-2 결과를
임의로 잘라 `partial`이라고 부르지 않는다. direct depth-1만 `hasMore`와 signed cursor를
사용한다. public v1도 다음을 유지한다.

- depth-1: public predicate를 적용한 stable order 기준으로 `hasMore`와 continuation을 반환할 수 있다.
- depth-2: 두 hop 모두 제한 안에 완전히 들어온 경우만 `OK`를 반환한다. 어느 hop이든 hard limit이나 승인된 response cap을 넘으면 `LIMIT_EXCEEDED`로 종료한다. partial graph나 숨은 node를 포함한 cursor를 반환하지 않는다.
- response byte cap은 결과를 만든 뒤 문자열을 잘라 구현하지 않는다. query/provider가 public predicate와 field projection을 적용한 뒤 bounded read를 수행하고, cap을 넘을 경우 재현 가능한 continuation을 지원하거나 요청을 거부해야 한다.
- 현재 repository의 relation scan은 `perHopHardMax + 1`을 읽고, D1 source id를 75개 단위로 나눈다. 이는 내부 bounded read 관례이지 anonymous public cost 보증이 아니다. public predicate를 query boundary에 결합할 provider/query 개선이 선행되어야 한다.

현재 제한의 근거:

- [skill-graph-query.ts:11-17](../../lib/services/skill-graph-query.ts#L11-L17)
- [skill-graph-query.ts:260-309](../../lib/services/skill-graph-query.ts#L260-L309)
- [skill-graph-query.ts:438-499](../../lib/services/skill-graph-query.ts#L438-L499)
- [skill-graph-query-repository.ts:76-100](../../db/skill-graph-query-repository.ts#L76-L100)
- [skill-graph-query-repository.ts:455-523](../../db/skill-graph-query-repository.ts#L455-L523)

### 5.4 결과 projection과 결정성

최소 public graph DTO는 다음이다.

```json
{
  "schemaVersion": "public-learning-graph.v1",
  "queryType": "ROLE_GRAPH",
  "depth": 2,
  "root": { "type": "ROLE", "publicId": "role:<id>" },
  "nodes": [
    { "type": "ROLE", "publicId": "role:<id>", "key": "role:<...>", "label": "...", "aliases": [] }
  ],
  "edges": [
    {
      "type": "ROLE_REQUIRES_SKILL",
      "source": { "type": "ROLE", "publicId": "role:<id>" },
      "target": { "type": "SKILL", "publicId": "skill:<id>" }
    }
  ],
  "page": { "limit": 200, "hasMore": false, "nextCursor": null }
}
```

`id`, `key`, `label`, alias, edge id, relationVersion, raw `sourceType`, `provenanceJson`,
reviewer 정보의 public 노출 여부는 각각 별도 allowlist로 결정한다. 특히 relationVersion은
stored relation metadata이지 source revision이나 공식 최신성 표시가 아니다. 공개 source와
revision을 붙이려면 node와 edge 모두 실제 public resolver가 그 값을 공급해야 한다.

중복·cycle·정렬은 기존 graph service 관례를 재사용한다.

- node identity는 `(type, id)`이고 edge identity는 `(type, edge id)`다. 같은 endpoint의 논리 edge 중복은 제거하고, 같은 edge id가 다른 endpoint를 가리키면 내부 무결성 오류로 종료한다.
- root 재방문과 cycle은 새 node/edge를 추가하지 않는다. hidden node를 거친 우회 경로도 추가하지 않는다.
- node 순서는 `depth → node type(ROLE, SKILL, CONCEPT) → canonical key → stable id`, edge 순서는 `depth → edge type → source id → target id → edge id`로 한다. 비교 규칙과 order version은 기존 `skill-graph.order.v1`를 기준으로 고정한다.
- database unique constraint가 중복 endpoint/type를 막더라도, public provider에서 다시 deduplicate와 endpoint assertion을 한다.

- [skill-graph-query.ts:442-555](../../lib/services/skill-graph-query.ts#L442-L555)
- [skill-graph-query.ts:576-647](../../lib/services/skill-graph-query.ts#L576-L647)
- [schema.ts:180-187](../../db/schema.ts#L180-L187)
- [schema.ts:3598-3605](../../db/schema.ts#L3598-L3605)

### 5.5 비공개 경계

public graph provider는 다음 순서로 필터링·탐색한다.

1. root가 public node인지 검사한다. 아니면 `NOT_FOUND`다.
2. 후보 edge가 public relation인지 검사한다.
3. 양끝 node가 public인지 검사한다.
4. public edge의 public endpoint만 다음 hop의 source set으로 사용한다.
5. 결과는 allowlist projection과 stable order로 만든다.

따라서 다음을 보장한다.

- public node와 private relation만 연결된 경우 root 또는 공개된 다른 node만 반환하고 relation을 만들지 않는다.
- private 중간 node에 닿는 edge는 숨기고, 그 node를 건너뛴 direct edge를 만들지 않는다.
- hidden node/edge의 ID, title, count, candidate count, path length, skipped reason을 반환하지 않는다.
- 전체 count, “private 때문에 N개 제외” 같은 메시지, error code 차이를 통해 숨겨진 존재를 추정하게 하지 않는다.
- public endpoint 두 개가 있어도 relation 자체의 public 근거가 없으면 edge를 반환하지 않는다.

현재 graph repository는 relation `ACTIVE`와 active endpoint를 SQL join하고 누락 target을
`ORPHAN_RELATION`으로 처리하지만, public publication predicate를 query에 포함하지 않는다.
기존 결과를 먼저 무제한으로 읽고 adapter에서 사후 제거하는 방식은 `hasMore`, 비용,
hidden count 경계를 왜곡하므로 public provider로 채택하지 않는다.

## 6. 개인 데이터와 Agent 권한 경계

이번 anonymous DTO에는 다음을 어떤 형태로도 넣지 않는다.

- `evidenceProjections`의 `userId`, `resultSummaryJson`, quality, occurredAt 또는 개인 source lineage
- mastery/confidence, `user_skill_state`, learning record, progress, enrollment, attempt/result
- 개인 추천, profile, credential, reviewer identity, private notes, answer/explanation

`evidenceProjections`는 user와 Concept에 직접 연결되고 개인 이벤트 lineage와 결과 summary를
갖는다. 이것은 Concept node가 canonical이라는 사실과 별개인 개인 데이터다.

- [schema.ts:4611-4666](../../db/schema.ts#L4611-L4666)

향후 내부 lookup이 graph node와 개인 state를 join하더라도 public adapter가 그 repository
projection을 재사용해서는 안 된다. canonical graph read와 personal read를 query, type,
authorization, fixture에서 분리하고, anonymous public provider에는 personal table/join을
주입하지 않는다.

그래프·검색 결과의 label, description, source text는 data다. 그 안에 “도구를 호출하라”,
“권한을 바꾸라”, “secret을 읽으라”, “임의 SQL/경로/URL을 실행하라”는 문장이 있어도 Agent
runtime이 실행 지시나 권한으로 해석하지 않는다. 이 계약은 read-only JSON projection만
허용하며, MCP/Agents API가 이를 우회할 수 없도록 별도 adapter에서도 동일 policy를 적용해야
한다.

MCP registry 등록, 공개 API 연결, Agents API 호출과 접근 검증은 각각 독립된 구현·검증 단계로
남긴다. 이번 설계의 상태는 `PUBLIC_TOOL_ACTIVATION: NOT_ENABLED`다.

## 7. 평가 시나리오

아래는 실행하지 않는 설계 평가 목록이다. 실제 DB fixture, public provider, isolated API가
구현된 뒤에만 수행한다.

| 시나리오 | 기대 계약 |
| --- | --- |
| 정상 공개 Concept 조회 | publicId가 정확히 resolve되고 public predicate와 allowlist를 통과할 때 `OK`; source/revision은 실제 resolver가 공급한 경우만 표시 |
| 공개 Role → Skill → Concept | 세 node와 두 relation이 모두 public일 때만 canonical 방향의 depth-2 graph; 추천 순서나 course 연결로 번역하지 않음 |
| 비공개 시작 node | `NOT_FOUND`; private라는 이유, ID, label, count를 노출하지 않음 |
| 공개 node 사이의 비공개 relation | node는 public 범위에서 유지하되 해당 edge는 제거; hidden edge count를 반환하지 않음 |
| 비공개 중간 node | edge와 후속 traversal을 함께 차단; private node를 제거한 direct Role→Concept edge를 만들지 않음 |
| cycle·중복 edge | `(type,id)`/edge identity dedupe; endpoint conflict는 `UNAVAILABLE` 또는 내부 오류로 fail closed; cycle을 새 path로 확장하지 않음 |
| 과도한 depth·fan-out·응답 | depth 2, 기존 per-hop/total hard max, public response cap을 query 단계에서 검사하고 `LIMIT_EXCEEDED`; 자동 재시도·무제한 read·사후 문자열 절단 금지 |
| source/revision 부재 | field를 synthetic value로 채우지 않음. public policy상 필수면 대상은 `NOT_FOUND`/`UNAVAILABLE`, 선택이면 field를 생략하고 `updatedAt`으로 대체하지 않음 |
| 개인 데이터 혼입 | personal table/join이 public projection과 분리되어야 하며, evidence/mastery/progress가 0개 field로 반환됨 |
| instruction-like 텍스트 | 텍스트는 untrusted data로 보존·표시할 수 있지만 tool call, SQL, path, URL, 권한 상승으로 실행하지 않음 |

“보안 개발자가 되려면 무엇을 알아야 하는가?” 질문에서는 현재 근거로 다음까지만 답할 수
있다.

- public policy가 승인된 경우 실제 `ROLE_REQUIRES_SKILL`과 `SKILL_REQUIRES_CONCEPT`가 가리키는 관계 사실을 표시할 수 있다.
- Role에서 Skill을 거쳐 Concept으로 이어지는 canonical topology를 설명할 수 있다.
- 현재 근거만으로 필요한 지식의 완전한 목록, 순서, 난이도, course/resource 대응, 합격 가능성, 개인별 추천을 확정할 수 없다.
- Concept→resource public binding이 없으므로 특정 lesson·문제·실습을 관계 데이터만으로 추천하지 않는다.
- 개인 mastery, 과거 답안, 시간, 경험, Evidence를 읽지 않으므로 “이 사용자에게 이 순서가 최적”이라고 말하지 않는다.

## 8. 최소 구현 순서와 blocker

현재 canonical 모델과 repository/service를 우선 활용하며 신규 graph DB, framework,
dependency를 도입하지 않는다.

1. **공개 정책·필드 확정**: Concept·Role·Skill·relation별 public publication/access, active/review와의 관계, description/alias/source/revision 공개 여부, anonymous error semantics를 승인한다.
2. **제한된 조회/provider**: public predicate를 SQL/provider query boundary에 결합하고, 양끝 node와 relation 자체를 함께 검사하며, depth/fan-out/response cost를 query 전에 제한한다. 현재 active-only graph repository를 사후 redaction adapter로 재사용하지 않는다.
3. **allowlist projection**: `get_concept`와 `get_learning_graph`의 versioned DTO, opaque public ID, source/revision availability, error envelope를 구현한다. 내부 ID·raw provenance·ops field·personal join은 제외한다.
4. **fixture 및 실제 DB 검증**: 공개/비공개/retired/ambiguous/orphan/relation private/cycle/duplicate/source absent/personal join contamination fixture와 isolated provider를 검증한다. 이 문서 작업에서는 실행하지 않는다.
5. **도구 등록·접근 검증**: 실제 API/MCP owner에 read-only registration을 별도로 추가하고 anonymous transport, rate limit, audit metadata, response byte cap을 검증한다. MCP/Agents API 호출은 이 단계 이후다.
6. **live 평가**: 승인된 public endpoint에 대해서만 동일 query 반복성, stale/publication 변경, 비용, prompt-injection data boundary를 평가한다.

확정 blocker:

- `loadCanonicalConceptState`의 publication/access/provenance/revision이 `UNKNOWN`이라 Concept public eligibility를 증명할 수 없다.
- Role·Skill·typed relation에 lifecycle/review/provenance는 있지만 anonymous public publication/access 상태와 공개 책임 규칙이 없다.
- 현재 graph provider는 active endpoint/relation read model이지 public predicate와 public response-cost provider가 아니다.
- source taxonomy와 schema의 source/revision 후보를 Concept·Role·Skill public snapshot으로 resolve하는 binding이 없다.
- Concept→resource mapping은 관계 schema가 일부 있어도 mapping approval, published resource, endpoint scope, revision을 한 번에 보장하는 public resolver가 없다.
- `get_concept`/`get_learning_graph` public API 또는 MCP registry/call site가 없다. 등록은 설계 완료가 아니라 별도 구현·접근 검증의 결과여야 한다.

따라서 설계만 완료된 현재 상태에서는 두 도구를 `NOT_ENABLED`로 유지한다.

## 9. 남은 결정과 보존 상태

구현 전에 다음을 결정해야 한다.

- public ID가 raw canonical ID를 포함해도 되는지, opaque ID 또는 stable key를 사용할지
- alias lookup을 anonymous v1에서 열지, ambiguity/열거 oracle을 피하기 위해 publicId만 열지
- description과 alias의 공개 승인 주체·언어·정리 규칙
- node/edge public approval과 source usage class의 필수 조합
- source/revision/asOf의 정의, snapshot ownership, stale invalidation, 공개 URL/사용권 문구
- depth-2의 partial/continuation을 영구히 금지할지, provider-level paged traversal을 별도 설계할지
- public response byte cap과 rate/concurrency budget
- public graph와 course/resource discovery를 연결할지. 연결한다면 별도 mapping/read model 계약을 만든 뒤에만 허용

이 문서 작업의 상태:

```text
GRAPH_TOOL_IMPLEMENTATION: NOT_STARTED
PUBLIC_TOOL_ACTIVATION: NOT_ENABLED
DATABASE_VALIDATION: NOT_RUN
LIVE_API_EVALUATION: NOT_RUN
PERSONAL_EVIDENCE_ACCESS: OUT_OF_SCOPE
CANONICAL_MUTATION: NONE
```

기존 설계 문서, 기존 worktree/branch, triage·보고서·artifact·parallel 작업은 변경하지
않는다. 이 branch에서는 이 문서 하나만 변경하고, 제품 코드·schema/migration·workflow·seed
transaction을 추가하지 않는다.

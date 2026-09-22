# Concept-to-Public-Learning-Resource Contract

Status: design and repository review only
Fixed review base: `efc6a873e600b53031b3d728ed5353993ab0ac88`
Related graph validator merge: `3ad6cbcf4cd6bd998b41cc507ca5bfcdaa757268`

The labels used below are evidence states, not product API or database enums:

- `CURRENT_IMPLEMENTATION`: observed in the current schema, repository, or caller, with the stated scope only.
- `PROPOSED_CONTRACT`: a future acceptance or projection rule; it is not enabled by this document.
- `UNRESOLVED_POLICY`: a product/authority decision is still required.
- `UNVERIFIED_DATA`: this review did not establish production row fulfillment.

## 1. Purpose and boundary

This document defines the boundary for a future connection from a canonical
Concept to public learning resources. It records what the current schema,
repositories, and callers can establish, what is only a derived path, and what
is not implemented.

This is not an implementation of a Concept-to-resource resolver. It does not
create mappings, query the database, change publication policy, add a route,
connect a Concept-resource provider to a public graph/MCP surface, or activate
an API/MCP tool. No row count or
operational completeness claim is made: database state is **UNKNOWN** because
this review did not execute a database query.

Role/skill/concept graph query and response-validation components already exist,
but they do not traverse Concept-to-learning-resource mappings.

The response validator from PR #197 ([implementation](../../lib/services/public-graph-response-validation.ts#L1)) validates a response's runtime shape,
allowlist, identity, endpoints, relation direction, topology, and confirmed
limits. Its merge does not create Concept-to-resource mappings, decide
publication, or prove that a resource is suitable for learning.

The existing public course, outline, selection, source-projection, and graph
contracts remain the references for their own scopes:

- [public learning graph contract](./public-learning-graph-contract.md#L79)
- [public course/group policy contract](./public-course-group-policy-contract.md#L35)
- [public course search storage contract](./public-course-search-storage-contract.md#L49)
- [public discovery UX contract](./public-discovery-ux-contract.md#L44)
- [public source projection contract](./public-source-projection-contract.md#L127)
- [canonical concept authority](../../lib/services/canonical-concept-authority.ts#L9)

## 2. Current model inventory

### 2.1 Canonical Concept identity

`ontology_concepts` is the current runtime authority for Concept identity. Its
identity is `id` plus the semantic `conceptKey`; it also carries namespace,
label, aliases through `ontology_aliases`, category, description, source
fields, metadata, and lifecycle status. The canonical lifecycle is not a
public publication grant.

`concepts`, `concept_versions`, and `concept_labels` are a CP-A
staging/compatibility family. The canonical authority service explicitly keeps
`ontology_concepts` as the runtime authority because question, content, fact,
evidence, and ontology paths already refer to those IDs. CP-A persistence is
restricted to draft staging. A CP-A row or version must therefore not be used
as an anonymous public Concept resolver without a separate authority decision.

Relevant sources:

- [`ontology_concepts` and aliases](../../db/schema.ts#L3518); [`ontology_edges`](../../db/schema.ts#L3614)
- [`canonical-concept-authority.ts`](../../lib/services/canonical-concept-authority.ts#L9)
- [`canonical-concept-repositories.ts`](../../db/canonical-concept-repositories.ts#L20)
- [`skill-graph-query.ts` (separate graph scope)](../../lib/services/skill-graph-query.ts#L324)

### 2.2 Resource identities

The repository contains several resource families with different revision and
access semantics:

| Resource family | Identity and relevant lifecycle | What it establishes | What it does not establish |
| --- | --- | --- | --- |
| Reusable content | `contents.id`; `slug`, `canonicalKey`, `version`, `status`, `deletedAt` | A content record and its current storage lifecycle | A Concept mapping; `coreConceptsJson` is not a normalized FK relation |
| Content revision | `content_revisions.id`; `contentId`/`contentType`, version, revision status, publication timestamps, snapshot and review fields | A versioned revision record | That the revision is mapped to a Concept or publicly accessible in every route |
| Course lesson | `course_lessons.id`; `courseId`, `curriculumNodeId`, `contentId`, status, deletion | Placement of content in a course/curriculum | That the content explains a particular Concept |
| Question | `questions.id` and `question_versions.id`; question and version status/review fields | A question and its versioned assessment artifact | A public answer policy or a Concept navigation mapping |
| Practical governance | `canonical_practicals`, practical versions, and `practical_version_concept_bindings` | A governed practical version and a Concept key/id candidate | An executable public lab or a public Concept resolver |
| Lab / specialized practical | No generic `labs` table; `practical_definition_versions`, `secure_code_samples`, and `privacy_assessment_scenarios` are separate families with separate routes | A governed definition or specialized practical record | A generic lab identity, Concept mapping, anonymous access, or execution readiness |
| Certification/standard-related resource | `isms_standards`, course specializations, course links, and certification curriculum identities | A standard or course-linked specialized record | A Concept mapping or certification-coverage claim |
| Course/subject/topic | Course, curriculum, subject, and topic identities with their own lifecycle fields | Placement and discovery structure | Sufficient Concept teaching coverage or assessment/practice capability |

The precise schema is in [`db/schema.ts`](../../db/schema.ts#L926). A schema table is
not evidence that rows exist or that a mapping is complete.

## 3. Mapping inventory and authority

The following table distinguishes a stored relationship from a path that can
only be derived by joining existing resources. Every row-count cell is
`UNKNOWN` because no database execution was performed.

| Source identity | Destination identity/type | Actual relation or query path | Direction and cardinality | Classification | Revision binding | Public predicate owner | Current caller | Row fulfillment |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `content_revisions.id` / `revisionId` | `ontology_concepts.id` / nullable `conceptId` | `content_revision_concepts`; `relationType` is constrained to `MAPS_TO`; mapping status and qualification/provenance are stored; governed writer reads/writes rows | Content revision → Concept candidate; many mappings per revision and many revisions per Concept are possible | **Direct mapping family; canonical authority declaration; not a public resolver** | `revisionId`, `mappingVersion`, and revision metadata exist; no public snapshot resolver | No anonymous Concept projection owner. The governed theory repository persists mapping rows; the content-revision public read has its own route/access rules | [`saveGovernedTheoryRevision`](../../db/content-revision-governance-repositories.ts#L24), called by the admin route [`SAVE_GOVERNED_THEORY`](../../app/api/admin/content-revisions/route.ts#L45); no Concept-resource projection caller | UNKNOWN |
| `question_versions.id` / `questionVersionId` | `ontology_concepts.id` / `conceptId` | `question_concepts`; approved mappings are selected by [`resolveQuestionVersionBindings`](../../db/question-repositories.ts#L696) | Question version → Concept; many-to-many | **Direct mapping family with internal consumer; not a Concept projection** | Question version, semantic hash, mapping version, reviewer fields | Question repository owns public question publication; mapping approval is internal governance, not anonymous Concept publication | Governed question writes use the mapping table; `listPublicQuestions` uses the approved set to retain a governed `questionVersionId` but does not emit Concept mappings; phase-3 validation also builds a binding hash | UNKNOWN |
| Practical version identity | `conceptKey` and optional `conceptId` | `practical_version_concept_bindings`; mapping hash and mapping status are part of practical governance | Practical version → Concept candidate; one row per practical version/key, but `conceptId` has no FK | **Direct candidate mapping; governed writer; not a public resolver** | `mappingSemanticHash` and practical version exist; no public `asOf` or resource snapshot | None found | [`registerGovernedPracticalVersion`](../../lib/practical/practical-registration.ts#L265) resolves canonical candidates before [`PracticalGovernanceRepository.createGovernedPractical`](../../db/practical-governance-repositories.ts#L17) writes; no public Concept caller found | UNKNOWN |
| Generic entity identity | Typed entity identity | `ontology_edges` with `fromType`, `fromId`, `toType`, `toId`, relation, optional course scope, confidence/evidence, and status | Directed typed edge; generic many-to-many | **Generic graph relation; not a dedicated Concept-resource mapping** | No required resource revision binding | Internal ontology/AI/admin scope; no Concept-resource publication owner | [`db/ontology-repositories.ts`](../../db/ontology-repositories.ts#L146), AI retrieval/explainability, admin ontology, and seed/generation code; no Concept-resource public caller | UNKNOWN |
| `contents.id` | Labels in `coreConceptsJson` | Content authoring and seed data store `coreConceptsJson`; the authority contract calls it an authoring hint | Content → label/key hint; no normalized identity or reverse relation | **Authoring hint, not mapping** | None | None | Content/ontology seed generation and authoring code; no Concept-resource projection | UNKNOWN |
| `curriculumNodes.id` / `courseLessons.id` | `contents.id`, plus course/subject/topic identities | `course_lessons.curriculumNodeId` and `contentId`; published curriculum repositories join published course lessons to published content | Curriculum node → course lesson → content; one-to-many at each placement boundary | **Derived resource placement, not Concept mapping** | Content version participates in progress lookup; no Concept revision binding | Course/lesson repositories and route-level access checks | Curriculum overview/path repositories and learn/lecture routes; ontology builder can also emit coverage edges | UNKNOWN |
| `courseId`, `subjectId`, `topicId` | `questionId` | `question_courses`, `question_subjects`, `question_topics`; public question repository adds published question/course predicates | Course/subject/topic → question; many-to-many | **Derived assessment placement, not Concept mapping** | Question version is resolved internally; no Concept-resource snapshot | `listPublicQuestions` owns this public question read path | Practice, level, and question callers | UNKNOWN |
| `contentType`/`contentId` | `courseId` or `questionId` | `content_course_links` and `content_question_links` provide typed specialized-content/course/question links | Content → course and content → question; link tables do not target Concept | **Derived specialized placement, not Concept mapping** | No Concept or resource-revision binding | Specialized repositories apply their own active/public/enrollment checks | `specialized-repositories.ts` and `practical-specialization-repositories.ts`; no Concept-resource public caller | UNKNOWN |

### 3.1 Direct, derived, inferred, and proposed links

Within the learning-resource mappings in scope, the direct Concept links are
the specialized mapping families above. Other direct Concept relations such as
fact/evidence or Skill → Concept are different authorities and are not
resource mappings. The families above are not interchangeable:

- `content_revision_concepts` is the direct content-revision mapping family,
  and its governed repository has a writer and completeness read, but no
  runtime public Concept-resource repository was found.
- `question_concepts` is consumed to bind approved question-version mappings
  into an internal immutable binding hash. That use does not mean the public
  question result is a Concept navigation result.
- practical bindings contain a required `conceptKey` but only an optional,
  non-FK `conceptId`; they cannot be treated as a resolved canonical public
  relation.
- `ontology_edges` can represent relations such as `CONTENT → CONCEPT` or
  `QUESTION → CONCEPT`. The security-certification seed builder creates
  `QUESTION → CONTENT` with `DERIVED_FROM` and `QUESTION → CONCEPT` with
  `TESTS`, while curriculum/content edges are generated for coverage. These
  are seed/internal ontology relationships, not a publication resolver.
- `course_lessons`, subjects, topics, and course membership can derive a
  resource associated with a course or curriculum node. They cannot be
  reversed into “this Concept is taught by this resource” without an
  authoritative Concept mapping.
- `content_course_links` and `content_question_links` connect specialized
  content to a course or question, but do not establish Concept identity or
  publication for a Concept projection.

Name, title, slug, canonical key, label, or keyword similarity is an inferred
link only. It must never be promoted to a canonical mapping, prerequisite,
assessment claim, practical claim, certification coverage claim, or learner
competency claim.

No proposed mapping registry is introduced here. Existing mapping families
should remain the authority for their respective resource types until a
separate resolver design establishes whether a unified registry is necessary.

## 4. Publication, access, and intermediate-node boundaries

### 4.1 Separate predicates

Concept identity and resource access are independent decisions.

1. **Concept identity/lifecycle:** `ontology_concepts.status = ACTIVE` can
   identify an active canonical row. The canonical repository's state seam
   reports publication and access as `UNKNOWN`; it is not an anonymous public
   authorization check.
2. **Mapping usability:** a future resolver must require the mapping family’s
   approved/reviewed state, valid endpoints, and any qualification or
   provenance rule that the product policy actually adopts. `APPROVED` in a
   mapping table is internal governance evidence, not by itself a public grant.
3. **Resource publication:** reusable content and course lessons use their own
   published/non-deleted predicates. Public question lookup requires published
   questions and a public course relationship. Practical and specialized
   resource paths have additional repository and access rules.
4. **Course/group/parent predicates:** the strict public list and outline
   providers require an active, published, non-deleted course and an active,
   non-deleted group. The legacy direct course detail lookup has a narrower
   group predicate. The existing policy document records this as
   `INTENT_NOT_ESTABLISHED`; this contract does not silently normalize it.
5. **User access:** course metadata and an outline are not lesson-body access.
   Learn, practice, lecture, and specialized paths add authentication,
   enrollment, or user-specific progress checks. A public Concept must not
   imply those rights.

The relevant implementations are [`db/repositories.ts`](../../db/repositories.ts#L97),
[`db/public-course-outline-provider.ts`](../../db/public-course-outline-provider.ts#L37),
[`db/public-course-availability-repository.ts`](../../db/public-course-availability-repository.ts#L32),
[`db/shared-content-repositories.ts`](../../db/shared-content-repositories.ts#L806),
and [`db/question-repositories.ts`](../../db/question-repositories.ts#L99).

### 4.2 Metadata versus learning access

The minimum safe distinction is:

- A Concept label or a resource title is metadata, subject to a future public
  metadata policy.
- A lesson body requires the resource's published/non-deleted predicate and
  the existing course/user access path.
- Question metadata or a question stem/choice set is distinct from answers,
  explanations, reviewer data, and learner evidence.
- A practical specification is not an executable lab, and a practical mapping
  is not proof that the learner can run it.
- A subject/topic or curriculum outline is not proof that lessons, questions,
  practice, or sufficient learning content exist.
- A login session on a public metadata route does not bypass the authenticated
  learner route's enrollment or user-specific predicates.

Direct lookup and discovery can currently apply different course/group
predicates. A future Concept resolver must name which public predicate it
uses, rather than inheriting whichever route happened to be called.

### 4.3 Private intermediate nodes

A private resource, private course/group, or private intermediate node must not
be bypassed by emitting a new public Concept→resource edge. If a derived path
contains a non-public endpoint, the path is not a public relation. The public
projection must omit it or return a safe unavailable/empty result without
revealing its private ID, title, count, or existence. This paragraph is a
`PROPOSED_CONTRACT` for the future resolver, not a claim that a resolver is
already enforcing it.

| Boundary rule | Current review classification |
| --- | --- |
| Exclude private resources | `CURRENT_IMPLEMENTATION` only inside resource-specific reads such as published course/content/question and enrolled practical paths; no resolver-wide control exists |
| Do not create a public edge across a private intermediate node | `PROPOSED_CONTRACT`; the response validator can partially check returned topology/dangling references, but cannot discover an omitted private source node; no independent source-backed Concept-resource oracle was found |
| Do not use an automatic fallback that bypasses a private relation | `PROPOSED_CONTRACT`; no Concept-resource fallback implementation or oracle exists |
| Do not infer a replacement resource from title/name | `CURRENT_IMPLEMENTATION` for canonical Concept exact-identity resolution, and `PROPOSED_CONTRACT` for Concept-resource mapping; lexical search is not an authority |

`ACTIVE`, canonical registration, validator success, a reviewed mapping, or a
synthetic oracle success must not be described as publication approval.

## 5. Revision and change contract

There is no current generic Concept-to-resource revision or `asOf` resolver.

- A canonical Concept has a stable `ontology_concepts.id` and `conceptKey`.
  CP-A `concept_versions` are not a runtime public revision authority.
- `content_revisions` version a content snapshot and `contents.version` is a
  content record version. They are not interchangeable with a mapping version.
- `question_versions` carry question snapshots, semantic hashes, and human
  review fields. A question mapping hash is an internal binding artifact, not
  a public `asOf` snapshot.
- practical governance versions and `mappingSemanticHash` are scoped to the
  practical family.
- `updatedAt`, a source hash, or a slug is not a substitute for a resolver's
  revision binding.
- Resource IDs identify rows within their family; slugs and similar keys are
  route/search identifiers and are not cross-family identity. MCPA's current
  `asOf` value is response-time traceability metadata, not a Concept mapping
  snapshot or an atomic database read.

A future resolver must define the behavior for these transitions:

| Change | Required rule before public projection |
| --- | --- |
| Concept merge, retirement, or label change | Resolve by canonical identity and explicit successor policy; never re-resolve by the new label alone |
| Resource edit or new revision | Bind the mapping to the intended resource/revision and re-evaluate publication; do not silently carry an old approval |
| Resource move, deletion, or private transition | Remove it from the accessible projection; preserve an internal diagnostic state |
| Mapping approval, supersession, or removal | Use mapping status/version rules; do not select the first surviving row |
| Slug reuse | Resolve by stable identity, not a historical slug |
| Read during concurrent changes | Use a defined repository snapshot/transaction if one projection must be coherent; independent reads are not one snapshot |

No Concept-resource `asOf`, source/revision resolver, or snapshot contract is
claimed to exist today. Implementing one is a later repository/policy task.

## 6. Proposed public metadata projection

This is a conservative design target, not an implemented DTO or route.

| Projection field | Possible source | Decision owner | Missing behavior | Current implementation |
| --- | --- | --- | --- | --- |
| Display label | `ontology_concepts.label` and approved public label policy | Concept/publication policy | Omit or generic unavailable | No Concept public projection |
| Resource type | Resolver-owned allowlist, not raw table enum | Resolver/public contract | Omit unsupported type | No resolver |
| Public title/summary | Published resource title/summary | Resource publication repository | Omit resource; do not fall back | Existing resource repositories expose their own fields only |
| Relationship meaning | Approved mapping relation or explicit derived relation label | Mapping authority and public contract | Omit if ambiguous | No public Concept relation DTO |
| Allowed navigation target | Existing route identity after access predicate | Route/resource owner | Omit if route/access is unavailable | No Concept navigation caller |
| Learning-available state | A current access/availability read, if policy defines it | Resource access owner | `UNKNOWN`/omit rather than infer | Course availability flags exist, but are not Concept mapping results |
| Revision/as-of | Future resolver snapshot contract | Resolver/publication policy | Omit until bound | Not implemented |

The default projection excludes raw database IDs, internal enum values, source
bindings, mapping payloads, answers, reviewer fields, personal Evidence, and
private operational notes. IDs or hashes alone do not guarantee anonymity.
An allowlist is not a free-text PII scrubber or prompt-injection defense, and it
does not validate rights or freshness merely because it passed.

No new route is proposed in this document. A later implementation must reuse
an existing course/learn/question/lecture/practice/specialized route only when
that route's own access contract is satisfied. The current [MCPA read service](../../lib/mcp/mcpa-read-service.ts#L77)
exposes Course/Lesson/Question entities; its [resource/tool declarations](../../lib/mcp/mcpa-core.ts#L5)
list Course/Lesson resource URIs and search/get-question tools, with no Concept
resource type;
this document does not expand it.

## 7. Missing, private, malformed, and error states

The following are `PROPOSED_CONTRACT` internal diagnostic names for a future
resolver, not current public API enum members:

- `VALID_PUBLIC_MAPPING`
- `MAPPING_NOT_FOUND`
- `RESOURCE_NOT_FOUND`
- `RESOURCE_PRIVATE_OR_INACTIVE`
- `PUBLIC_EVIDENCE_MISSING`
- `MALFORMED_OR_DANGLING_RELATION`
- `AMBIGUOUS_MAPPING`
- `REPOSITORY_ERROR`

The external contract should expose only a safe projection or a generic
`EMPTY`/`NOT_FOUND`/`UNAVAILABLE` result according to the eventual policy.
Those names are illustrative here; the existing MCPA error enum and public
graph status enum belong to their own surfaces and must not be reused as a
Concept-resource API without a separate decision.
It must not expose a private ID, title, count, payload, or arbitrary database
error. `REPOSITORY_ERROR` must remain distinguishable in internal telemetry;
it must not be silently rewritten as “no resource” internally.

There is no automatic fallback to another course, another resource, or a
different access level. A mapping with a missing or private endpoint fails
closed for the public projection. An ambiguous mapping is not resolved by
title, order, or “first row wins.”

The response validator can reject malformed response structure and unsafe
fields. It cannot detect source omissions, private source disclosure, or a
wrong mapping unless a separate source-backed oracle supplies that expected
projection. A future publication oracle may compare a source fixture or
repository snapshot, but its result would still be evidence for that fixture
or snapshot, not proof of all production data or publication policy.

## 8. Query, ordering, and limit boundaries

Existing limits must not be recast as a new Concept-resource query-cost
contract:

| Existing limit/behavior | Current owner and meaning | Concept-resource implication |
| --- | --- | --- |
| Ontology graph 1,000 concepts / 2,000 edges | Internal database ontology graph retrieval | Not a public resource resolver limit or provider cost guarantee |
| Course search maximum and cursor/query limits | Default 8, maximum 12, query maximum 48 UTF-8 bytes, cursor maximum length 2048 in the public course search adapter | Applies to search input/results, not Concept mapping expansion |
| Outline subject/topic lookahead bounds | Maximum 50 subjects and 200 topics; provider fetches one extra row for each limit check | Applies to outline retrieval, not mapping completeness |
| Availability batch size | 100 course IDs per repository batch | Shows selected course resource flags, not Concept mapping |
| Public question result limit | `listPublicQuestions` clamps its public read to 50 results | Applies to question lookup, not Concept→question traversal |
| Public graph response limits | Depth metadata 1/2, per-hop hard maximum 500, total nodes 1,000, total edges 2,000, cursor 4,096 UTF-8 bytes | Applies to the response validator's graph contract, not Concept-resource traversal or database cost enforcement |
| Published course lessons | Course-scoped repository reads, with no generic Concept cursor | No Concept pagination or cross-resource ordering exists |

The repository does not currently provide a batch Concept→resource lookup,
deduplication key across resource families, deterministic ordering across
content/question/practical types, a Concept cursor, or a response-cap contract.
N+1 behavior and query plans are therefore unresolved. A document or response
limit must not be presented as a database/query-cost or per-hop enforcement
limit. No Concept-resource response byte cap was found; the graph validator's
public-ID/cursor byte checks are not a full response-size contract.

Any future resolver must define, before implementation:

1. mapping and endpoint validation order, including when private rows are
   filtered;
2. resource-family deduplication and stable ordering;
3. batch behavior and bounded expansion;
4. pagination/cursor encoding and byte semantics, if pagination is required;
5. a coherent snapshot or an explicit non-snapshot consistency statement.

## 9. Synthetic examples

These examples are deliberately synthetic. They are not canonical mappings,
production rows, or publication decisions.

| Scenario | Internal lookup result | Public projection | Do not show/claim | Unresolved follow-up |
| --- | --- | --- | --- | --- |
| Direct Concept → public theory resource | An approved content-revision mapping is found; the revision's content identity has a published, non-deleted course-lesson placement | Concept label, resource type/title, approved relationship meaning, and an existing allowed navigation target if the future resolver confirms all predicates | Raw IDs, source payload, reviewer, and “mastery” or competency claim | Define mapping-publication authority and revision snapshot; verify with repository data |
| Concept → course → resource | Concept has no direct mapping; a course contains a published lesson through curriculum placement | At most a separately labeled course association through an existing course/outline contract | “This resource teaches the Concept” or a canonical Concept edge | Obtain an authoritative Concept mapping or keep the relation absent |
| Public Concept + private resource | Concept is active/public under a future policy; endpoint is private/inactive | No private resource in the public projection; safe empty/unavailable state | Private title, ID, count, or existence | Define external state wording and internal telemetry |
| Private intermediate node | A path passes through a private curriculum/course/resource node | No bypass edge and no derived public resource | Any replacement edge that hides the private endpoint | Verify provider endpoint checks and oracle bypass case |
| Mapping exists, resource deleted | Mapping row exists, endpoint is missing/deleted | No resource; internal dangling/not-found diagnostic | Historical title or automatic substitute | Decide retention/audit behavior without making it publicly resolvable |
| Same title, different IDs | Multiple resources have the same title but no approved identity mapping | No title-based selection; ambiguous/not-found | Canonical relation or “best match” claim | Resolve by stable identity and approved mapping only |
| Practical specification, no executable lab | Practical version or spec is mapped, but no runnable published lab/access path exists | Optional descriptor only if a future policy explicitly permits it | Executable lab, run permission, or assessment claim | Define the public practical resource type and access owner |

## 10. Required follow-up boundaries

A later implementation would need, in this order:

1. an authority decision for each resource family and mapping status;
2. a resolver that uses canonical Concept identity, approved mapping, endpoint
   direction/type, resource revision, and publication/access predicates;
3. a safe public projection and route binding without introducing a new route
   in this design task;
4. source-backed negative tests for private disclosure, private intermediate
   bypass, omissions, dangling endpoints, ambiguity, and deletion;
5. bounded repository queries with explicit ordering, deduplication, and
   snapshot/pagination semantics;
6. a separate decision on whether the MCPA/public graph surface should expose
   a Concept resource type.

The graph response validator and a future provider/oracle have different
responsibilities:

| Component | Can establish | Cannot establish |
| --- | --- | --- |
| Pure response validator | Runtime shape, allowlist, types, identity/duplicates, endpoints, documented relation direction, topology, confirmed response limits, and non-partial failure | Database mapping completeness, publication approval, source omissions, query cost, real traversal, or learner suitability |
| Independent source-backed oracle | Expected synthetic public projection, private node/edge disclosure, bypass edges, and expected omission/coverage for its fixture | All production rows, live publication policy, provider performance, or every historical revision |
| Future Concept-resource provider | Repository-backed mapping and publication/access resolution once explicitly implemented | Any policy or data authority not supplied to it |

## 11. Review conclusion

The repository currently supports several mapping schemas and internal
resource-placement paths, but it does not expose a single Concept→public
learning-resource contract. The safe current conclusion is:

- canonical Concept authority: `ontology_concepts`;
- direct mapping families: content revisions, question versions, and
  practical governance bindings, with different authority and revision
  semantics;
- generic ontology edges and course/curriculum placement: useful internal or
  derived relations, not public Concept mappings;
- public resource access: owned separately by course/resource repositories and
  route-level authentication/enrollment rules;
- data presence, mapping completeness, publication intent, and a coherent
  Concept/resource snapshot: **UNKNOWN or NOT IMPLEMENTED**;
- Concept-resource mapping implementation: **NOT CHANGED**;
- Concept-resource provider, publication policy, public UI/API wiring, and
  Concept-resource tool activation: **NOT STARTED / NOT ENABLED**. Existing
  generic graph/query and MCPA surfaces remain outside this resolver scope.

The next implementation must not infer a mapping from a similar name, a course
membership edge, an ACTIVE/canonical row, a validator pass, or an internal
approved binding hash.

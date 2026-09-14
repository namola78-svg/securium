# Public Source Projection Contract

Status: design only. This document defines how a future server-owned public
source projection could be constructed for the already merged display
formatter. It does not implement a resolver, change authorization, query the
database, or connect a page/API to the formatter.

## 1. Purpose and review basis

The reviewed formatter is [`formatPublicSourceDisclosure`](../../lib/services/public-source-disclosure.ts#L86-L116), merged by PR #187 at
`5a5f26a4d6dab40a6ae3f205821f491a1ec092a6`. The fixed design-review base is
`origin/main` at `6bc0066c7833fd483811f0b277c5e2843d7bad47`; PR #187 is an
ancestor of that commit. The existing product-level source transparency
design is [`public-source-transparency.md`](../product/public-source-transparency.md).

The review used static source inspection only. No database, seed runtime,
network, URL, API, browser, or deployment evaluation was performed. The
important distinction is:

1. a column or type exists in the schema;
2. a repository can read it;
3. a server-owned public projection joins and authorizes it; and
4. deployed data is actually populated and complete.

Only the first two are established below unless explicitly stated otherwise.

## 2. Current formatter input and output

The formatter accepts `unknown`. The root value must be a plain object (or an
object with a null prototype) whose `projectionKind` is exactly
`PUBLIC_SOURCE_DISCLOSURE_PROJECTION_KIND`. Arrays, primitives, `null`, a
missing marker, and an object shaped like a raw/private source are rejected
without coercion. A throwing property read is converted to the same generic
missing-information result.

The input shape is defined by [`PublicSourceDisclosureProjection`](../../lib/services/public-source-disclosure.ts#L49-L52):

```ts
{
  projectionKind: "PUBLIC_SOURCE_DISCLOSURE_PROJECTION",
  officialSource?: {
    institutionName?: string | null,
    documentTitle?: string | null,
    sourceUrl?: string | null,
    editionOrVersion?: string | null,
    effectiveFrom?: string | null,
    effectiveTo?: string | null,
    sourceCheckedAt?: string | null,
    reviewStatus?: { displayLabel: string, scope?: string | null } | null,
    reviewedAt?: string | null,
    reviewerDisplayRole?: string | null,
  } | null,
  securiumExplanation?: { scope?: string | null } | null,
}
```

The TypeScript type is not an authorization boundary. The runtime formatter
still validates values as `unknown`:

- Text must be a non-empty, untrimmed string, at most 500 Unicode code points,
  and contain no control character. Invalid fields are omitted.
- Dates must be an exact valid `YYYY-MM-DD` value. Invalid dates are omitted.
- `sourceUrl` must pass the formatter's `URL` parser, be HTTPS, have a
  non-empty hostname, have no username or password, and fit the 2,048-code-
  point text limit. Relative, malformed, `http`, `javascript`, `data`, `file`,
  `ftp`, and credential-bearing URLs are omitted.
- `reviewStatus` contributes a review object only when it is an object with a
  valid `displayLabel`; the formatter does not interpret a raw review enum.
- `officialSource` and `securiumExplanation` are independently optional. A
  malformed nested object is not coerced into a different shape.

The output is an explicit allowlist, not a spread of the input. The output
contains only `officialReference`, `independentExplanation`, and `notice`, as
implemented in [`formatProjection`](../../lib/services/public-source-disclosure.ts#L100-L115),
[`formatOfficialReference`](../../lib/services/public-source-disclosure.ts#L117-L168),
and [`formatIndependentExplanation`](../../lib/services/public-source-disclosure.ts#L170-L189).
The official reference is considered complete only when `institutionName`,
`documentTitle`, and `sourceCheckedAt` are all valid; otherwise the generic
`PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE` remains present. An independent
explanation never makes an official reference complete.

The formatter is pure and display-only. It performs no I/O, database lookup,
authorization, publication decision, rights review, currentness review, URL
fetch, redirect check, DNS check, HTML generation, or free-text PII removal.
Renderer escaping remains a separate responsibility.

## 3. Canonical field mapping

The principal canonical source model is `source_identities` plus the source
binding and verification data associated with a canonical assertion. The
schema declarations are [`sourceIdentities`](../../db/schema.ts#L4293-L4328),
[`assertionSourceBindings`](../../db/schema.ts#L4331-L4385), and
[`temporalAssertions`](../../db/schema.ts#L4219-L4289). The domain-level
provenance types are [`FactSourceVerification`](../../lib/facts/fact-domain.ts#L44-L59)
and [`FactProvenanceSource`](../../lib/facts/fact-domain.ts#L61-L68).

Status meanings in this table:

- **Current** means the field or access behavior is present in the checked
  code, not that it is public or sufficient for disclosure.
- **Proposed** means a future server-owned mapping described by this document.
- **Unknown** means no direct, semantically safe mapping or public evidence was
  established.

| Formatter input | Display meaning | Canonical candidate and access evidence | Conversion and public-visibility rule | Missing behavior | Status |
| --- | --- | --- | --- | --- | --- |
| `projectionKind` | Protocol marker | No canonical field. It is a formatter contract constant. | The projection constructor emits the exact constant; callers cannot use a raw source object. | Omit the projection and use the generic notice. | Current / Proposed constructor |
| `officialSource.institutionName` | Public name of the external issuer/institution | `source_identities.publisher` is mapped to `SourceIdentity.issuer` by [`mapSourceIdentity`](../../db/fact-repositories.ts#L615-L627). `lawName`, `sourceType`, and `jurisdiction` exist in other models but are not equivalent to an institution display name. There is no general public read that returns an approved institution name. | Use an explicitly public issuer value from the resolved canonical source identity. Do not substitute `lawName`, a type label, a brand, or caller text. | Omit the field; do not invent an institution. | Proposed; public evidence unknown |
| `officialSource.documentTitle` | Title of the cited external document | `source_identities.canonical_label` is mapped to `SourceIdentity.officialTitle` by the fact repository. `curriculumTrees.title`, `ismsStandards.title`, and the legal-article composite title are content/catalog labels, not automatically source titles. | Prefer the canonical source identity title after the target-to-source binding is independently resolved. A content title may be used only under a separately approved semantic contract. | Omit the field; do not synthesize a title from an unrelated content record. | Current canonical field; public mapping proposed |
| `officialSource.sourceUrl` | Display link to the external source | `source_identities` and `assertion_source_bindings` have no URL column. `ismsStandards.sourceUrl`, `legalArticles.sourceUrl`, and `legalArticleVersions.sourceUrl` exist in domain-specific tables; `curriculumTrees.sourceDocument` is an untyped text field, not a URL contract. | A resolver must select a public URL from the authoritative source/version record, then pass it through the formatter. The resolver must separately review sensitive query/path/fragment content and rights; HTTPS alone is insufficient. | Omit the link. Never expose an internal source path or substitute a guessed URL. | Candidate fields current; universal/public mapping unknown |
| `officialSource.editionOrVersion` | External document edition/version | `assertion_source_bindings.source_version` is a direct source-binding value. `curriculumTrees.version`, specialized content `version`, and `contentRevisions.version` are available but describe different objects unless an explicit contract binds them to the source edition. | Use `sourceVersion` when the selected canonical binding defines it as the external edition. Do not silently use content or curriculum version. | Omit the field. | Current canonical candidate; semantic mapping proposed |
| `officialSource.effectiveFrom` | External source applicability start | `temporal_assertions.effective_from` and `curriculumTrees.effectiveFrom` exist. The curriculum tree repository returns its fields. Specialized records commonly have `effectiveDate`; the taxonomy source type also models effective dates, but it is not the same persisted source-identity shape. | Select the date from the record whose meaning is source applicability, not from record modification time or content publication time. | Omit it; do not fill from `updatedAt`, `createdAt`, or a review timestamp. | Candidate fields current; target binding unknown |
| `officialSource.effectiveTo` | External source applicability end | `temporal_assertions.effective_to` and `curriculumTrees.effectiveTo` exist. No universal end-date field is present on `source_identities` or the specialized standard/legal source records. | Map only when the source/version contract defines an end date. Preserve `null`/absence as absence, not as an invented date. | Omit it. | Candidate fields current; universal mapping unknown |
| `officialSource.sourceCheckedAt` | Date Securium checked the external source | No direct source-identity column exists. `FactSourceVerification.verifiedAt` is the closest canonical verification value and is stored within binding verification metadata; `retrievedAt` means retrieval, not human checking. | A future public projection may use a server-owned source verification record only after its semantics and public policy are approved. It must not use `updatedAt`, `publishedAt`, `contentDate`, or `reviewedAt` by name similarity. | Omit it; the formatter keeps the generic notice unless all completion fields exist. | Unknown; proposed only with policy |
| `officialSource.reviewStatus.displayLabel` | Safe public review status text | Fact provenance has `reviewDecision` and structured classification, while content revisions have `revisionStatus`; neither is a public display label. The domain predicate [`sourceVerificationIsAuthorityEligible`](../../lib/facts/fact-domain.ts#L376-L387) is a fact-source eligibility rule, not a public disclosure policy. | Map an independently authorized internal state to a stable public label in a server-owned adapter. Do not pass a raw enum or caller-provided label as proof. | Omit the review object. Do not call the source “approved,” “current,” or “reviewed” by default. | Proposed; public policy unknown |
| `officialSource.reviewStatus.scope` | Scope covered by the review label | `assertion_source_bindings.locator` identifies a provenance location; `temporal_assertions.qualification` qualifies an assertion. Neither is automatically the human-facing scope of a source review. | Create a separate bounded scope value only when the review record defines it. Do not expose raw locators, qualification payloads, or internal notes by default. | Omit the scope while retaining a valid status label, or omit the review object if the status is not valid. | Proposed; unknown |
| `officialSource.reviewedAt` | Date of the relevant review | `content_revisions.reviewedAt`, governed mapping review timestamps, and `FactSourceVerification.verifiedAt` exist with different owners and meanings. [`publishContentRevision`](../../db/content-revision-repositories.ts#L623-L677) sets content revision review and publication timestamps together, but that does not make either a source check date. | Use only a source-review timestamp selected by policy. Keep content review, source verification, and mapping review distinct. | Omit it. | Current candidates; semantic mapping unknown |
| `officialSource.reviewerDisplayRole` | Public role of the responsible reviewer | Canonical models store internal IDs such as `reviewedBy`, `reviewerId`, or `verifiedBy`; no public role projection was found. | Resolve a non-identifying, approved role from a server-owned responsibility record. Never expose an ID, email, or guessed person name. | Omit it. | Proposed; public role policy unknown |
| `securiumExplanation.scope` | Securium's independent explanation scope | No canonical external-source field. The ISE provenance contract can identify `SECURIUM_INDEPENDENT_AUTHORING`, but it is not a display-copy resolver and does not turn Securium text into an official source. | Supply separately authored public copy, bounded as free text and kept under the Securium label. Never derive it by copying or relabeling official source text. | Omit `scope`, or omit the independent explanation if the supplied scope is malformed. | Proposed; no current projection path |

### Repository and public-path findings

The existing code provides several partial read seams, but none is the
formatter's general input resolver:

- [`FactRepository.getFactIdentity`](../../db/fact-repositories.ts#L192-L206),
  [`listAssertionsForFact`](../../db/fact-repositories.ts#L251-L266), and
  [`listSourcesForAssertion`](../../db/fact-repositories.ts#L319-L327) read
  canonical fact data and bindings. `FactRepository` creates source identity
  records but has no general `getSourceIdentity`/public-disclosure method.
- [`readContentRevisionRegistration`](../../db/content-revision-registration-repository.ts#L111-L123)
  joins registration sources to `source_identities`, but returns internal
  registration state and only a limited source identity projection. It is not a
  public route or formatter adapter.
- [`getActiveCurriculumTreeForCourse`](../../db/curriculum-repositories.ts#L272-L284)
  and the published curriculum path functions return curriculum metadata,
  including `sourceDocument` and effective dates. This is curriculum metadata,
  not an authoritative source disclosure.
- [`getLatestPublishedRevision`](../../db/content-revision-repositories.ts#L385-L402)
  and [`getPublicContentRevision`](../../db/content-revision-repositories.ts#L404-L435)
  resolve content revisions, not source identities or source rights.
- [`IseWaveACanonicalRepositoryAdapter.sourceResolver`](../../lib/services/ise-wave-a-canonical-repository-adapter.ts#L75-L107)
  is a narrow, server-owned resolver for one ISE registration flow. It reads
  only source identity ID, canonical key, type, normalized identity, and
  lifecycle, and produces a `WaveASourceBinding`; it does not produce the
  disclosure projection.
- A repository-wide search found no call site for
  `formatPublicSourceDisclosure` outside its implementation and tests. The
  formatter is therefore not currently connected to a resolver, UI, or API.

No runtime data was inspected. The presence of schema columns, repository
selectors, seed literals, or validation success does not establish that a
target source is populated, complete, public, authoritative, current, or
licensed for display.

## 4. Public judgment, free text, and URL responsibilities

### Public judgment authority

The formatter must remain outside the authorization boundary:

```text
caller target identity
  -> server-owned target/content lookup
  -> canonical source binding lookup
  -> source identity/version/verification read
  -> public authorization and rights/currentness policy gate
  -> explicit allowlist projection
  -> pure formatter
  -> renderer with escaping
```

The caller may identify the public target, but must not supply the source URL,
source ID, `published` flag, user ID, review label, or a public-state tag as
authority. The server must determine the canonical target and source relation.

`ACTIVE`, `canonical`, `published`, `isLatest`, validator success, a hash, or
an authenticated source identity is not by itself a public approval. The fact
domain contains a source-authority eligibility predicate, but it is scoped to
canonical fact provenance construction. A separate general public-disclosure
policy is not established here:

```text
PUBLIC_DISCLOSURE_POLICY: NOT_ESTABLISHED
AUTHORIZATION_BOUNDARY: EXTERNAL_TO_FORMATTER
```

A source bound to public content does not make its private notes, review
metadata, internal IDs, personal data, or source count public. The projection
constructor owns the allowlist and should receive only values already cleared
for the requested public target.

### Free text

`institutionName`, `documentTitle`, review labels/scopes, and the independent
explanation are text fields accepted by the formatter. The formatter only
checks type, length, trimming, and control characters. It does not detect,
remove, or prove the absence of PII. Therefore:

- public descriptions and Securium explanations must be authored or cleared
  for public use before projection construction;
- internal notes, raw imported text, reviewer notes, email addresses, user IDs,
  and rights-review material must never be put into the projection;
- an upstream sanitizer, summarizer, or model must not be treated as an
  authorization or rights decision; and
- renderer escaping is still required because formatter validation is not a
  complete XSS defense.

### URL

The canonical models do not provide one universal source URL. A future
resolver must choose a URL associated with the selected source/version, then
pass the value through the formatter's HTTPS and credential checks. That
check does not establish officiality, rights, currentness, redirect safety,
SSRF safety, or domain ownership. No URL fetch, redirect follow, DNS lookup,
or hostname-based institution decision is part of this design.

The resolver's public URL policy must separately decide whether query, path, or
fragment data could contain credentials, tokens, personal data, or private
locators. If that policy cannot be established, omit the URL rather than
guessing or exposing the canonical internal path.

## 5. Date, revision, and review semantics

The following values must not be substituted for one another:

| Value | Established meaning | Disclosure use |
| --- | --- | --- |
| `curriculumTrees.effectiveFrom` / `effectiveTo` | Curriculum tree metadata interval | Candidate curriculum interval only; not automatically source validity. |
| `temporalAssertions.effectiveFrom` / `effectiveTo` | Canonical assertion validity interval | Candidate assertion interval; requires a target-to-assertion relation. |
| `contentRevisions.contentDate` | Content revision's declared date | Content date only; not source publication or source check date. |
| `contentRevisions.version` | Content revision version | Content revision only unless explicitly bound to an external source edition. |
| `contentRevisions.reviewedAt` | Content revision review timestamp | Content review only; not source verification. |
| `contentRevisions.publishedAt` | Content revision publication timestamp | Publication event only; not source approval or currentness. |
| `createdAt` / `updatedAt` | Persistence or record modification timestamps | Record history only; never `sourceCheckedAt`. |
| `assertion_source_bindings.sourceVersion` | Version recorded on a source binding | Best direct candidate for `editionOrVersion`, subject to semantic validation. |
| `FactSourceVerification.verifiedAt` | Source verification timestamp in provenance metadata | Candidate `sourceCheckedAt` or `reviewedAt` only after public policy chooses the exact meaning. |
| `FactSourceVerification.retrievedAt` | Source retrieval timestamp | Retrieval evidence only; never human review. |
| `sourceIdentities.createdAt` | Source identity record creation | Record lifecycle only; not publication, review, or currentness. |
| `reviewedBy` / `verifiedBy` | Internal actor identity reference | Never a public reviewer name or role without a separate public responsibility mapping. |

The formatter currently has no revision ID, source ID, hash, or raw status in
its output. Those values must remain internal evidence and must not be
promoted to “latest,” “approved,” “official,” or “licensed.”

## 6. Missing and error contract

The resolver and the formatter need different error responsibilities. The
formatter intentionally collapses absent, malformed, and unsupported display
input into a safe generic notice. A repository or authorization layer must
not use that behavior to silently classify an operational failure as “no
source.”

| Situation | Internal resolver meaning | User-visible handling | Disclosure constraint |
| --- | --- | --- | --- |
| No source connection for the target | No canonical binding found | Call the formatter without a projection, producing the generic notice | Do not expose a source count or binding absence details. |
| Source record not found or inactive | Canonical relation is broken or source is unavailable | Same safe absence presentation | Do not reveal the private record's ID, existence, or lifecycle reason. |
| Public authority evidence is absent | Source may exist, but public authorization/rights/currentness evidence is not ready | No official reference; generic notice or separately approved neutral copy | Do not label it approved, current, official, or licensed. |
| Only some display fields are absent | A valid partial projection is available | Formatter preserves valid fields and keeps the notice when the complete official tuple is missing | Never fill with dates, names, titles, or approval text. |
| Repository/resolver failure | Operational error, not source absence | Keep the endpoint's safe error behavior and record an internal diagnostic; do not convert it to a successful no-source result | Error details and raw payloads stay out of the disclosure. |
| Malformed projection | Projection contract violation | Formatter returns the generic notice | No coercion, raw object spread, or error payload. |
| Unsupported status/type | No approved public display mapping | Omit the status or entire affected section | Do not display raw enum names or infer their meaning. |
| Private or draft source | Not eligible for this public projection | Same generic absence presentation | No existence, count, ID, URL, internal note, or private error detail. |

The formatter's generic handling is evidenced by [`formatPublicSourceDisclosure`](../../lib/services/public-source-disclosure.ts#L86-L98)
and the malformed/unsupported cases in [`public-source-disclosure.test.ts`](../../tests/public-source-disclosure.test.ts#L37-L202).
The resolver should retain the internal distinction between `ABSENT` and
`ERROR` even though neither private details nor raw errors may reach the
public display.

## 7. Minimal resolver proposal and caller impact

No resolver is implemented by this document. A minimal future seam could be
shaped as follows; the names and signature are proposals, not existing APIs:

```ts
type PublicSourceDisclosureTarget = Readonly<{
  resourceType: string;
  resourceId: string;
}>;

type PublicSourceDisclosureResolution =
  | Readonly<{
      kind: "READY";
      projection: PublicSourceDisclosureProjection;
    }>
  | Readonly<{ kind: "ABSENT" }>
  | Readonly<{ kind: "ERROR"; internalCode: string }>;

resolvePublicSourceDisclosure(
  target: PublicSourceDisclosureTarget,
): Promise<PublicSourceDisclosureResolution>;
```

The proposed flow is:

1. Accept only a server-recognized public resource/content identity. The
   caller does not choose a source record or assert publication.
2. Resolve the canonical content/revision and its source binding through the
   existing canonical repositories or a transaction-scoped facade.
3. Revalidate the target's public accessibility and the source relation. Apply
   an explicitly approved public policy for authority, publication, rights,
   currentness, and any source supersession. Do not reuse a content
   `published` flag as the whole policy.
4. Select the source identity, source version, applicability dates, URL, and
   source-review evidence from their semantically correct canonical records.
   Multiple candidates require a policy-owned deterministic selection; do not
   pick the first row or expose all bindings by default.
5. Construct a fresh projection containing only the formatter input allowlist.
   Exclude IDs, hashes, internal notes, actor identities, raw status enums,
   unreviewed text, private URL components, and unrelated content fields.
6. On `ABSENT`, pass no projection to the formatter. On `ERROR`, preserve an
   operational error path rather than presenting a successful absence. Only a
   `READY` projection is formatted.

The preferred implementation boundary is a dedicated public-projection
service/facade that reuses canonical repository reads. Extending a shared
authenticated/internal repository result with public display fields risks
leaking those fields to callers that do not need them. A dedicated facade also
keeps the formatter's pure contract stable and avoids a second source database,
cache, or authority.

The narrow ISE adapter demonstrates the server-owned lookup pattern, but it is
not a general solution: it resolves a lesson's source identity from an
authoring metadata lookup key and returns only a binding. It must not be
reinterpreted as a public source disclosure resolver.

No migration is justified solely by the formatter. Existing source identity,
binding, verification, curriculum, specialized-source, and content-revision
fields should first be joined under an approved semantic contract. If a
universal URL, source edition dates, source check record, or public reviewer
role cannot be represented without ambiguity, that is a policy/data-model
decision for a later change; it is not permission to add a parallel authority
or to guess a mapping here.

## 8. Unresolved policy/data gaps and follow-up verification plan

The following remain unresolved and intentionally unimplemented:

- There is no general target-to-canonical-source public resolver or formatter
  call site.
- `source_identities` does not itself carry a URL, source version, effective
  interval, source check timestamp, or public reviewer role.
- Domain-specific `sourceUrl`, `version`, `effectiveDate`, `revisionDate`,
  `sourceDate`, and `referenceDate` fields do not form a universal source
  contract and are not proven to be linked to the requested public target.
- The source-authority predicate for canonical fact provenance is not the same
  as public publication, rights, or currentness authorization.
- Actual database population and completeness were not checked.
- The formatter does not scrub PII from allowed free text. Projection creation
  must therefore constrain the source text before calling the formatter.
- Renderer escaping, live API behavior, source URL access, and deployed UI/API
  wiring remain outside this design.

The follow-up implementation should add tests without treating synthetic
fixtures as proof of real source rights or currentness:

1. Ready official projection and independent Securium explanation remain
   separately labeled.
2. No binding, missing source, inactive/private source, and absent public
   evidence produce the same non-disclosing public absence shape; internal
   `ABSENT` versus `ERROR` remains testable without exposing private details.
3. Partial fields preserve only confirmed values and never invent an
   institution, title, date, reviewer, or approval statement.
4. Internal memo, ID, hash, email, user ID, and private-URL sentinels are
   excluded by the projection constructor. The test must not claim that the
   formatter removes PII from an allowed title or explanation.
5. URL tests cover HTTPS, credentials, relative and unsupported schemes, and
   sensitive path/query/fragment policy at the resolver boundary. The
   formatter test alone must not claim officiality or SSRF protection.
6. `updatedAt`, content date, publication date, source applicability date,
   revision, verification date, and review date remain distinct.
7. Repository failure, malformed projection, unsupported status, and throwing
   source reads do not expose raw URL, payload, ID, or internal error text.
8. The final public projection contains no internal source ID/count and is
   created from the selected canonical target rather than caller-supplied
   publication or user-state fields.

```text
SOURCE_RESOLVER_INTEGRATION: NOT_IMPLEMENTED
PUBLIC_UI_API_WIRING: NOT_ENABLED
SOURCE_RIGHTS_AND_CURRENTNESS_VALIDATION: NOT_RUN
DATABASE_EXECUTION_THIS_GOAL: NOT_RUN
LIVE_API_EVALUATION: NOT_RUN
PERSONAL_EVIDENCE_ACCESS: OUT_OF_SCOPE
CANONICAL_MUTATION: NONE
```

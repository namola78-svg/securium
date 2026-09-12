# 공개 페이지 출처·검수·최신성 표시 설계

작성 기준일: 2026-09-12
검토 기준: `origin/main` `e039eb5195cb7b62f6ad0315ba3b909c043bd8ab`

## 1. 범위와 판단 원칙

검토 범위는 저장소에서 공개 페이지로 구현된 다음 route의 source와 서버 공개 projection이다.

- `/` — 홈
- `/courses` — 공개 과정 목록
- `/courses/{courseSlug}` — 게시된 과정 상세
- `/about` — 서비스 소개
- `/guide` — 공개 학습 가이드

기존 discovery 보고서의 live 관찰은 당시의 `402 Payment Required / DEPLOYMENT_DISABLED` 상태로 보존한다. 이번 문서는 live HTML, robots, sitemap, 검색 색인 또는 AI 노출을 다시 확인하지 않았다. 따라서 아래 내용은 저장소에서 확인한 구현 계약이며, 실제 배포 화면의 보증이 아니다.

주요 근거 파일: [`app/page.tsx`](../../app/page.tsx), [`app/about/page.tsx`](../../app/about/page.tsx), [`app/guide/page.tsx`](../../app/guide/page.tsx), [`app/courses/page.tsx`](../../app/courses/page.tsx), [`app/courses/[courseSlug]/page.tsx`](../../app/courses/%5BcourseSlug%5D/page.tsx), [`components/course-card.tsx`](../../components/course-card.tsx), [`db/repositories.ts`](../../db/repositories.ts), [`db/schema.ts`](../../db/schema.ts), [`db/content-revision-repositories.ts`](../../db/content-revision-repositories.ts)

표시 원칙은 다음과 같다.

1. `active`·`published`·`updatedAt`·validator/test 성공은 각각 공개 상태, 게시 상태, 저장소 레코드 수정 시각, 기술 검증 결과일 뿐이다. 이 값을 공식 자료의 최신성·내용 검수·사용권 승인으로 확장하지 않는다.
2. 확인되지 않은 값은 임의의 날짜, 검수자, 판, 링크, `최신`, `검수 완료`로 채우지 않는다.
3. 공식 원문과 Securium의 독립 설명은 별도 블록과 별도 문구로 구분한다.
4. 출처 링크나 hash가 있어도 사용권, 기관의 보증, 기관의 Securium 승인으로 표현하지 않는다.

## 2. 공개 문구와 저장소 근거 대조

| 페이지·위치 | 현재 공개 문구 | 저장소에서 확인되는 근거 | 부족하거나 확인되지 않은 근거 | 판단 |
| --- | --- | --- | --- | --- |
| 홈 metadata 및 hero (`app/page.tsx:20-22`, `130-142`) | `공식 기준 기반 커리큘럼`, `공식 기준 기반`, `검수된 해설 우선` | 홈이 `listPublishedCoursesCached()`를 사용하고, 과정·커리큘럼·문제·AI 보조 학습 흐름을 설명한다. | 어떤 기관의 어떤 자료인지, 원문 링크·판·적용 기간·확인일, 공개 책임 주체가 이 화면에 없다. `검수된`을 course-level로 증명하는 public projection도 없다. | 서비스 방향 설명은 유지할 수 있다. 세부 콘텐츠가 실제 검수 상태를 가진 경우에만 배지를 강화하고, 그렇지 않으면 `공식 기준 기반`을 Securium의 설계 설명으로 명확화한다. |
| 홈 신뢰 section (`app/page.tsx:251-266`, `305`) | `검수된 콘텐츠와 출처를 중심에 두고`, `검수 상태 확인`, `공식 기준 기반` | 공식 답안을 AI가 대체하지 않는다는 역할 구분과 공개 과정 연결은 source에 있다. | 출처 목록, 검수 상태, 검수일, 검수 책임 주체가 이 section에서 조회·표시되지 않는다. | 구현 전에는 구체적인 검수 완료 신호로 사용을 보류한다. 향후에는 짧은 안내만 두고 상세 페이지의 실제 상태로 연결한다. |
| 소개 (`app/about/page.tsx:11`, `15`) | `공식 커리큘럼과 연결된 이론·문제`, `AI 설명은 근거와 한계를 구분` | 소개 page가 서비스 목표와 AI가 공식 채점 결과를 대신하지 않는 범위를 설명한다. | 소개 문구와 특정 공식 자료·과정·revision의 연결이 없다. | 서비스 설명으로 유지한다. 특정 자료를 공식 승인본처럼 읽히게 하는 문구는 source block 없이는 추가하지 않는다. |
| 가이드 metadata와 단계 (`app/guide/page.tsx:7`, `14`, `46-48`) | `공식 기준과 함께 확인`, `공식 커리큘럼 순서`, `공식 콘텐츠와 채점 결과를 보완` | 과정 선택, `listCurriculum()`이 제공하는 subject/topic 순서, 문제·복습·AI 보조 흐름은 source에 있다. | 해당 커리큘럼이 어떤 공식 자료의 어느 판인지, 원문 URL과 확인일은 public route에서 공급되지 않는다. | 학습 방법 안내로 유지한다. `공식 기준을 반영했다`와 `공식 원문 최신판을 확인했다`를 구분한다. |
| 과정 목록 (`app/courses/page.tsx:51-69`, `components/course-card.tsx:14-29`) | `공개된 과정 정보`, `학습 가능`, `개설 예정` | `listPublishedCourses()`가 active·published·삭제되지 않은 과정군/과정을 조회하고 이름, 설명, 유형, 난이도, 카운트 등을 반환한다. 카드 상태는 active·published와 콘텐츠 count로 계산된다. | 기관·자료명·원문 링크·판·적용 기준·검토자·source 확인일은 카드 projection에 없다. 목록의 `published`/카드의 `학습 가능`은 공개·학습 준비 상태이지 공식 최신성이나 검수 승인이 아니다. | 기존 상태 문구는 기능 상태로 유지한다. 카드에는 실제 source 계약이 완성된 경우에만 짧은 source summary를 추가한다. |
| 과정 상세 metadata와 핵심 정보 (`app/courses/[courseSlug]/page.tsx:15-18`, `40-52`) | `최근 업데이트`, `합격 기준`, `커리큘럼`, `공개 주제 수`·`공개 문제 수` | `CourseListItem`과 상세 projection에 과정 설명, 합격 기준, count, `updatedAt`, subject/topic이 있다. canonical은 `/courses/${course.slug}`로 생성되고 root metadata의 `metadataBase`를 따른다. | `updatedAt`은 course 레코드 수정 시각이며 공식 기준 확인일이 아니다. source institution/title/link/version, 적용 기간, 콘텐츠 검수 상태·책임 주체가 상세 page에 없다. | `최근 업데이트`는 과정 정보 수정 시각으로 한정한다. 상세에 출처·검토 disclosure를 둘 수 있지만 빈 값을 `최신` 또는 `검수 완료`로 대체하지 않는다. |
| 공통 metadata (`app/layout.tsx:54-81`) | `시큐리움 | SECURIUM`, `정보보안과 개인정보보호 전문가를 위한 AI 학습 플랫폼` | 요청/configured origin, title template, description, Open Graph/Twitter metadata 생성 계약이 있다. | 공통 brand metadata는 출처·검수·최신성의 근거가 아니다. 실제 live canonical·HTML 응답은 이번 범위에서 확인하지 않았다. | 기존 metadata 생성 방식은 보존한다. 신뢰 표시를 공통 description에 억지로 넣지 않는다. |

`validator`나 test의 성공은 위 문구가 기술적으로 렌더링·검증 가능하다는 근거일 수는 있어도, 원자료의 정확성·사용권·최신성 승인 또는 사람의 내용 검수를 뜻하지 않는다.

## 3. 현재 공급 가능한 데이터와 추가 계약

### 3.1 현재 공개 route가 직접 공급하는 필드

`CourseListItem` (`db/repositories.ts:40-60`) 및 공개 과정 repository projection에서 다음은 현재 화면에 안전하게 연결할 수 있는 값이다.

| 목적 | 현재 필드 | 사용자 표시의 한계 |
| --- | --- | --- |
| 과정 식별 | `name`, `shortName`, `code`, `slug`, `groupName` | 공식 기관·자료의 식별자가 아니다. |
| Securium 설명 | `description`, 난이도, 예상 단계, 합격 기준 | Securium이 작성한 과정 설명으로 표시해야 하며 원문 요약·공식 문구로 가장하지 않는다. |
| 공개·게시 상태 | `active`, `published`, 삭제되지 않은 active group 조건 | `공개됨` 또는 `게시된 과정`에만 사용한다. `최신`, `공식 승인`, `검수 완료`로 번역하지 않는다. |
| 제공량 | `subjectCount`, `topicCount`, `questionCount`, 실제 subject/topic 목록 | 현재 공개 projection의 개수와 목록이다. 공식 범위의 완전성이나 최신성을 뜻하지 않는다. |
| 과정 레코드 수정 | `updatedAt` | `과정 정보 업데이트`로만 표시한다. `공식 기준 확인일`과 분리한다. |
| URL/metadata | slug 기반 상세 URL, `metadataBase`, 상세 canonical 생성 | URL 생성 근거이지 source citation은 아니다. |

### 3.2 저장소에는 있으나 공개 page에 연결되지 않은 값

현재 schema에는 일부 provenance·revision 후보가 존재하지만, 우선 공개 page의 course projection에 연결되어 있지 않다.

- `curriculumTrees`: `title`, `version`, `sourceType`, `sourceDocument`, `effectiveFrom`, `effectiveTo`, `status` (`db/schema.ts`의 curriculum tree 정의)
- `contentRevisions`: `contentDate`, `version`, `revisionStatus`, `reviewedAt`, `reviewedBy`, `publishedAt`, `isLatest`, `semanticHash`, `humanReviewHash` (`db/schema.ts:1230` 이후)
- `getLatestPublishedRevision()`은 특정 content type/id에 대해 `published`이고 `isLatest`인 revision을 읽을 수 있다 (`db/content-revision-repositories.ts:385-402`). 이는 현재 public course page가 사용하는 source contract가 아니다.

`sourceDocument`가 있다는 이유만으로 사용자에게 검증된 URL이라고 가정하지 않는다. `reviewedBy`는 내부 사용자 ID reference이므로 그대로 공개 검수자 이름이나 책임 주체로 표시하지 않는다. 위 값들을 course 또는 curriculum에 연결하는 authoritative mapping도 이 검토에서 확인하지 않았다.

### 3.3 추가로 확보해야 하는 최소 public contract

실제 표시 전에 과정 또는 표시 대상 revision에 대해 다음 read model 계약이 필요하다.

```text
publicSource:
  institutionName       // 공개 가능한 출처 기관명
  documentTitle         // 자료명
  sourceUrl             // 검증된 원문 링크; 없으면 null
  editionOrVersion      // 판/버전/적용 기준
  effectiveFrom         // 시행·적용 시작일; 확인되지 않으면 null
  effectiveTo           // 종료일; 확인되지 않으면 null
  sourceCheckedAt       // Securium이 출처를 확인한 날짜
  reviewStatus           // 사용자 문구로 매핑되는 서버 권위 상태
  reviewedAt             // 실제 내용 검토일
  reviewerDisplayRole    // 공개 가능한 책임 주체 또는 역할
  explanationScope       // 원문과 Securium 설명의 관계
```

이는 새 schema·source registry·manifest를 이번 작업에서 추가하자는 뜻이 아니다. 실제 구현 전 해당 필드의 권위 저장 위치, course/content와의 연결, 공개 가능성, source 변경 시 갱신 책임을 먼저 승인해야 한다. `UNKNOWN`은 빈 문자열이나 `최신`으로 매핑하지 않는다.

## 4. 표시 위치별 최소 설계

### 홈

홈에는 모든 출처 필드를 반복하지 않는다. 신뢰 section에 한 줄짜리 안내만 둔다.

> 공식 자료와 Securium의 학습 설명을 구분해 표시합니다. 자세한 출처와 검토 정보는 과정 상세에서 확인하세요.

이 문구는 실제 상세 disclosure가 구현된 뒤에만 사용한다. 상세 contract가 아직 없으면 현재의 `검수 상태 확인`은 기능 방향 설명으로 두고, 검수 완료를 보장하는 badge로 사용하지 않는다.

### 과정 목록과 카드

카드에는 다음 정도만 표시한다.

- 과정명·분류·기능 상태: 기존 표시를 유지
- source contract가 완전히 있는 경우: `공식 자료: [기관명] · [자료명]`
- source contract가 없거나 일부만 있는 경우: `출처 정보 준비 중`
- 상세의 `출처·검토 정보`로 이동하는 링크 또는 disclosure affordance

판, 확인일, 검수자, 원문 링크를 모든 카드에 반복하지 않는다. 카드에 `최신`, `공식 인증`, `검수 완료`를 정적으로 넣지 않는다.

### 과정 상세

설명·커리큘럼과 별도로 `출처·검토 정보` section 또는 disclosure를 둔다.

1. **공식 자료**: 기관명, 자료명, 판/버전, 적용 기준, 원문 링크, Securium 확인일
2. **Securium 검토**: 공개 가능한 검토 상태, 검토일, 승인된 책임 주체/역할
3. **Securium 설명의 범위**: 원문 인용·요약인지, 독립 설명인지, 공식 원문을 대체하지 않는다는 안내
4. 값이 없는 항목: `확인되지 않음`, `출처 링크 준비 중`, `검토 정보 준비 중` 중 실제 상태에 맞는 문구

기존 `최근 업데이트`는 별도로 두고, source 확인일과 합치지 않는다. 상세 canonical과 URL 생성은 현재 metadata 계약을 그대로 보존한다.

### 소개와 공개 가이드

소개와 가이드는 서비스의 역할·학습 흐름만 설명한다. 과정별 source table을 복제하지 않고 다음 정도의 범위 안내만 둘 수 있다.

> Securium은 공식 자료를 참고해 학습용 설명과 문제를 제공하며, 원문·공식 채점·법률 또는 보안 판단을 대신하지 않습니다. 과정별 출처와 검토 정보가 제공되는 경우 과정 상세에서 확인할 수 있습니다.

이 문구 역시 실제로 source/review disclosure가 제공되는 시점에 적용한다. 확인되지 않은 기관이나 검수 책임 주체를 소개 page에 지정하지 않는다.

## 5. 사용자 문구 예시

아래 예시는 현재 DB의 실제 값을 채운 결과가 아니다. 대괄호 값은 승인된 데이터가 확보된 뒤에만 치환한다.

### 필요한 필드가 모두 확인된 상태

```text
공식 자료: [기관명] · [자료명]
적용 기준: [판/버전] · [시행일]
출처 확인일: [YYYY-MM-DD]
Securium 검토: [공개 가능한 책임 주체/역할] · [YYYY-MM-DD]
Securium 설명: 공식 원문을 바탕으로 한 학습용 설명이며 원문 자체를 대체하지 않습니다.
```

### 출처는 있으나 Securium 검토 정보가 없는 상태

```text
공식 자료: [기관명] · [자료명] · 원문 보기
검토 상태: Securium 검토 정보 확인 필요
```

이 상태에는 `검수 완료`, `최신`, `공식 승인`을 표시하지 않는다.

### source 또는 최신성 근거가 없는 상태

```text
출처·검토 정보 준비 중
이 콘텐츠의 공식 최신 여부는 이 화면에서 확인되지 않습니다.
```

### 실제 검토 중인 상태

서버 권위 데이터가 실제로 `검토 중`을 나타낼 때만 다음처럼 표시한다.

```text
Securium 검토 중
공식 원문과 적용 기준을 확인한 뒤 공개 정보가 갱신됩니다.
```

내부 enum이나 raw ID를 그대로 노출하지 않고, 상태별 사용자 문구를 별도 매핑한다. `superseded` 같은 내부 상태도 실제 public policy가 정해지기 전에는 자동으로 `구버전` 또는 `최신 아님`으로 번역하지 않는다.

## 6. 구현 시 필요한 최소 변경 후보

실제 구현 단계에서만 다음 범위를 검토한다.

1. **서버 read projection**: 기존 과정 조회와 별도로 승인된 public source/review read model을 추가하거나 기존 repository projection에 안전하게 연결한다. raw user ID·내부 enum·초안 상태를 직접 화면에 전달하지 않는다.
2. **과정 카드/상세**: `components/course-card.tsx`, `app/courses/page.tsx`, `app/courses/[courseSlug]/page.tsx`에 compact summary와 상세 disclosure를 연결한다.
3. **공개 copy**: `app/page.tsx`, `app/about/page.tsx`, `app/guide/page.tsx`의 `공식 기준`, `검수된`, `출처` 문구를 실제 공급 상태에 맞게 한정한다.
4. **표시 스타일·검증**: 기존 design-system 스타일을 재사용하고, source/review 값이 없는 경우의 rendering assertion만 추가한다.

이번 문서 작업에서는 위 파일과 schema, migration, dependency, workflow, canonical registry, source-claims, manifest를 변경하지 않는다. sitemap·robots·auth·redirect·navigation 및 #144의 availability/학습 UX도 변경 대상이 아니다.

## 7. 확보되지 않은 근거

- 각 공개 과정에 대응하는 공식 기관명·자료명·원문 URL
- 자료의 판/버전과 실제 적용 시작·종료 기준
- Securium이 원문을 확인한 날짜와 확인 방법
- 과정·커리큘럼·개별 콘텐츠와 source/revision의 권위 있는 연결
- 공개 가능한 검수 상태, 검토일, 책임 주체 또는 팀 역할
- source 변경·supersession·재검토를 public 표시로 전파하는 운영 책임
- 출처 링크·hash 사용에 대한 실제 사용권 및 기관 보증 여부
- live 배포에서 위 source projection이 정상 응답하는지에 대한 근거

내부 초안, ISRM draft, ontology/manifest metadata, validator 결과를 공개 출처·검수 승인으로 승격하지 않는다.

## 8. 후속 구현 완료 조건

다음 조건이 모두 충족될 때만 공개 표시 구현을 완료로 본다.

- public source/review read model과 권위 저장 위치가 승인됨
- 실제 공개 대상마다 기관·자료명·링크·판/적용 기준·확인일의 존재 여부가 명시됨
- source와 Securium 설명의 범위가 화면에서 분리됨
- `검수 완료`·`최신`·책임 주체 문구가 실제 서버 상태와 매핑됨
- 값이 없는 상태가 `UNKNOWN`/준비 중으로 안전하게 표시되고 낙관적 문구로 대체되지 않음
- 과정 카드의 요약과 상세 disclosure가 같은 source snapshot을 사용함
- source link/hash가 사용권·기관 보증을 의미하지 않는다는 안내가 유지됨
- focused rendering/projection 검증과 문서·운영 책임 인계가 완료됨
- 실제 배포 후 HTML과 source disclosure를 확인하는 별도 검증이 완료됨

PUBLIC_DEPLOYMENT_VERIFICATION: NOT_RUN
INDEXING_STATUS: UNKNOWN
AI_VISIBILITY_MEASUREMENT: NOT_RUN

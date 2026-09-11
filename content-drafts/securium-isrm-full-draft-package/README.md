# ISRM full review draft package

This directory is an integration guide for the 12 Securium ISRM learning-unit draft packages published in this review-only Draft PR.

## Authority boundary

The Foundation confirms five ISRM subject identities and the reviewed q01-q30 authority relation. The official subject identities are metadata anchors only; the 12-unit decomposition, titles, objectives, theory, examples, questions, and explanations below are Securium independent pedagogical content. They are not official detailed unit titles, official objectives, official question wording, exam-prediction claims, or canonical learner content.

Every package remains:

- `status`: `DRAFT_UNPUBLISHED_REVIEW_REQUIRED`
- `sourceExpressionReuse`: `0`
- `officialQuestionReconstruction`: `0`
- `canonicalApproval`: `NOT_REQUESTED`
- `revisionBinding`: `NOT_ISSUED`
- `publication`: `NOT_AUTHORIZED`
- `runtimeImport`: `NONE`

Permission for expression reuse, detailed official scope/version, source binding, currentness beyond the reviewed evidence, canonical approval, and publication remain unresolved. Source hash parity is evidence of file identity, not a use-rights grant.

## Coverage

- Units: 12/12
- Objectives: 24 (two per unit)
- Theory records: 12 (one per unit)
- Questions: q01-q30, 30/30
- Source-claim records: 60 (five per package)
- Unit validators: 12/12 PASS at the source checkpoint
- Draft tests plus Foundation authority test: 25/25 PASS at the source checkpoint
- Runtime draft import/reference: 0

## Unit catalogue

The complete objective wording is in each package's `objectives.json`. The table gives the stable IDs and the review scope.

| Unit | Securium draft title | Objectives and learning focus | Questions |
|---|---|---|---|
| `isrm-2025-2027-s01-u01` | 정보보호 관리의 이해: 보호대상과 요구사항 | `O01` 보호대상·정보자산 범위와 근거; `O02` CIA 요구사항·담당자·의무를 위험판단과 구분 | q01, q02, q27 |
| `isrm-2025-2027-s01-u02` | 정보자산 대장과 보호 우선순위 | `O01` 자산대장·역할·근거; `O02` 가치·영향·위협·취약성·통제 근거와 우선순위 | q03, q04 |
| `isrm-2025-2027-s01-u03` | 정보보호 관리체계의 생명주기 운영 | `O01` 정책·시행문서·승인·재검토; `O02` 교육 운영·효과 증거·개선 | q05, q06 |
| `isrm-2025-2027-s02-u01` | 위험평가 방법론과 관리계획의 설계 | `O01` 범위·목표·자원에 따른 방법 선택; `O02` 평가 관리계획·증거·재검토 | q07, q08, q29 |
| `isrm-2025-2027-s02-u02` | 자산·위협·취약성에서 종합 위험평가로 | `O01` 자산·위협·취약성·위험 진술; `O02` 중요도·가능성·취약점·준거성·목표수준·증거 | q09, q10, q11 |
| `isrm-2025-2027-s03-u01` | 위험 처리전략과 보호대책 구현 | `O01` 감소·회피·전가·수용 전략; `O02` 담당자·일정·예산·증거·효과성 확인 | q12, q13, q14, q28 |
| `isrm-2025-2027-s03-u02` | 보호대책을 운영 맥락에 정착시키기 | `O01` 조직·제공자 책임·통지·증거 경계; `O02` 적용 요구사항·대책·검증 증거 | q15, q16 |
| `isrm-2025-2027-s03-u03` | 구현 결과를 이행점검과 개선으로 연결하기 | `O01` 완료·정확성·효과성의 운영 증거; `O02` 지연·미이행·증거부족의 개선 연결 | q17, q18, q30 |
| `isrm-2025-2027-s03-u04` | 정보보호산업 적용 보호대책을 맥락에 맞게 점검하기 | `O01` 산업 법·제도와 적용범위·적합성; `O02` 서비스 범위 변경의 의무·역할·증거·잔여위험 | q19, q20 |
| `isrm-2025-2027-s04-u01` | 위험관리 계획을 반복 가능한 관리체계 운영으로 정착시키기 | `O01` 범위·책임·주기·방법·증거·재검토 운영계획; `O02` 담당자 변경의 운영공백·이력 | q21, q22 |
| `isrm-2025-2027-s04-u02` | 변화에 맞춰 위험평가를 갱신하고 결과를 운영에 연결하기 | `O01` 목적·범위·방법·평가 입력·목표수준; `O02` 변화 시 전제·입력·불확실성·후속경로 갱신 | q23, q24 |
| `isrm-2025-2027-s05-u01` | 평가된 위험을 보호대책으로 전환하고 잔여위험을 계속 관리하기 | `O01` 평가 결과를 대책 방향·이행계획·책임·검토로 전환; `O02` 구현증거·현재성·효과성·잔여위험·후속조치 | q25, q26 |

## Intentional related-question links

The Foundation marks q27, q28, q29, and q30 with related-unit relations in addition to a primary learning-unit owner. The draft payload preserves primary ownership without duplicating question ownership:

- q27 primary `s01-u01`, related `s02-u02`
- q28 primary `s03-u01`, related `s05-u01`
- q29 primary `s02-u01`, related `s04-u02`
- q30 primary `s03-u03`, related `s04-u02`

These are intentional cross-unit learning links, not duplicate canonical question bodies.

## Exact published file scope

The PR contains this guide plus exactly:

- 72 package files: six files per unit under `content-drafts/securium-isrm-sXX-uYY-authoring/`: `README.md`, `manifest.json`, `objectives.json`, `theory.json`, `questions.json`, `source-claims.json`.
- 12 validators: `scripts/validate-securium-isrm-s01-u01-draft.mjs` through `scripts/validate-securium-isrm-s05-u01-draft.mjs` for the listed units.
- 12 tests: matching `tests/securium-isrm-sXX-uYY-draft.test.mjs` files.

The PR does not contain source PDFs/images, commercial source packages, personal-path files, temporary logs, runtime adapters, database changes, migrations, canonical authority changes, or publication records. Existing per-unit reports remain in their source worktrees and are not overwritten.

## Review commands

From the repository root:

```powershell
Get-ChildItem scripts -Filter 'validate-securium-isrm-s*-u*-draft.mjs' |
  Sort-Object Name |
  ForEach-Object { node $_.FullName }

node scripts/validate-securium-isrm-foundation-product-authority.mjs

$tests = Get-ChildItem tests -Filter 'securium-isrm-s*-u*-draft.test.mjs' |
  Sort-Object Name |
  Select-Object -ExpandProperty FullName
node --test @tests tests/securium-isrm-foundation-product-authority.test.mjs
```

Expected reviewed result is 12/12 unit validators and 25/25 draft/Foundation tests. These are review gates only; passing them does not register or publish the packages at runtime.

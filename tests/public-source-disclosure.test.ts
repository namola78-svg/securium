import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPublicSourceDisclosure,
  PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE,
  PUBLIC_SOURCE_DISCLOSURE_PROJECTION_KIND,
  type PublicSourceDisclosureProjection,
} from "../lib/services/public-source-disclosure.ts";

function projection(
  officialSource: Record<string, unknown> | null = {
    institutionName: "National Standards Body",
    documentTitle: "Public Security Standard",
    sourceUrl: "https://standards.example/public-security-standard",
    editionOrVersion: "2026 edition",
    effectiveFrom: "2026-01-01",
    effectiveTo: "2028-12-31",
    sourceCheckedAt: "2026-09-12",
    reviewStatus: {
      displayLabel: "Securium 확인 상태가 제공됨",
      scope: "원문과 적용 기준에 대한 공개 확인 범위",
    },
    reviewedAt: "2026-09-12",
    reviewerDisplayRole: "공개 검토 책임 역할",
  },
  securiumExplanation: Record<string, unknown> | null = {
    scope: "Securium의 독립 설명이며 공식 원문을 대체하지 않음",
  },
): PublicSourceDisclosureProjection {
  return {
    projectionKind: PUBLIC_SOURCE_DISCLOSURE_PROJECTION_KIND,
    officialSource,
    securiumExplanation,
  } as PublicSourceDisclosureProjection;
}

test("absent public projection returns only the generic missing-information notice", () => {
  assert.deepEqual(formatPublicSourceDisclosure(undefined), {
    officialReference: null,
    independentExplanation: null,
    notice: PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE,
  });
});

test("valid official projection returns the allowlisted fields and distinct explanation", () => {
  const result = formatPublicSourceDisclosure(projection());

  assert.deepEqual(result, {
    officialReference: {
      kind: "OFFICIAL_REFERENCE",
      label: "공식 참고 자료",
      institutionName: "National Standards Body",
      documentTitle: "Public Security Standard",
      sourceUrl: "https://standards.example/public-security-standard",
      editionOrVersion: "2026 edition",
      effectiveFrom: "2026-01-01",
      effectiveTo: "2028-12-31",
      sourceCheckedAt: "2026-09-12",
      review: {
        statusLabel: "Securium 확인 상태가 제공됨",
        scope: "원문과 적용 기준에 대한 공개 확인 범위",
        reviewedAt: "2026-09-12",
        reviewerDisplayRole: "공개 검토 책임 역할",
      },
    },
    independentExplanation: {
      kind: "SECURIUM_INDEPENDENT_EXPLANATION",
      label: "Securium 독립 설명",
      scope: "Securium의 독립 설명이며 공식 원문을 대체하지 않음",
    },
    notice: null,
  });
});

test("partial projection preserves confirmed fields without inventing missing values", () => {
  const result = formatPublicSourceDisclosure(
    projection({ institutionName: "Known Institution", documentTitle: "Known Document" }, null),
  );

  assert.deepEqual(result, {
    officialReference: {
      kind: "OFFICIAL_REFERENCE",
      label: "공식 참고 자료",
      institutionName: "Known Institution",
      documentTitle: "Known Document",
    },
    independentExplanation: null,
    notice: PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE,
  });
  assert.equal("sourceCheckedAt" in (result.officialReference ?? {}), false);
  assert.equal("sourceUrl" in (result.officialReference ?? {}), false);
});

test("independent explanation is never labeled as an official institution source", () => {
  const result = formatPublicSourceDisclosure(
    projection(null, { scope: "Independent explanation scope" }),
  );

  assert.deepEqual(result.independentExplanation, {
    kind: "SECURIUM_INDEPENDENT_EXPLANATION",
    label: "Securium 독립 설명",
    scope: "Independent explanation scope",
  });
  assert.equal(result.officialReference, null);
  assert.equal(result.notice, PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE);
});

test("updatedAt, published, validator success, and hash do not become review or currentness claims", () => {
  const result = formatPublicSourceDisclosure(
    projection({
      updatedAt: "2026-09-12T00:00:00.000Z",
      published: true,
      validatorPassed: true,
      sourceHash: "a".repeat(64),
    }, null),
  );

  assert.deepEqual(result, {
    officialReference: null,
    independentExplanation: null,
    notice: PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE,
  });
  assert.doesNotMatch(JSON.stringify(result), /최신|검수 완료|공식 승인|validator|sourceHash/);
});

test("raw private or draft-shaped source data is not accepted without the public projection shape", () => {
  const result = formatPublicSourceDisclosure({
    id: "private-source-id",
    title: "Private draft source",
    status: "DRAFT",
    sourceUrl: "https://private.example/draft",
    internalNote: "PRIVATE_SENTINEL",
  });

  assert.deepEqual(result, {
    officialReference: null,
    independentExplanation: null,
    notice: PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE,
  });
  assert.doesNotMatch(JSON.stringify(result), /private-source-id|PRIVATE_SENTINEL|private\.example/);
});

test("extra fields, internal notes, private URLs, and personal identifiers are never copied", () => {
  const result = formatPublicSourceDisclosure(
    projection({
      institutionName: "Public Institution",
      documentTitle: "Public Document",
      sourceCheckedAt: "2026-09-12",
      sourceUrl: "https://public.example/document",
      sourceId: "SOURCE_ID_SENTINEL",
      sourceHash: "HASH_SENTINEL",
      internalNote: "INTERNAL_NOTE_SENTINEL",
      privateUrl: "https://private.example/record",
      reviewerEmail: "reviewer@example.invalid",
      userId: "USER_ID_SENTINEL",
    }, null),
  );

  assert.deepEqual(Object.keys(result.officialReference ?? {}).sort(), [
    "documentTitle",
    "institutionName",
    "kind",
    "label",
    "sourceCheckedAt",
    "sourceUrl",
  ]);
  assert.doesNotMatch(
    JSON.stringify(result),
    /SOURCE_ID_SENTINEL|HASH_SENTINEL|INTERNAL_NOTE_SENTINEL|private\.example|reviewer@example|USER_ID_SENTINEL/,
  );
});

test("malformed field types and unsupported raw review states are omitted", () => {
  const result = formatPublicSourceDisclosure(
    projection({
      institutionName: 42,
      documentTitle: ["not-a-title"],
      sourceUrl: { href: "https://example.invalid" },
      sourceCheckedAt: "not-a-date",
      reviewStatus: "COMPLETED",
      reviewedAt: true,
      reviewerDisplayRole: { name: "internal-user" },
    }, { scope: 99 }),
  );

  assert.deepEqual(result, {
    officialReference: null,
    independentExplanation: null,
    notice: PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE,
  });
});

test("only HTTPS URLs without credentials are returned as display links", () => {
  const rejectedUrls = [
    "http://example.com/source",
    "javascript:alert(1)",
    "data:text/plain,source",
    "file:///private/source",
    "ftp://example.com/source",
    "https://user:password@example.com/source",
  ];

  for (const sourceUrl of rejectedUrls) {
    const result = formatPublicSourceDisclosure(
      projection({
        institutionName: "Institution",
        documentTitle: "Document",
        sourceUrl,
        sourceCheckedAt: "2026-09-12",
      }, null),
    );
    assert.equal(result.officialReference?.sourceUrl, undefined, sourceUrl);
  }

  const accepted = formatPublicSourceDisclosure(
    projection({
      institutionName: "Institution",
      documentTitle: "Document",
      sourceUrl: "https://example.com/source",
      sourceCheckedAt: "2026-09-12",
    }, null),
  );
  assert.equal(accepted.officialReference?.sourceUrl, "https://example.com/source");
});

test("input is not mutated and equal inputs produce deterministic output", () => {
  const input = projection();
  const before = JSON.stringify(input);
  const first = formatPublicSourceDisclosure(input);
  const second = formatPublicSourceDisclosure(input);

  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(first, second);
  assert.notStrictEqual(first, input);
});

test("formatter errors do not expose raw payload or internal error text", () => {
  const input = {
    projectionKind: PUBLIC_SOURCE_DISCLOSURE_PROJECTION_KIND,
  } as Record<string, unknown>;
  Object.defineProperty(input, "officialSource", {
    get() {
      throw new Error("INTERNAL_SOURCE_PAYLOAD_SENTINEL");
    },
  });

  const result = formatPublicSourceDisclosure(input);
  assert.deepEqual(result, {
    officialReference: null,
    independentExplanation: null,
    notice: PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE,
  });
  assert.doesNotMatch(JSON.stringify(result), /INTERNAL_SOURCE_PAYLOAD_SENTINEL/);
});

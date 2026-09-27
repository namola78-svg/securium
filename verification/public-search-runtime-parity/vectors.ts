export const VECTOR_SET_VERSION = "public-search-runtime-parity.v1";

export type Oracle =
  | Readonly<{ kind: "value"; value: string }>
  | Readonly<{ kind: "boolean"; value: boolean }>
  | Readonly<{ kind: "number"; value: number }>
  | Readonly<{ kind: "error"; name: "TypeError" | "RangeError" }>;

export type RuntimeParityVector = Readonly<{
  id: string;
  operation:
    | "normalize-text"
    | "normalize-query"
    | "projection"
    | "projection-contains"
    | "id-order-key"
    | "versions";
  input?: unknown;
  query?: unknown;
  expected: Oracle;
}>;

const asciiA48Input =
  "aaaaaaaaaaaaaaaa" + "aaaaaaaaaaaaaaaa" + "aaaaaaaaaaaaaaaa";
const asciiA48Oracle =
  "aaaaaaaaaaaaaaaa" + "aaaaaaaaaaaaaaaa" + "aaaaaaaaaaaaaaaa";
const asciiF48 = "ffffffffffffffff" + "ffffffffffffffff" + "ffffffffffffffff";

export const CONTRACT_ORACLE = Object.freeze({
  comparisonVersion: "public-course-search.comparison.v2",
  normalizerVersion: "public-course-search.normalizer.nfkc-trim-ko-lower.v1",
  idOrderKeyVersion: "public-course-search.id-order.utf16-code-unit-hex.v1",
  maxQueryBytes: 48,
});

export const vectors: readonly RuntimeParityVector[] = [
  {
    id: "versions",
    operation: "versions",
    expected: { kind: "number", value: 48 },
  },
  {
    id: "normalize-ascii-korean-and-trim",
    operation: "normalize-text",
    input: "  ABC \uACF5\uAC04  ",
    expected: { kind: "value", value: "abc \uACF5\uAC04" },
  },
  {
    id: "normalize-fullwidth",
    operation: "normalize-text",
    input: " \uFF26\uFF35\uFF2C\uFF2C\uFF37\uFF29\uFF24\uFF34\uFF28 ",
    expected: { kind: "value", value: "fullwidth" },
  },
  {
    id: "normalize-composed-and-decomposed-e-acute",
    operation: "normalize-text",
    input: "Cafe\u0301",
    expected: { kind: "value", value: "caf\u00E9" },
  },
  {
    id: "normalize-compatibility-characters",
    operation: "normalize-text",
    input:
      "\uFF11\uFF23\uFF2F\uFF2D\uFF30\uFF21\uFF34\uFF29\uFF22\uFF29\uFF2C\uFF29\uFF34\uFF39",
    expected: { kind: "value", value: "1compatibility" },
  },
  {
    id: "normalize-unicode-space-and-trim",
    operation: "normalize-text",
    input: "\u00A0  Caf\u00E9 \u3000",
    expected: { kind: "value", value: "caf\u00E9" },
  },
  {
    id: "normalize-literal-like-pattern-characters",
    operation: "normalize-text",
    input: "Literal 100%_\\value",
    expected: { kind: "value", value: "literal 100%_\\value" },
  },
  {
    id: "normalize-preserves-internal-consecutive-spaces",
    operation: "normalize-text",
    input: "  Alpha  Beta  ",
    expected: { kind: "value", value: "alpha  beta" },
  },
  {
    id: "normalize-case-expansion",
    operation: "normalize-text",
    input: "\u0130",
    expected: { kind: "value", value: "i\u0307" },
  },
  {
    id: "query-omitted-is-empty",
    operation: "normalize-query",
    input: undefined,
    expected: { kind: "value", value: "" },
  },
  {
    id: "query-empty-is-empty",
    operation: "normalize-query",
    input: "",
    expected: { kind: "value", value: "" },
  },
  {
    id: "query-exactly-48-ascii-bytes",
    operation: "normalize-query",
    input: asciiA48Input,
    expected: { kind: "value", value: asciiA48Oracle },
  },
  {
    id: "query-49-ascii-bytes-rejected",
    operation: "normalize-query",
    input: asciiA48Input + "a",
    expected: { kind: "error", name: "RangeError" },
  },
  {
    id: "query-fullwidth-normalizes-before-byte-limit",
    operation: "normalize-query",
    input: "\uFF26".repeat(48),
    expected: { kind: "value", value: asciiF48 },
  },
  {
    id: "query-case-expansion-exactly-48-utf8-bytes",
    operation: "normalize-query",
    input: "\u0130".repeat(16),
    expected: {
      kind: "value",
      value:
        "i\u0307i\u0307i\u0307i\u0307i\u0307i\u0307i\u0307i\u0307" +
        "i\u0307i\u0307i\u0307i\u0307i\u0307i\u0307i\u0307i\u0307",
    },
  },
  {
    id: "query-case-expansion-over-48-utf8-bytes",
    operation: "normalize-query",
    input: "\u0130".repeat(17),
    expected: { kind: "error", name: "RangeError" },
  },
  {
    id: "query-korean-exactly-48-utf8-bytes",
    operation: "normalize-query",
    input: "\uAC00".repeat(16),
    expected: {
      kind: "value",
      value:
        "\uAC00\uAC00\uAC00\uAC00\uAC00\uAC00\uAC00\uAC00" +
        "\uAC00\uAC00\uAC00\uAC00\uAC00\uAC00\uAC00\uAC00",
    },
  },
  {
    id: "query-korean-over-48-utf8-bytes",
    operation: "normalize-query",
    input: "\uAC00".repeat(17),
    expected: { kind: "error", name: "RangeError" },
  },
  {
    id: "projection-fixed-five-field-order",
    operation: "projection",
    input: {
      name: "Alpha",
      shortName: "Beta",
      groupName: "Gamma",
      publicDescription: "Delta",
      audienceLabel: "Epsilon",
    },
    expected: { kind: "value", value: "alpha beta gamma delta epsilon" },
  },
  {
    id: "projection-empty-middle-field-boundary",
    operation: "projection",
    input: {
      name: "Alpha",
      shortName: "",
      groupName: "Gamma",
      publicDescription: "Delta",
      audienceLabel: "Epsilon",
    },
    expected: { kind: "value", value: "alpha  gamma delta epsilon" },
  },
  {
    id: "projection-preserves-field-internal-spacing",
    operation: "projection",
    input: {
      name: "Alpha  Beta",
      shortName: "",
      groupName: "Gamma",
      publicDescription: "Delta",
      audienceLabel: "Epsilon",
    },
    expected: { kind: "value", value: "alpha  beta  gamma delta epsilon" },
  },
  {
    id: "projection-stored-value-has-no-query-byte-cap",
    operation: "projection",
    input: {
      name: "\uAC00".repeat(17),
      shortName: "short",
      groupName: "group",
      publicDescription: "description",
      audienceLabel: "audience",
    },
    expected: {
      kind: "value",
      value:
        "\uAC00\uAC00\uAC00\uAC00\uAC00\uAC00\uAC00\uAC00\uAC00" +
        "\uAC00\uAC00\uAC00\uAC00\uAC00\uAC00\uAC00\uAC00" +
        " short group description audience",
    },
  },
  {
    id: "projection-query-inside-field",
    operation: "projection-contains",
    input: {
      name: "Alpha",
      shortName: "Beta",
      groupName: "Gamma",
      publicDescription: "Delta",
      audienceLabel: "Epsilon",
    },
    query: "alpha",
    expected: { kind: "boolean", value: true },
  },
  {
    id: "projection-query-cannot-cross-field-boundary",
    operation: "projection-contains",
    input: {
      name: "Alpha",
      shortName: "Beta",
      groupName: "Gamma",
      publicDescription: "Delta",
      audienceLabel: "Epsilon",
    },
    query: "alphabeta",
    expected: { kind: "boolean", value: false },
  },
  {
    id: "projection-query-empty-middle-exact-boundary",
    operation: "projection-contains",
    input: {
      name: "Alpha",
      shortName: "",
      groupName: "Gamma",
      publicDescription: "Delta",
      audienceLabel: "Epsilon",
    },
    query: "alpha  gamma",
    expected: { kind: "boolean", value: true },
  },
  {
    id: "projection-query-literal-pattern-characters",
    operation: "projection-contains",
    input: {
      name: "Literal 100%_\\value",
      shortName: "",
      groupName: "",
      publicDescription: "",
      audienceLabel: "",
    },
    query: "100%_\\value",
    expected: { kind: "boolean", value: true },
  },
  {
    id: "id-order-ascii-upper",
    operation: "id-order-key",
    input: "A",
    expected: { kind: "value", value: "0041" },
  },
  {
    id: "id-order-ascii-lower",
    operation: "id-order-key",
    input: "a",
    expected: { kind: "value", value: "0061" },
  },
  {
    id: "id-order-korean",
    operation: "id-order-key",
    input: "\uD55C",
    expected: { kind: "value", value: "D55C" },
  },
  {
    id: "id-order-non-bmp-valid-pair",
    operation: "id-order-key",
    input: "\u{10000}",
    expected: { kind: "value", value: "D800DC00" },
  },
  {
    id: "id-order-bmp-boundary",
    operation: "id-order-key",
    input: "\uE000",
    expected: { kind: "value", value: "E000" },
  },
  {
    id: "id-order-prefix",
    operation: "id-order-key",
    input: "same",
    expected: { kind: "value", value: "00730061006D0065" },
  },
  {
    id: "id-order-prefix-with-nul-length",
    operation: "id-order-key",
    input: "same\u0000",
    expected: { kind: "value", value: "00730061006D00650000" },
  },
  {
    id: "id-order-nul",
    operation: "id-order-key",
    input: "\u0000",
    expected: { kind: "value", value: "0000" },
  },
  {
    id: "id-order-empty-rejected",
    operation: "id-order-key",
    input: "",
    expected: { kind: "error", name: "RangeError" },
  },
  {
    id: "id-order-high-surrogate-rejected",
    operation: "id-order-key",
    input: "\uD800",
    expected: { kind: "error", name: "RangeError" },
  },
  {
    id: "id-order-low-surrogate-rejected",
    operation: "id-order-key",
    input: "\uDC00",
    expected: { kind: "error", name: "RangeError" },
  },
  {
    id: "id-order-reversed-surrogates-rejected",
    operation: "id-order-key",
    input: "\uDC00\uD800",
    expected: { kind: "error", name: "RangeError" },
  },
  {
    id: "id-order-surrogate-in-middle-rejected",
    operation: "id-order-key",
    input: "valid\uD800id",
    expected: { kind: "error", name: "RangeError" },
  },
  {
    id: "id-order-non-string-rejected",
    operation: "id-order-key",
    input: 123,
    expected: { kind: "error", name: "TypeError" },
  },
] as const;

import {
  PUBLIC_COURSE_SEARCH_ID_ORDER_KEY_VERSION,
  PUBLIC_COURSE_SEARCH_NORMALIZER_VERSION,
} from "../../lib/services/public-course-search-comparison.ts";
import type {
  PublicSearchNormalizedProjectionDigestInput,
  PublicSearchSourceDigestInput,
} from "./serialization.ts";

export const NORMALIZER_VERSION = PUBLIC_COURSE_SEARCH_NORMALIZER_VERSION;
export const ORDER_KEY_VERSION = PUBLIC_COURSE_SEARCH_ID_ORDER_KEY_VERSION;
export const PROJECTION_VERSION =
  "public-course-search.projection.five-fields.v1" as const;
export const SERIALIZATION_VERSION =
  "public-course-search.digest-serialization.v1" as const;

export const RUNTIME_METADATA = {
  node: "node-22.13.0",
  icu: "icu-75.1",
  unicode: "unicode-15.1",
} as const;

export const BASE_SOURCE_INPUT = {
  courseId: "course-1",
  courseGroupId: "group-1",
  name: "Network Basics",
  shortName: "Net",
  groupName: "Security",
  sourceDescription: "Learn safely",
  sourceDifficulty: "BEGINNER",
  publicDescriptionRuleVersion: "public-copy.v1",
  audienceLabelRuleVersion: "audience-label.v1",
  normalizerVersion: NORMALIZER_VERSION,
  projectionVersion: PROJECTION_VERSION,
} as const satisfies PublicSearchSourceDigestInput;

export const BASE_PROJECTION_INPUT = {
  courseId: "course-1",
  courseGroupId: "group-1",
  projectionParts: {
    name: "Network Basics",
    shortName: "Net",
    groupName: "Security",
    publicDescription: "Learn safely",
    audienceLabel: "Beginner",
  },
  normalizerVersion: NORMALIZER_VERSION,
  orderKeyVersion: ORDER_KEY_VERSION,
  projectionVersion: PROJECTION_VERSION,
} as const satisfies PublicSearchNormalizedProjectionDigestInput;

const wire = (...lines: string[]) => lines.join("\n") + "\n";

const SOURCE_MINIMUM_WIRE = wire(
  "format=public-course-search.digest-serialization.v1",
  "purpose=source-input",
  "field-count=14",
  "0\tcourse.id\tstring\tpresent\t8\t636f757273652d31",
  "1\tcourse.groupId\tstring\tpresent\t7\t67726f75702d31",
  "2\tcourse.name\tstring\tpresent\t14\t4e6574776f726b20426173696373",
  "3\tcourse.shortName\tstring\tpresent\t3\t4e6574",
  "4\tgroup.name\tstring\tpresent\t8\t5365637572697479",
  "5\tcourse.description\tstring\tpresent\t12\t4c6561726e20736166656c79",
  "6\tcourse.difficulty\tstring\tpresent\t8\t424547494e4e4552",
  "7\tdisplay.publicDescriptionRuleVersion\tstring\tpresent\t14\t7075626c69632d636f70792e7631",
  "8\tdisplay.audienceLabelRuleVersion\tstring\tpresent\t17\t61756469656e63652d6c6162656c2e7631",
  "9\tsearch.normalizerVersion\tstring\tpresent\t53\t7075626c69632d636f757273652d7365617263682e6e6f726d616c697a65722e6e666b632d7472696d2d6b6f2d6c6f7765722e7631",
  "10\tsearch.projectionVersion\tstring\tpresent\t46\t7075626c69632d636f757273652d7365617263682e70726f6a656374696f6e2e666976652d6669656c64732e7631",
  "11\truntime.node\tstring\tomitted\t0\t",
  "12\truntime.icu\tstring\tomitted\t0\t",
  "13\truntime.unicode\tstring\tomitted\t0\t",
);

const SOURCE_EMPTY_WIRE = wire(
  "format=public-course-search.digest-serialization.v1",
  "purpose=source-input",
  "field-count=14",
  "0\tcourse.id\tstring\tpresent\t8\t636f757273652d31",
  "1\tcourse.groupId\tstring\tpresent\t7\t67726f75702d31",
  "2\tcourse.name\tstring\tpresent\t0\t",
  "3\tcourse.shortName\tstring\tpresent\t0\t",
  "4\tgroup.name\tstring\tpresent\t0\t",
  "5\tcourse.description\tstring\tpresent\t0\t",
  "6\tcourse.difficulty\tstring\tpresent\t0\t",
  "7\tdisplay.publicDescriptionRuleVersion\tstring\tpresent\t14\t7075626c69632d636f70792e7631",
  "8\tdisplay.audienceLabelRuleVersion\tstring\tpresent\t17\t61756469656e63652d6c6162656c2e7631",
  "9\tsearch.normalizerVersion\tstring\tpresent\t53\t7075626c69632d636f757273652d7365617263682e6e6f726d616c697a65722e6e666b632d7472696d2d6b6f2d6c6f7765722e7631",
  "10\tsearch.projectionVersion\tstring\tpresent\t46\t7075626c69632d636f757273652d7365617263682e70726f6a656374696f6e2e666976652d6669656c64732e7631",
  "11\truntime.node\tstring\tomitted\t0\t",
  "12\truntime.icu\tstring\tomitted\t0\t",
  "13\truntime.unicode\tstring\tomitted\t0\t",
);

const SOURCE_WHITESPACE_WIRE = wire(
  "format=public-course-search.digest-serialization.v1",
  "purpose=source-input",
  "field-count=14",
  "0\tcourse.id\tstring\tpresent\t8\t636f757273652d31",
  "1\tcourse.groupId\tstring\tpresent\t7\t67726f75702d31",
  "2\tcourse.name\tstring\tpresent\t1\t20",
  "3\tcourse.shortName\tstring\tpresent\t3\t4e6574",
  "4\tgroup.name\tstring\tpresent\t8\t5365637572697479",
  "5\tcourse.description\tstring\tpresent\t12\t4c6561726e20736166656c79",
  "6\tcourse.difficulty\tstring\tpresent\t8\t424547494e4e4552",
  "7\tdisplay.publicDescriptionRuleVersion\tstring\tpresent\t14\t7075626c69632d636f70792e7631",
  "8\tdisplay.audienceLabelRuleVersion\tstring\tpresent\t17\t61756469656e63652d6c6162656c2e7631",
  "9\tsearch.normalizerVersion\tstring\tpresent\t53\t7075626c69632d636f757273652d7365617263682e6e6f726d616c697a65722e6e666b632d7472696d2d6b6f2d6c6f7765722e7631",
  "10\tsearch.projectionVersion\tstring\tpresent\t46\t7075626c69632d636f757273652d7365617263682e70726f6a656374696f6e2e666976652d6669656c64732e7631",
  "11\truntime.node\tstring\tomitted\t0\t",
  "12\truntime.icu\tstring\tomitted\t0\t",
  "13\truntime.unicode\tstring\tomitted\t0\t",
);

const SOURCE_DELIMITER_WIRE = wire(
  "format=public-course-search.digest-serialization.v1",
  "purpose=source-input",
  "field-count=14",
  "0\tcourse.id\tstring\tpresent\t8\t69647c0a09225c00",
  "1\tcourse.groupId\tstring\tpresent\t6\teab7b8eba3b9",
  "2\tcourse.name\tstring\tpresent\t6\t417c420a225c",
  "3\tcourse.shortName\tstring\tpresent\t0\t",
  "4\tgroup.name\tstring\tpresent\t6\t477c0a225c00",
  "5\tcourse.description\tstring\tpresent\t1\t44",
  "6\tcourse.difficulty\tstring\tpresent\t10\t646966666963756c7479",
  "7\tdisplay.publicDescriptionRuleVersion\tstring\tpresent\t7\t636f70792e7631",
  "8\tdisplay.audienceLabelRuleVersion\tstring\tpresent\t11\t61756469656e63652e7631",
  "9\tsearch.normalizerVersion\tstring\tpresent\t53\t7075626c69632d636f757273652d7365617263682e6e6f726d616c697a65722e6e666b632d7472696d2d6b6f2d6c6f7765722e7631",
  "10\tsearch.projectionVersion\tstring\tpresent\t46\t7075626c69632d636f757273652d7365617263682e70726f6a656374696f6e2e666976652d6669656c64732e7631",
  "11\truntime.node\tstring\tomitted\t0\t",
  "12\truntime.icu\tstring\tomitted\t0\t",
  "13\truntime.unicode\tstring\tomitted\t0\t",
);

const PROJECTION_MINIMUM_WIRE = wire(
  "format=public-course-search.digest-serialization.v1",
  "purpose=normalized-projection",
  "field-count=10",
  "0\tcourse.id\tstring\tpresent\t8\t636f757273652d31",
  "1\tcourse.groupId\tstring\tpresent\t7\t67726f75702d31",
  "2\tsearch.normalizedProjection\tstring\tpresent\t49\t6e6574776f726b20626173696373206e6574207365637572697479206c6561726e20736166656c7920626567696e6e6572",
  "3\tsearch.idOrderKey\tstring\tpresent\t32\t3030363330303646303037353030373230303733303036353030324430303331",
  "4\tsearch.normalizerVersion\tstring\tpresent\t53\t7075626c69632d636f757273652d7365617263682e6e6f726d616c697a65722e6e666b632d7472696d2d6b6f2d6c6f7765722e7631",
  "5\tsearch.orderKeyVersion\tstring\tpresent\t52\t7075626c69632d636f757273652d7365617263682e69642d6f726465722e75746631362d636f64652d756e69742d6865782e7631",
  "6\tsearch.projectionVersion\tstring\tpresent\t46\t7075626c69632d636f757273652d7365617263682e70726f6a656374696f6e2e666976652d6669656c64732e7631",
  "7\truntime.node\tstring\tomitted\t0\t",
  "8\truntime.icu\tstring\tomitted\t0\t",
  "9\truntime.unicode\tstring\tomitted\t0\t",
);

const PROJECTION_COMPOSED_WIRE = wire(
  "format=public-course-search.digest-serialization.v1",
  "purpose=normalized-projection",
  "field-count=10",
  "0\tcourse.id\tstring\tpresent\t8\t636f757273652d31",
  "1\tcourse.groupId\tstring\tpresent\t7\t67726f75702d31",
  "2\tsearch.normalizedProjection\tstring\tpresent\t31\t636166c3a92073686f72742067726f757020646573632061756469656e6365",
  "3\tsearch.idOrderKey\tstring\tpresent\t32\t3030363330303646303037353030373230303733303036353030324430303331",
  "4\tsearch.normalizerVersion\tstring\tpresent\t53\t7075626c69632d636f757273652d7365617263682e6e6f726d616c697a65722e6e666b632d7472696d2d6b6f2d6c6f7765722e7631",
  "5\tsearch.orderKeyVersion\tstring\tpresent\t52\t7075626c69632d636f757273652d7365617263682e69642d6f726465722e75746631362d636f64652d756e69742d6865782e7631",
  "6\tsearch.projectionVersion\tstring\tpresent\t46\t7075626c69632d636f757273652d7365617263682e70726f6a656374696f6e2e666976652d6669656c64732e7631",
  "7\truntime.node\tstring\tomitted\t0\t",
  "8\truntime.icu\tstring\tomitted\t0\t",
  "9\truntime.unicode\tstring\tomitted\t0\t",
);

const PROJECTION_UNICODE_WIRE = wire(
  "format=public-course-search.digest-serialization.v1",
  "purpose=normalized-projection",
  "field-count=10",
  "0\tcourse.id\tstring\tpresent\t7\t69647c0a225c00",
  "1\tcourse.groupId\tstring\tpresent\t6\teab7b8eba3b9",
  "2\tsearch.normalizedProjection\tstring\tpresent\t27\t617c620a225c20ed959ceab88020f090808020c3a920255f5c5c00",
  "3\tsearch.idOrderKey\tstring\tpresent\t28\t30303639303036343030374330303041303032323030354330303030",
  "4\tsearch.normalizerVersion\tstring\tpresent\t53\t7075626c69632d636f757273652d7365617263682e6e6f726d616c697a65722e6e666b632d7472696d2d6b6f2d6c6f7765722e7631",
  "5\tsearch.orderKeyVersion\tstring\tpresent\t52\t7075626c69632d636f757273652d7365617263682e69642d6f726465722e75746631362d636f64652d756e69742d6865782e7631",
  "6\tsearch.projectionVersion\tstring\tpresent\t46\t7075626c69632d636f757273652d7365617263682e70726f6a656374696f6e2e666976652d6669656c64732e7631",
  "7\truntime.node\tstring\tomitted\t0\t",
  "8\truntime.icu\tstring\tomitted\t0\t",
  "9\truntime.unicode\tstring\tomitted\t0\t",
);

const SOURCE_RUNTIME_WIRE = SOURCE_MINIMUM_WIRE
  .replace("11\truntime.node\tstring\tomitted\t0\t", "11\truntime.node\tstring\tpresent\t12\t6e6f64652d32322e31332e30")
  .replace("12\truntime.icu\tstring\tomitted\t0\t", "12\truntime.icu\tstring\tpresent\t8\t6963752d37352e31")
  .replace("13\truntime.unicode\tstring\tomitted\t0\t", "13\truntime.unicode\tstring\tpresent\t12\t756e69636f64652d31352e31");

const PROJECTION_RUNTIME_WIRE = PROJECTION_MINIMUM_WIRE
  .replace("7\truntime.node\tstring\tomitted\t0\t", "7\truntime.node\tstring\tpresent\t12\t6e6f64652d32322e31332e30")
  .replace("8\truntime.icu\tstring\tomitted\t0\t", "8\truntime.icu\tstring\tpresent\t8\t6963752d37352e31")
  .replace("9\truntime.unicode\tstring\tomitted\t0\t", "9\truntime.unicode\tstring\tpresent\t12\t756e69636f64652d31352e31");

const SERIALIZATION_V2_WIRE = SOURCE_MINIMUM_WIRE.replace(
  "format=public-course-search.digest-serialization.v1",
  "format=public-course-search.digest-serialization.v2",
);

export type SourceFixedVector = Readonly<{
  name: string;
  input: PublicSearchSourceDigestInput;
  expectedWire: string;
}>;

export const SOURCE_FIXED_VECTORS: readonly SourceFixedVector[] = [
  { name: "source-minimum", input: BASE_SOURCE_INPUT, expectedWire: SOURCE_MINIMUM_WIRE },
  {
    name: "source-key-insertion-order-independent",
    input: {
      projectionVersion: PROJECTION_VERSION,
      normalizerVersion: NORMALIZER_VERSION,
      audienceLabelRuleVersion: "audience-label.v1",
      publicDescriptionRuleVersion: "public-copy.v1",
      sourceDifficulty: "BEGINNER",
      sourceDescription: "Learn safely",
      groupName: "Security",
      shortName: "Net",
      name: "Network Basics",
      courseGroupId: "group-1",
      courseId: "course-1",
    },
    expectedWire: SOURCE_MINIMUM_WIRE,
  },
  {
    name: "source-empty-string-is-present",
    input: {
      ...BASE_SOURCE_INPUT,
      name: "",
      shortName: "",
      groupName: "",
      sourceDescription: "",
      sourceDifficulty: "",
    },
    expectedWire: SOURCE_EMPTY_WIRE,
  },
  {
    name: "source-whitespace-string-is-present",
    input: { ...BASE_SOURCE_INPUT, name: " " },
    expectedWire: SOURCE_WHITESPACE_WIRE,
  },
  {
    name: "source-delimiters-newline-quote-backslash-nul",
    input: {
      ...BASE_SOURCE_INPUT,
      courseId: "id|\u000A\u0009\u0022\u005C\u0000",
      courseGroupId: "\uADF8\uB8F9",
      name: "A|B\u000A\u0022\u005C",
      shortName: "",
      groupName: "G|\u000A\u0022\u005C\u0000",
      sourceDescription: "D",
      sourceDifficulty: "difficulty",
      publicDescriptionRuleVersion: "copy.v1",
      audienceLabelRuleVersion: "audience.v1",
    },
    expectedWire: SOURCE_DELIMITER_WIRE,
  },
  {
    name: "source-runtime-explicit",
    input: { ...BASE_SOURCE_INPUT, runtime: RUNTIME_METADATA },
    expectedWire: SOURCE_RUNTIME_WIRE,
  },
];

export type ProjectionFixedVector = Readonly<{
  name: string;
  input: PublicSearchNormalizedProjectionDigestInput;
  expectedWire: string;
}>;

export const PROJECTION_FIXED_VECTORS: readonly ProjectionFixedVector[] = [
  {
    name: "projection-minimum",
    input: BASE_PROJECTION_INPUT,
    expectedWire: PROJECTION_MINIMUM_WIRE,
  },
  {
    name: "projection-key-insertion-order-independent",
    input: {
      projectionVersion: PROJECTION_VERSION,
      orderKeyVersion: ORDER_KEY_VERSION,
      normalizerVersion: NORMALIZER_VERSION,
      projectionParts: {
        audienceLabel: "Beginner",
        publicDescription: "Learn safely",
        groupName: "Security",
        shortName: "Net",
        name: "Network Basics",
      },
      courseGroupId: "group-1",
      courseId: "course-1",
    },
    expectedWire: PROJECTION_MINIMUM_WIRE,
  },
  {
    name: "projection-runtime-explicit",
    input: { ...BASE_PROJECTION_INPUT, runtime: RUNTIME_METADATA },
    expectedWire: PROJECTION_RUNTIME_WIRE,
  },
  {
    name: "projection-korean-nonbmp-delimiters",
    input: {
      ...BASE_PROJECTION_INPUT,
      courseId: "id|\u000A\u0022\u005C\u0000",
      courseGroupId: "\uADF8\uB8F9",
      projectionParts: {
        name: "A|B\u000A\u0022\u005C",
        shortName: "\uD55C\uAE00",
        groupName: "\uD800\uDC00",
        publicDescription: "\u00E9",
        audienceLabel: "%_\u005C\u005C\u0000",
      },
    },
    expectedWire: PROJECTION_UNICODE_WIRE,
  },
  {
    name: "projection-decomposed",
    input: {
      ...BASE_PROJECTION_INPUT,
      projectionParts: {
        name: "Cafe\u0301",
        shortName: "Short",
        groupName: "Group",
        publicDescription: "Desc",
        audienceLabel: "Audience",
      },
    },
    expectedWire: PROJECTION_COMPOSED_WIRE,
  },
  {
    name: "projection-precomposed",
    input: {
      ...BASE_PROJECTION_INPUT,
      projectionParts: {
        name: "Caf\u00E9",
        shortName: "Short",
        groupName: "Group",
        publicDescription: "Desc",
        audienceLabel: "Audience",
      },
    },
    expectedWire: PROJECTION_COMPOSED_WIRE,
  },
];

export const SOURCE_FIELD_CHANGE_CASES = [
  { name: "course identity", input: { ...BASE_SOURCE_INPUT, courseId: "course-2" } },
  { name: "course group identity", input: { ...BASE_SOURCE_INPUT, courseGroupId: "group-2" } },
  { name: "name", input: { ...BASE_SOURCE_INPUT, name: "Network Advanced" } },
  { name: "shortName", input: { ...BASE_SOURCE_INPUT, shortName: "Adv" } },
  { name: "groupName", input: { ...BASE_SOURCE_INPUT, groupName: "Platform Security" } },
  { name: "source description", input: { ...BASE_SOURCE_INPUT, sourceDescription: "A different source" } },
  { name: "difficulty", input: { ...BASE_SOURCE_INPUT, sourceDifficulty: "ADVANCED" } },
  { name: "public description rule", input: { ...BASE_SOURCE_INPUT, publicDescriptionRuleVersion: "public-copy.v2" } },
  { name: "audience label rule", input: { ...BASE_SOURCE_INPUT, audienceLabelRuleVersion: "audience-label.v2" } },
  { name: "normalizer version", input: { ...BASE_SOURCE_INPUT, normalizerVersion: "normalizer.v2" } },
  { name: "projection version", input: { ...BASE_SOURCE_INPUT, projectionVersion: "projection.v2" } },
] as const;

export const PROJECTION_FIELD_CHANGE_CASES = [
  { name: "course identity", input: { ...BASE_PROJECTION_INPUT, courseId: "course-2" } },
  { name: "course group identity", input: { ...BASE_PROJECTION_INPUT, courseGroupId: "group-2" } },
  {
    name: "name",
    input: {
      ...BASE_PROJECTION_INPUT,
      projectionParts: { ...BASE_PROJECTION_INPUT.projectionParts, name: "Network Advanced" },
    },
  },
  {
    name: "shortName",
    input: {
      ...BASE_PROJECTION_INPUT,
      projectionParts: { ...BASE_PROJECTION_INPUT.projectionParts, shortName: "Adv" },
    },
  },
  {
    name: "groupName",
    input: {
      ...BASE_PROJECTION_INPUT,
      projectionParts: { ...BASE_PROJECTION_INPUT.projectionParts, groupName: "Platform Security" },
    },
  },
  {
    name: "publicDescription",
    input: {
      ...BASE_PROJECTION_INPUT,
      projectionParts: { ...BASE_PROJECTION_INPUT.projectionParts, publicDescription: "A different public copy" },
    },
  },
  {
    name: "audienceLabel",
    input: {
      ...BASE_PROJECTION_INPUT,
      projectionParts: { ...BASE_PROJECTION_INPUT.projectionParts, audienceLabel: "Advanced" },
    },
  },
  { name: "normalizer version", input: { ...BASE_PROJECTION_INPUT, normalizerVersion: "normalizer.v2" } },
  { name: "order-key version", input: { ...BASE_PROJECTION_INPUT, orderKeyVersion: "order-key.v2" } },
  { name: "projection version", input: { ...BASE_PROJECTION_INPUT, projectionVersion: "projection.v2" } },
  { name: "runtime metadata", input: { ...BASE_PROJECTION_INPUT, runtime: RUNTIME_METADATA } },
] as const;

export const INVALID_INPUT_VECTORS = [
  {
    name: "source-missing-required-field",
    purpose: "source",
    input: Object.fromEntries(
      Object.entries(BASE_SOURCE_INPUT).filter(([key]) => key !== "name"),
    ),
    expectedError: "TypeError",
  },
  {
    name: "source-undefined-required-field",
    purpose: "source",
    input: { ...BASE_SOURCE_INPUT, name: undefined },
    expectedError: "TypeError",
  },
  {
    name: "source-null-required-field",
    purpose: "source",
    input: { ...BASE_SOURCE_INPUT, name: null },
    expectedError: "TypeError",
  },
  {
    name: "source-wrong-type",
    purpose: "source",
    input: { ...BASE_SOURCE_INPUT, courseId: 123 },
    expectedError: "TypeError",
  },
  {
    name: "source-additional-field",
    purpose: "source",
    input: { ...BASE_SOURCE_INPUT, extra: "not-bound" },
    expectedError: "TypeError",
  },
  {
    name: "source-malformed-surrogate",
    purpose: "source",
    input: { ...BASE_SOURCE_INPUT, name: "bad\uD800" },
    expectedError: "RangeError",
  },
  {
    name: "source-runtime-null",
    purpose: "source",
    input: { ...BASE_SOURCE_INPUT, runtime: null },
    expectedError: "TypeError",
  },
  {
    name: "source-runtime-undefined",
    purpose: "source",
    input: { ...BASE_SOURCE_INPUT, runtime: undefined },
    expectedError: "TypeError",
  },
  {
    name: "projection-additional-field",
    purpose: "projection",
    input: { ...BASE_PROJECTION_INPUT, extra: "not-bound" },
    expectedError: "TypeError",
  },
  {
    name: "projection-missing-required-field",
    purpose: "projection",
    input: Object.fromEntries(
      Object.entries(BASE_PROJECTION_INPUT).filter(([key]) => key !== "projectionParts"),
    ),
    expectedError: "TypeError",
  },
  {
    name: "projection-undefined-required-field",
    purpose: "projection",
    input: { ...BASE_PROJECTION_INPUT, projectionParts: undefined },
    expectedError: "TypeError",
  },
  {
    name: "projection-null-required-field",
    purpose: "projection",
    input: { ...BASE_PROJECTION_INPUT, projectionParts: null },
    expectedError: "TypeError",
  },
  {
    name: "projection-parts-additional-field",
    purpose: "projection",
    input: {
      ...BASE_PROJECTION_INPUT,
      projectionParts: { ...BASE_PROJECTION_INPUT.projectionParts, extra: "not-bound" },
    },
    expectedError: "TypeError",
  },
  {
    name: "projection-malformed-surrogate",
    purpose: "projection",
    input: {
      ...BASE_PROJECTION_INPUT,
      projectionParts: { ...BASE_PROJECTION_INPUT.projectionParts, publicDescription: "bad\uDC00" },
    },
    expectedError: "RangeError",
  },
] as const;

export const SERIALIZATION_VERSION_CHANGE_VECTOR = {
  input: BASE_SOURCE_INPUT,
  serializationVersion: "public-course-search.digest-serialization.v2",
  expectedWire: SERIALIZATION_V2_WIRE,
} as const;

export const INVALID_SERIALIZATION_VERSION =
  "public-course-search.digest-serialization.v2\ninjected" as const;

export const NAIVE_DELIMITER_COLLISION_VECTOR = {
  left: ["a|b", "c"],
  right: ["a", "b|c"],
  delimiter: "|",
  expectedNaiveWire: "a|b|c",
} as const;

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  PUBLIC_SEARCH_DIGEST_SERIALIZATION_VERSION,
  serializePublicSearchNormalizedProjectionDigestInput,
  serializePublicSearchSourceDigestInput,
} from "../verification/public-search-digest-contract/serialization.ts";
import {
  BASE_PROJECTION_INPUT,
  BASE_SOURCE_INPUT,
  INVALID_SERIALIZATION_VERSION,
  INVALID_INPUT_VECTORS,
  NAIVE_DELIMITER_COLLISION_VECTOR,
  PROJECTION_FIELD_CHANGE_CASES,
  PROJECTION_FIXED_VECTORS,
  RUNTIME_METADATA,
  SERIALIZATION_VERSION_CHANGE_VECTOR,
  SOURCE_FIELD_CHANGE_CASES,
  SOURCE_FIXED_VECTORS,
} from "../verification/public-search-digest-contract/vectors.ts";

function text(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

test("independent source vectors match exact fixed wire strings", () => {
  for (const vector of SOURCE_FIXED_VECTORS) {
    const actual = serializePublicSearchSourceDigestInput(vector.input);
    assert.equal(text(actual), vector.expectedWire, vector.name);
    assert.deepEqual(
      Array.from(actual),
      Array.from(new TextEncoder().encode(vector.expectedWire)),
      vector.name,
    );
  }
});

test("independent normalized-projection vectors match exact fixed wire strings", () => {
  for (const vector of PROJECTION_FIXED_VECTORS) {
    const actual = serializePublicSearchNormalizedProjectionDigestInput(vector.input);
    assert.equal(text(actual), vector.expectedWire, vector.name);
    assert.deepEqual(
      Array.from(actual),
      Array.from(new TextEncoder().encode(vector.expectedWire)),
      vector.name,
    );
  }
});

test("object key insertion order does not affect the selected fixed order", () => {
  const minimum = SOURCE_FIXED_VECTORS.find(
    (vector) => vector.name === "source-minimum",
  );
  const reordered = SOURCE_FIXED_VECTORS.find(
    (vector) => vector.name === "source-key-insertion-order-independent",
  );
  assert.ok(minimum);
  assert.ok(reordered);
  assert.equal(
    text(serializePublicSearchSourceDigestInput(minimum.input)),
    text(serializePublicSearchSourceDigestInput(reordered.input)),
  );

  const projectionMinimum = PROJECTION_FIXED_VECTORS.find(
    (vector) => vector.name === "projection-minimum",
  );
  const projectionReordered = PROJECTION_FIXED_VECTORS.find(
    (vector) => vector.name === "projection-key-insertion-order-independent",
  );
  assert.ok(projectionMinimum);
  assert.ok(projectionReordered);
  assert.equal(
    text(
      serializePublicSearchNormalizedProjectionDigestInput(
        projectionMinimum.input,
      ),
    ),
    text(
      serializePublicSearchNormalizedProjectionDigestInput(
        projectionReordered.input,
      ),
    ),
  );
});

test("each selected source field change changes source bytes", () => {
  const baseline = hex(serializePublicSearchSourceDigestInput(BASE_SOURCE_INPUT));
  for (const vector of SOURCE_FIELD_CHANGE_CASES) {
    assert.notEqual(
      hex(serializePublicSearchSourceDigestInput(vector.input)),
      baseline,
      vector.name,
    );
  }
});

test("each selected projection field or binding change changes projection bytes", () => {
  const baseline = hex(
    serializePublicSearchNormalizedProjectionDigestInput(BASE_PROJECTION_INPUT),
  );
  for (const vector of PROJECTION_FIELD_CHANGE_CASES) {
    assert.notEqual(
      hex(serializePublicSearchNormalizedProjectionDigestInput(vector.input)),
      baseline,
      vector.name,
    );
  }
});

test("empty and whitespace strings are present and distinct from omission, undefined, or null", () => {
  const empty = SOURCE_FIXED_VECTORS.find(
    (vector) => vector.name === "source-empty-string-is-present",
  );
  const whitespace = SOURCE_FIXED_VECTORS.find(
    (vector) => vector.name === "source-whitespace-string-is-present",
  );
  assert.ok(empty);
  assert.ok(whitespace);
  assert.match(empty.expectedWire, /course\.name\tstring\tpresent\t0\t/u);
  assert.match(whitespace.expectedWire, /course\.name\tstring\tpresent\t1\t20/u);
  assert.notEqual(empty.expectedWire, whitespace.expectedWire);

  for (const vector of INVALID_INPUT_VECTORS.filter(
    (candidate) =>
      candidate.name.includes("missing") ||
      candidate.name.includes("undefined") ||
      candidate.name.includes("null"),
  )) {
    const errorClass = vector.expectedError === "RangeError" ? RangeError : TypeError;
    const serializer =
      vector.purpose === "source"
        ? serializePublicSearchSourceDigestInput
        : serializePublicSearchNormalizedProjectionDigestInput;
    assert.throws(() => serializer(vector.input), errorClass, vector.name);
  }
});

test("unsupported root and nested fields are rejected rather than ignored", () => {
  for (const vector of INVALID_INPUT_VECTORS.filter((candidate) =>
    candidate.name.includes("additional"),
  )) {
    const errorClass = vector.expectedError === "RangeError" ? RangeError : TypeError;
    const serializer =
      vector.purpose === "source"
        ? serializePublicSearchSourceDigestInput
        : serializePublicSearchNormalizedProjectionDigestInput;
    assert.throws(() => serializer(vector.input), errorClass, vector.name);
  }
});

test("malformed surrogate inputs are rejected before UTF-8 conversion", () => {
  for (const vector of INVALID_INPUT_VECTORS.filter((candidate) =>
    candidate.name.includes("malformed"),
  )) {
    const errorClass = vector.expectedError === "RangeError" ? RangeError : TypeError;
    const serializer =
      vector.purpose === "source"
        ? serializePublicSearchSourceDigestInput
        : serializePublicSearchNormalizedProjectionDigestInput;
    assert.throws(() => serializer(vector.input), errorClass, vector.name);
  }
});

test("wrong types are rejected without coercion", () => {
  const vector = INVALID_INPUT_VECTORS.find((candidate) =>
    candidate.name === "source-wrong-type",
  );
  assert.ok(vector);
  assert.throws(
    () => serializePublicSearchSourceDigestInput(vector.input),
    TypeError,
  );
});

test("delimiter-only concatenation has a collision that the selected wire separates", () => {
  const naiveLeft = NAIVE_DELIMITER_COLLISION_VECTOR.left.join(
    NAIVE_DELIMITER_COLLISION_VECTOR.delimiter,
  );
  const naiveRight = NAIVE_DELIMITER_COLLISION_VECTOR.right.join(
    NAIVE_DELIMITER_COLLISION_VECTOR.delimiter,
  );
  assert.equal(naiveLeft, NAIVE_DELIMITER_COLLISION_VECTOR.expectedNaiveWire);
  assert.equal(naiveRight, NAIVE_DELIMITER_COLLISION_VECTOR.expectedNaiveWire);

  const left = {
    ...BASE_SOURCE_INPUT,
    name: "ab",
    shortName: "c",
  };
  const right = {
    ...BASE_SOURCE_INPUT,
    name: "a",
    shortName: "b|c",
  };
  assert.notEqual(
    hex(serializePublicSearchSourceDigestInput(left)),
    hex(serializePublicSearchSourceDigestInput(right)),
  );
});

test("raw source and normalized projection have different equivalence boundaries", () => {
  const rawComposed = {
    ...BASE_SOURCE_INPUT,
    sourceDescription: "Caf\u00E9",
  };
  const rawDecomposed = {
    ...BASE_SOURCE_INPUT,
    sourceDescription: "Cafe\u0301",
  };
  assert.notEqual(
    hex(serializePublicSearchSourceDigestInput(rawComposed)),
    hex(serializePublicSearchSourceDigestInput(rawDecomposed)),
  );

  const [projectionDecomposed, projectionPrecomposed] = PROJECTION_FIXED_VECTORS.slice(
    -2,
  );
  assert.equal(
    hex(
      serializePublicSearchNormalizedProjectionDigestInput(
        projectionDecomposed.input,
      ),
    ),
    hex(
      serializePublicSearchNormalizedProjectionDigestInput(
        projectionPrecomposed.input,
      ),
    ),
  );
});

test("serialization version is a header binding and changes the bytes", () => {
  const actual = serializePublicSearchSourceDigestInput(
    SERIALIZATION_VERSION_CHANGE_VECTOR.input,
    {
      serializationVersion:
        SERIALIZATION_VERSION_CHANGE_VECTOR.serializationVersion,
    },
  );
  assert.equal(text(actual), SERIALIZATION_VERSION_CHANGE_VECTOR.expectedWire);
  assert.notEqual(
    text(serializePublicSearchSourceDigestInput(BASE_SOURCE_INPUT)),
    text(actual),
  );
  assert.match(
    text(serializePublicSearchSourceDigestInput(BASE_SOURCE_INPUT)),
    new RegExp(
      "^format=" + PUBLIC_SEARCH_DIGEST_SERIALIZATION_VERSION.replace(".", "\\."),
      "u",
    ),
  );
  assert.throws(
    () =>
      serializePublicSearchSourceDigestInput(BASE_SOURCE_INPUT, {
        serializationVersion: INVALID_SERIALIZATION_VERSION,
      }),
    RangeError,
  );
});

test("runtime metadata is caller-supplied and has an intentional effect", () => {
  const withoutRuntime = serializePublicSearchSourceDigestInput(BASE_SOURCE_INPUT);
  const withRuntime = serializePublicSearchSourceDigestInput({
    ...BASE_SOURCE_INPUT,
    runtime: RUNTIME_METADATA,
  });
  assert.notEqual(hex(withoutRuntime), hex(withRuntime));
  assert.match(text(withRuntime), /runtime\.node\tstring\tpresent/u);
  assert.match(text(withoutRuntime), /runtime\.node\tstring\tomitted/u);
});

test("serialization is deterministic and does not mutate input", () => {
  const input = {
    ...BASE_PROJECTION_INPUT,
    projectionParts: { ...BASE_PROJECTION_INPUT.projectionParts },
  };
  const before = structuredClone(input);
  const first = serializePublicSearchNormalizedProjectionDigestInput(input);
  for (let index = 0; index < 10; index += 1) {
    assert.equal(hex(first), hex(serializePublicSearchNormalizedProjectionDigestInput(input)));
  }
  assert.deepEqual(input, before);
});

test("hash demonstration is derived from bytes and is not a product approval", () => {
  const bytes = serializePublicSearchSourceDigestInput(BASE_SOURCE_INPUT);
  const first = createHash("sha256").update(bytes).digest("hex");
  const second = createHash("sha256").update(bytes).digest("hex");
  assert.equal(first, second);
  assert.equal(first.length, 64);
});

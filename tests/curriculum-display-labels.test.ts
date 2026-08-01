import assert from "node:assert/strict";
import { test } from "node:test";

import { sourcePageLabel } from "../lib/curriculum/display-labels.ts";

test("source page label displays a single PDF page in Korean", () => {
  assert.equal(sourcePageLabel({ sourcePage: 3 }), "PDF 3쪽");
});

test("source page label combines explicit page arrays first", () => {
  assert.equal(
    sourcePageLabel({ sourcePages: [2, 3], pageNumbers: ["4"] }),
    "PDF 2, 3, 4쪽",
  );
});

test("source page label falls back to verification states", () => {
  assert.equal(sourcePageLabel({}), "PDF 페이지 미지정");
  assert.equal(
    sourcePageLabel({ needsPdfVerification: true }),
    "PDF 페이지 확인 필요",
  );
});

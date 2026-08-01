import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizeRecommendationText,
  recommendLinkableContentForNode,
  recommendableContentKey,
  recommendationReasonLabel,
} from "../lib/curriculum/content-recommendations.ts";

const node = {
  nodeType: "TOPIC",
  title: "네트워크 보안 기술",
  officialTitle: "침입탐지 및 방지 시스템",
  description: "방화벽, IDS/IPS, VPN, 로그 분석을 기준으로 보안 통제를 점검한다.",
  officialCode: "ISE-2027-2029-W-02-03",
  path: "필기/네트워크 보안/네트워크 보안 기술",
  metadata: JSON.stringify({
    linkedContent: [{ type: "TOPIC", id: "already-linked" }],
    sourcePage: 3,
  }),
};

const linkableContent = [
  {
    type: "TOPIC",
    id: "already-linked",
    title: "네트워크 보안 기술",
    subtitle: "이미 연결된 항목",
    active: true,
    published: true,
    displayOrder: 1,
  },
  {
    type: "TOPIC",
    id: "ids-ips",
    title: "침입탐지 및 방지 시스템",
    subtitle: "IDS/IPS, 방화벽, VPN 보안 통제",
    active: true,
    published: true,
    displayOrder: 2,
  },
  {
    type: "LESSON",
    id: "network-log",
    title: "네트워크 로그 분석",
    subtitle: "보안 로그와 이상 징후 분석",
    active: true,
    published: true,
    displayOrder: 3,
  },
  {
    type: "LESSON",
    id: "privacy-law",
    title: "개인정보 처리방침",
    subtitle: "개인정보 법령과 고지 의무",
    active: true,
    published: true,
    displayOrder: 4,
  },
];

test("curriculum content recommendations rank official title and keyword matches first", () => {
  const recommendations = recommendLinkableContentForNode({
    node,
    linkableContent,
    linkedKeys: ["TOPIC:already-linked"],
  });

  assert.equal(recommendations[0]?.id, "ids-ips");
  assert.ok(recommendations[0]?.reasons.includes("TITLE_CONTAINS_OFFICIAL_TITLE"));
  assert.ok(recommendations[0]?.reasons.includes("TYPE_MATCH"));
  assert.ok(recommendations[0]?.matchedKeywords.includes("방화벽"));
  assert.ok(
    recommendations.some((recommendation) => recommendation.id === "network-log"),
  );
});

test("curriculum content recommendations exclude already linked content", () => {
  const recommendations = recommendLinkableContentForNode({
    node,
    linkableContent,
    linkedKeys: ["TOPIC:already-linked"],
  });

  assert.equal(
    recommendations.some((recommendation) => recommendation.id === "already-linked"),
    false,
  );
});

test("curriculum content recommendations support stable keys, labels and limits", () => {
  const recommendations = recommendLinkableContentForNode({
    node,
    linkableContent,
    linkedKeys: [],
    limit: 1,
  });

  assert.equal(recommendations.length, 1);
  assert.equal(recommendableContentKey(recommendations[0]), "TOPIC:ids-ips");
  assert.equal(recommendationReasonLabel("KEYWORD_MATCH"), "키워드 일치");
  assert.equal(recommendationReasonLabel("UNKNOWN_REASON"), "UNKNOWN_REASON");
});

test("curriculum content recommendations normalize Korean security terms safely", () => {
  assert.equal(
    normalizeRecommendationText("IDS/IPS, 방화벽·VPN 보안"),
    "ids ips 방화벽 vpn 보안",
  );
});

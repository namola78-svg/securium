export type RecommendableCurriculumNode = {
  nodeType: string;
  title: string;
  description?: string | null;
  officialCode?: string | null;
  officialTitle?: string | null;
  path?: string | null;
  metadata?: string | null;
};

export type RecommendableLinkableContent = {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  active: boolean;
  published: boolean;
  displayOrder: number;
};

export type LinkableContentRecommendation<T extends RecommendableLinkableContent> =
  T & {
    score: number;
    reasons: string[];
    matchedKeywords: string[];
  };

export function recommendLinkableContentForNode<
  T extends RecommendableLinkableContent,
>({
  node,
  linkableContent,
  linkedKeys,
  limit,
  minScore = 16,
}: {
  node: RecommendableCurriculumNode;
  linkableContent: T[];
  linkedKeys?: Iterable<string>;
  limit?: number;
  minScore?: number;
}): Array<LinkableContentRecommendation<T>> {
  const linkedKeySet = new Set(linkedKeys ?? []);
  const nodeTokens = tokenizeRecommendationText(
    [
      node.title,
      node.officialTitle,
      node.description,
      node.officialCode,
      node.path,
      stripLinkedContentMetadata(node.metadata),
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (!nodeTokens.size) return [];

  const recommendations = linkableContent
    .filter((item) => !linkedKeySet.has(recommendableContentKey(item)))
    .map((item) => {
      const itemTokens = tokenizeRecommendationText(
        `${item.title} ${item.subtitle} ${item.type}`,
      );
      const matchedKeywords = [...itemTokens].filter((token) =>
        nodeTokens.has(token),
      );
      const reasons: string[] = [];
      let score = matchedKeywords.length * 12;

      if (matchedKeywords.length) reasons.push("KEYWORD_MATCH");
      if (item.active) {
        score += 4;
        reasons.push("ACTIVE_CONTENT");
      }
      if (item.published || item.type === "SUBJECT" || item.type === "TOPIC") {
        score += 4;
        reasons.push("PUBLISHED_OR_STRUCTURE");
      }
      if (node.nodeType === item.type) {
        score += 10;
        reasons.push("TYPE_MATCH");
      }
      if (
        node.officialTitle &&
        normalizeRecommendationText(item.title).includes(
          normalizeRecommendationText(node.officialTitle),
        )
      ) {
        score += 20;
        reasons.push("TITLE_CONTAINS_OFFICIAL_TITLE");
      }

      return {
        ...item,
        score,
        reasons,
        matchedKeywords,
      };
    })
    .filter((item) => item.score >= minScore)
    .sort(
      (a, b) =>
        b.score - a.score ||
        contentTypeRank(a.type) - contentTypeRank(b.type) ||
        a.displayOrder - b.displayOrder ||
        stableStringCompare(a.title, b.title) ||
        stableStringCompare(a.id, b.id),
    );

  return typeof limit === "number" ? recommendations.slice(0, limit) : recommendations;
}

export function recommendableContentKey(
  item: Pick<RecommendableLinkableContent, "type" | "id">,
) {
  return `${item.type}:${item.id}`;
}

export function recommendationReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    KEYWORD_MATCH: "키워드 일치",
    ACTIVE_CONTENT: "활성 콘텐츠",
    PUBLISHED_OR_STRUCTURE: "공개/구조 콘텐츠",
    TYPE_MATCH: "유형 일치",
    TITLE_CONTAINS_OFFICIAL_TITLE: "공식명 포함",
  };
  return labels[reason] ?? reason;
}

export function normalizeRecommendationText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}/.\-+# ]+/gu, " ")
    .replace(/[+#]/g, " ")
    .replace(/[-/.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const recommendationStopWords = new Set([
  "개념",
  "관리",
  "기술",
  "기준",
  "내용",
  "대응",
  "보안",
  "분석",
  "서비스",
  "시스템",
  "운영",
  "원리",
  "위험",
  "이해",
  "일반",
  "적용",
  "점검",
  "정보",
  "통제",
]);

function tokenizeRecommendationText(value: string) {
  return new Set(
    normalizeRecommendationText(value)
      .split(" ")
      .map((token) => token.trim())
      .filter(
        (token) => token.length >= 2 && !recommendationStopWords.has(token),
      ),
  );
}

function contentTypeRank(type: string) {
  const ranks: Record<string, number> = {
    SUBJECT: 0,
    TOPIC: 1,
    LEARNING_UNIT: 2,
    LESSON: 3,
  };
  return ranks[type] ?? 99;
}

function stableStringCompare(left: string, right: string) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function stripLinkedContentMetadata(metadata: string | null | undefined) {
  if (!metadata) return "";
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    delete parsed.linkedContent;
    return JSON.stringify(parsed);
  } catch {
    return metadata;
  }
}

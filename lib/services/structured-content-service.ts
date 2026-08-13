export type StructuredContentSection = {
  key: string;
  label: string;
  items: string[];
};

export type StructuredLessonContent = {
  criterionId: string;
  sections: StructuredContentSection[];
};

type UnknownRecord = Record<string, unknown>;

const SECTION_LABELS: Record<string, string> = {
  learning_objectives: "학습 목표",
  one_glance: "한눈에 보기",
  official_core: "핵심 요구사항",
  why_needed: "왜 필요한가",
  key_requirements: "주요 요구사항",
  official_failure_case: "미충족 사례",
  additional_practical_case: "실무 사례",
  related_criteria: "관련 기준",
  wrap_up: "핵심 정리",
};

const DISPLAYED_SECTION_KEYS = new Set(Object.keys(SECTION_LABELS));

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function decodeQuotedList(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed as string[];
    }
  } catch {
    // Some imported official-source excerpts use Python-style single-quoted lists.
  }

  const items: string[] = [];
  const pattern = /'((?:\\.|[^'])*)'/g;
  for (const match of trimmed.matchAll(pattern)) {
    items.push(match[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\"));
  }
  return items.length ? items : null;
}

function normalizeValue(value: unknown): string[] {
  if (typeof value === "string") {
    const list = decodeQuotedList(value);
    return (list ?? [value]).map((item) => item.trim()).filter(Boolean);
  }
  if (Array.isArray(value)) return value.flatMap(normalizeValue);
  if (!isRecord(value)) return [];

  return [value.item, value.meaning, value.audit_check].flatMap(normalizeValue);
}

export function parseStructuredLessonContent(body: string): StructuredLessonContent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || typeof parsed.criterionId !== "string" || !isRecord(parsed.sections)) {
    return null;
  }
  const sourceSections = parsed.sections;

  const requestedOrder = Array.isArray(parsed.sourceSectionOrder)
    ? parsed.sourceSectionOrder.filter((key): key is string => typeof key === "string")
    : Object.keys(sourceSections);
  const sections = requestedOrder.flatMap((key) => {
    if (!DISPLAYED_SECTION_KEYS.has(key)) return [];
    const section = sourceSections[key];
    if (!isRecord(section) || section.status !== "done") return [];
    const items = normalizeValue(section.value);
    return items.length ? [{ key, label: SECTION_LABELS[key], items }] : [];
  });

  return sections.length ? { criterionId: parsed.criterionId, sections } : null;
}

export function structuredLessonText(body: string) {
  const parsed = parseStructuredLessonContent(body);
  return parsed?.sections.flatMap((section) => [section.label, ...section.items]).join("\n") ?? null;
}

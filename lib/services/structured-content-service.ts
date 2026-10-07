export type StructuredContentSection = {
  key: string;
  label: string;
  items: string[];
};

export type StructuredLessonContent = ({
  criterionId: string;
  learningUnitId?: never;
  officialSubjectId?: never;
} | {
  criterionId?: never;
  learningUnitId: string;
  officialSubjectId: string;
}) & {
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

const CPPG_TEXT_SECTIONS = {
  definition: "정의",
  purpose: "학습 목적",
  keyLegalOperationalConcept: "핵심 개념",
  scope: "범위",
  importantDistinctions: "중요 구분",
  lifecycle: "라이프사이클",
} as const;
const CPPG_PERSPECTIVE_KEYS = ["controller", "processor", "dataSubject", "complianceManagement"] as const;

function isBoundedText(value: unknown, maxLength = 20_000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isTextList(value: unknown, minimumLength = 1): value is string[] {
  return Array.isArray(value) && value.length >= minimumLength && value.length <= 100 &&
    value.every((item) => isBoundedText(item));
}

function parseCppgContent(payload: UnknownRecord): StructuredLessonContent | null {
  const { learningUnitId, officialSubjectId, objectives, perspectives } = payload;
  const unit = typeof learningUnitId === "string" ? /^S([1-5])-U\d{2}$/.exec(learningUnitId) : null;
  if (
    payload.authority !== "SECURIUM_CPPG_THEORY_AUTHORITY_V1" ||
    !unit || officialSubjectId !== `CPPG-S${unit[1]}` ||
    !isBoundedText(payload.title) ||
    !Object.keys(CPPG_TEXT_SECTIONS).every((key) => isBoundedText(payload[key])) ||
    !isBoundedText(payload.appliedScenario) || !isBoundedText(payload.cppgExamReasoningPoint) ||
    !isTextList(payload.commonMisunderstandings) || !isTextList(payload.coreConcepts, 0) ||
    !isBoundedText(payload.conceptBindingState, 128) ||
    !Array.isArray(objectives) || !objectives.length || objectives.length > 100 ||
    !objectives.every((objective) => isRecord(objective) &&
      isBoundedText(objective.id, 128) && isBoundedText(objective.text)) ||
    !isRecord(perspectives) || Object.keys(perspectives).length !== CPPG_PERSPECTIVE_KEYS.length ||
    !CPPG_PERSPECTIVE_KEYS.every((key) => isBoundedText(perspectives[key]))
  ) return null;

  // Adapt display only: retain literal authority prose and never normalize the
  // CPPG values through the ISMS-P quoted-list/object conventions.
  const section = (key: string, label: string, items: string[]): StructuredContentSection => ({ key, label, items });
  return {
    learningUnitId: learningUnitId as string,
    officialSubjectId: officialSubjectId as string,
    sections: [
      section("objectives", "학습 목표", objectives.map((objective) => objective.text as string)),
      ...Object.entries(CPPG_TEXT_SECTIONS).map(([key, label]) => section(key, label, [payload[key] as string])),
      section("perspectives", "관점", CPPG_PERSPECTIVE_KEYS.map((key) => perspectives[key] as string)),
      section("commonMisunderstandings", "자주 하는 오해", payload.commonMisunderstandings),
      section("appliedScenario", "적용 사례", [payload.appliedScenario]),
      section("cppgExamReasoningPoint", "시험 사고 포인트", [payload.cppgExamReasoningPoint]),
    ],
  };
}

export function parseStructuredLessonContent(body: string): StructuredLessonContent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if ("authority" in parsed || "learningUnitId" in parsed || "officialSubjectId" in parsed) {
    return parseCppgContent(parsed);
  }
  if (typeof parsed.criterionId !== "string" || !isRecord(parsed.sections)) {
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

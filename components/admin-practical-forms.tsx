"use client";

import { useState } from "react";

type Option = { id: string; name: string };
const csv = (value: FormDataEntryValue | null) => String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);

export function AdminPracticalForms({ courses, questions, weaknesses, samples, items, scenarios, nodes }: { courses: Option[]; questions: Option[]; weaknesses: Option[]; samples: Option[]; items: Option[]; scenarios: Option[]; nodes: Option[] }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(body: Record<string, unknown>) {
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/practical-specializations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) { setMessage(payload.error?.message ?? "저장하지 못했습니다. 입력값과 권한을 확인해 주세요."); return; }
      setMessage("저장했습니다. 변경 사항을 반영하고 있습니다.");
      window.setTimeout(() => window.location.reload(), 350);
    } catch { setMessage("네트워크 오류로 저장하지 못했습니다. 잠시 후 다시 시도해 주세요."); }
    finally { setSaving(false); }
  }

  return <div className="admin-specialized-grid" aria-busy={saving}>
    <AdminForm title="보안 약점 분류 · CWE" description="코드 분석에 사용할 약점 분류와 공식 CWE를 등록합니다." onSubmit={(data) => save({ entity: "SECURE_WEAKNESS", code: data.get("code"), name: data.get("name"), category: data.get("category"), description: data.get("description"), language: data.get("language"), cweCode: data.get("cweCode"), risk: data.get("risk"), detectionGuide: data.get("detectionGuide"), remediationGuide: data.get("remediationGuide"), reference: data.get("reference"), version: data.get("version"), active: true })} saving={saving} submitLabel="약점 분류 저장">
      <Field label="식별 코드" name="code" required placeholder="SQL_INJECTION" />
      <Field label="약점 이름" name="name" required />
      <Field label="분류" name="category" required />
      <SelectField label="주요 언어" name="language" options={["COMMON", "Java", "C", "C++", "Python", "JavaScript"]} />
      <Field label="CWE 코드" name="cweCode" required placeholder="CWE-89" />
      <SelectField label="위험도" name="risk" options={["LOW", "MEDIUM", "HIGH", "CRITICAL"]} />
      <Field label="버전" name="version" required defaultValue="DRAFT-1" />
      <TextArea label="설명" name="description" required wide />
      <TextArea label="진단 가이드" name="detectionGuide" required wide />
      <TextArea label="조치 가이드" name="remediationGuide" required wide />
      <Field label="참고" name="reference" defaultValue="내부 작성 학습 콘텐츠" wide />
    </AdminForm>

    <AdminForm title="보안 코드 분석 사례" description="취약 코드, 안전한 예시, 채점에 필요한 기준을 함께 등록합니다." onSubmit={(data) => save({ entity: "SECURE_CODE_SAMPLE", courseId: data.get("courseId"), weaknessId: data.get("weaknessId"), questionId: data.get("questionId"), language: data.get("language"), title: data.get("title"), vulnerableCode: data.get("vulnerableCode"), secureCode: data.get("secureCode"), vulnerableLines: csv(data.get("vulnerableLines")).map(Number), explanation: data.get("explanation"), falsePositivePossible: data.get("falsePositivePossible") === "on", expectedTruePositive: data.get("expectedTruePositive") === "on", callRelation: data.get("callRelation"), executionFlow: data.get("executionFlow"), remediationKeywords: csv(data.get("remediationKeywords")), sourceDate: data.get("sourceDate"), active: true })} saving={saving} submitLabel="코드 사례 저장">
      <SelectField label="과정" name="courseId" options={courses} />
      <SelectField label="보안 약점" name="weaknessId" options={weaknesses} />
      <SelectField label="연결 문제" name="questionId" options={[{ id: "", name: "연결하지 않음" }, ...questions]} />
      <SelectField label="언어" name="language" options={["Java", "C", "C++", "Python", "JavaScript"]} />
      <Field label="제목" name="title" required />
      <Field label="취약 라인" name="vulnerableLines" required placeholder="예: 3,4" hint="쉼표로 여러 줄을 입력합니다." />
      <Field label="기준일" name="sourceDate" type="date" required />
      <Checkbox label="정탐 사례" name="expectedTruePositive" defaultChecked />
      <Checkbox label="오탐 가능성 있음" name="falsePositivePossible" />
      <TextArea label="취약 코드" name="vulnerableCode" required wide code />
      <TextArea label="안전한 코드" name="secureCode" required wide code />
      <TextArea label="해설" name="explanation" required wide />
      <TextArea label="호출 관계" name="callRelation" />
      <TextArea label="실행 흐름" name="executionFlow" />
      <Field label="조치 키워드" name="remediationKeywords" placeholder="검증, 매개변수화" hint="쉼표로 여러 키워드를 입력합니다." wide />
    </AdminForm>

    <AdminForm title="코드 분석 배점 기준" description="코드 분석 답안의 항목별 배점을 설정합니다." onSubmit={(data) => save({ entity: "SECURE_CODE_RULE", sampleId: data.get("sampleId"), lineScore: data.get("lineScore"), weaknessScore: data.get("weaknessScore"), cweScore: data.get("cweScore"), judgmentScore: data.get("judgmentScore"), keywordScore: data.get("keywordScore"), remediationCodeScore: data.get("remediationCodeScore"), maximumScore: data.get("maximumScore") })} saving={saving} submitLabel="채점 기준 저장">
      <SelectField label="분석 사례" name="sampleId" options={samples} wide />
      {[ ["lineScore", "취약 라인 점수", 30], ["weaknessScore", "약점 유형 점수", 20], ["cweScore", "CWE 점수", 15], ["judgmentScore", "정탐·오탐 판단 점수", 15], ["keywordScore", "조치 키워드 점수", 15], ["remediationCodeScore", "수정 코드 점수", 5], ["maximumScore", "최대 점수", 100] ].map(([name, label, value]) => <Field key={String(name)} label={String(label)} name={String(name)} type="number" min={0} defaultValue={String(value)} />)}
    </AdminForm>

    <AdminForm title="영향평가 항목" description="개인정보 영향평가 답안에서 확인할 체크포인트를 등록합니다." onSubmit={(data) => save({ entity: "PRIVACY_ITEM", code: data.get("code"), category: data.get("category"), title: data.get("title"), description: data.get("description"), checkPoints: data.get("checkPoints"), evidenceExamples: data.get("evidenceExamples"), riskExamples: data.get("riskExamples"), improvementExamples: data.get("improvementExamples"), version: data.get("version"), effectiveDate: data.get("effectiveDate"), active: true })} saving={saving} submitLabel="평가 항목 저장">
      <Field label="식별 코드" name="code" required placeholder="PIA_ACCESS" />
      <Field label="분류" name="category" required />
      <Field label="제목" name="title" required wide />
      <Field label="버전" name="version" required defaultValue="DRAFT-1" />
      <Field label="기준일" name="effectiveDate" type="date" required />
      <TextArea label="설명" name="description" required wide />
      <TextArea label="체크포인트" name="checkPoints" required wide />
      <TextArea label="증적 예시" name="evidenceExamples" />
      <TextArea label="위험 예시" name="riskExamples" />
      <TextArea label="개선 방안 예시" name="improvementExamples" wide />
    </AdminForm>

    <AdminForm title="영향평가 시나리오" description="시나리오의 대상·판단 기준과 참고 개선 계획을 등록합니다." onSubmit={(data) => save({ entity: "PRIVACY_SCENARIO", courseId: data.get("courseId"), title: data.get("title"), description: data.get("description"), organizationType: data.get("organizationType"), systemType: data.get("systemType"), processedData: data.get("processedData"), dataSubjects: data.get("dataSubjects"), processingPurpose: data.get("processingPurpose"), track: data.get("track"), correctTargetDecision: data.get("correctTargetDecision"), expectedAssessmentItems: csv(data.get("expectedAssessmentItems")), modelImprovementPlan: data.get("modelImprovementPlan"), riskKeywords: csv(data.get("riskKeywords")), improvementKeywords: csv(data.get("improvementKeywords")), active: true })} saving={saving} submitLabel="시나리오 저장">
      <SelectField label="과정" name="courseId" options={courses} />
      <SelectField label="트랙" name="track" options={[{ id: "EXAM_PREP", name: "시험 대비" }, { id: "PRACTICE", name: "실무 연습" }]} />
      <Field label="제목" name="title" required wide />
      <Field label="기관 유형" name="organizationType" required />
      <Field label="시스템 유형" name="systemType" required />
      <SelectField label="대상 판단" name="correctTargetDecision" options={[{ id: "REQUIRED", name: "평가 필요" }, { id: "NOT_REQUIRED", name: "평가 불필요" }, { id: "REVIEW_NEEDED", name: "추가 검토 필요" }]} />
      <TextArea label="설명" name="description" required wide />
      <TextArea label="처리 개인정보" name="processedData" required wide />
      <Field label="정보주체" name="dataSubjects" required />
      <Field label="처리 목적" name="processingPurpose" required />
      <Field label="정답 평가 항목 ID" name="expectedAssessmentItems" placeholder={items.slice(0, 2).map((item) => item.id).join(",")} hint="쉼표로 여러 ID를 입력합니다." wide />
      <Field label="위험 키워드" name="riskKeywords" placeholder="동의, 최소 수집" />
      <Field label="개선 키워드" name="improvementKeywords" placeholder="접근 통제, 보관 기간" />
      <TextArea label="참고 개선 계획" name="modelImprovementPlan" required wide />
    </AdminForm>

    <AdminForm title="개인정보 흐름 노드" description="시나리오 흐름도에 표시할 데이터 처리 노드를 등록합니다." onSubmit={(data) => save({ entity: "PRIVACY_NODE", scenarioId: data.get("scenarioId"), nodeType: data.get("nodeType"), title: data.get("title"), description: data.get("description"), systemName: data.get("systemName"), organizationName: data.get("organizationName"), displayX: data.get("displayX"), displayY: data.get("displayY"), displayOrder: data.get("displayOrder") })} saving={saving} submitLabel="노드 저장">
      <SelectField label="시나리오" name="scenarioId" options={scenarios} wide />
      <SelectField label="노드 유형" name="nodeType" options={["DATA_SUBJECT", "COLLECTION", "PROCESSING", "STORAGE", "TRANSFER", "DESTRUCTION", "EXTERNAL"]} />
      <Field label="제목" name="title" required />
      <Field label="시스템" name="systemName" />
      <Field label="기관" name="organizationName" />
      <Field label="X 좌표" name="displayX" type="number" min={0} defaultValue="50" />
      <Field label="Y 좌표" name="displayY" type="number" min={0} defaultValue="50" />
      <Field label="표시 순서" name="displayOrder" type="number" min={0} defaultValue="0" />
      <TextArea label="설명" name="description" wide />
    </AdminForm>

    <AdminForm title="개인정보 흐름 연결" description="두 노드 사이의 데이터 종류와 보호 조치를 등록합니다." onSubmit={(data) => save({ entity: "PRIVACY_EDGE", scenarioId: data.get("scenarioId"), sourceNodeId: data.get("sourceNodeId"), targetNodeId: data.get("targetNodeId"), dataTypes: data.get("dataTypes"), transferMethod: data.get("transferMethod"), purpose: data.get("purpose"), protectionMeasures: data.get("protectionMeasures") })} saving={saving} submitLabel="연결 저장">
      <SelectField label="시나리오" name="scenarioId" options={scenarios} wide />
      <SelectField label="출발 노드" name="sourceNodeId" options={nodes} />
      <SelectField label="도착 노드" name="targetNodeId" options={nodes} />
      <Field label="개인정보 유형" name="dataTypes" required />
      <Field label="전송 방법" name="transferMethod" required />
      <TextArea label="처리 목적" name="purpose" />
      <TextArea label="보호 조치" name="protectionMeasures" />
    </AdminForm>

    {message ? <p className="form-message admin-sticky-message" role="status" aria-live="polite">{message}</p> : null}
  </div>;
}

function AdminForm({ title, description, children, onSubmit, submitLabel, saving }: { title: string; description: string; children: React.ReactNode; onSubmit: (data: FormData) => void | Promise<void>; submitLabel: string; saving: boolean }) {
  return <form className="admin-form admin-panel" action={onSubmit} aria-busy={saving}><div className="admin-form-heading wide"><div><p className="eyebrow">PRACTICAL CONTENT</p><h2>{title}</h2><p>{description}</p></div><span className="badge">검수 후 게시</span></div><div className="admin-form-grid">{children}</div><button className="button button-dark" type="submit" disabled={saving}>{saving ? "저장 중…" : submitLabel}</button></form>;
}

function Field({ label, name, type = "text", required = false, defaultValue, placeholder, hint, wide = false, min }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string; placeholder?: string; hint?: string; wide?: boolean; min?: number }) {
  return <label className={wide ? "wide" : undefined}>{label}{required ? <span className="required-mark" aria-hidden="true"> *</span> : null}<input name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} min={min} />{hint ? <small>{hint}</small> : null}</label>;
}

function TextArea({ label, name, required = false, wide = false, code = false }: { label: string; name: string; required?: boolean; wide?: boolean; code?: boolean }) {
  return <label className={wide ? "wide" : undefined}>{label}{required ? <span className="required-mark" aria-hidden="true"> *</span> : null}<textarea name={name} required={required} className={code ? "code-input" : undefined} rows={code ? 8 : 5} /></label>;
}

function SelectField({ label, name, options, wide = false }: { label: string; name: string; options: Array<string | Option>; wide?: boolean }) {
  return <label className={wide ? "wide" : undefined}>{label}<select name={name}>{options.map((option) => { const value = typeof option === "string" ? option : option.id; const textValue = typeof option === "string" ? option : option.name; return <option value={value} key={value}>{textValue}</option>; })}</select></label>;
}

function Checkbox({ label, name, defaultChecked = false }: { label: string; name: string; defaultChecked?: boolean }) {
  return <label className="checkbox-field"><input name={name} type="checkbox" defaultChecked={defaultChecked} />{label}</label>;
}

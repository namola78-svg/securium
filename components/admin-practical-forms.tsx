"use client";

import { useState } from "react";

type Option = { id: string; name: string };
const csv = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export function AdminPracticalForms({
  courses,
  questions,
  weaknesses,
  samples,
  items,
  scenarios,
  nodes,
}: {
  courses: Option[];
  questions: Option[];
  weaknesses: Option[];
  samples: Option[];
  items: Option[];
  scenarios: Option[];
  nodes: Option[];
}) {
  const [message, setMessage] = useState("");

  async function save(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/practical-specializations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { error?: { message?: string } };
    setMessage(
      response.ok
        ? "저장했습니다."
        : payload.error?.message ?? "저장하지 못했습니다.",
    );
    if (response.ok) window.location.reload();
  }

  return (
    <div className="admin-specialized-grid">
      <form
        className="admin-form admin-panel"
        action={(data) =>
          save({
            entity: "SECURE_WEAKNESS",
            code: data.get("code"),
            name: data.get("name"),
            category: data.get("category"),
            description: data.get("description"),
            language: data.get("language"),
            cweCode: data.get("cweCode"),
            risk: data.get("risk"),
            detectionGuide: data.get("detectionGuide"),
            remediationGuide: data.get("remediationGuide"),
            reference: data.get("reference"),
            version: data.get("version"),
            active: true,
          })
        }
      >
        <h2 className="wide">보안약점 분류 · CWE</h2>
        <label>
          코드
          <input name="code" placeholder="SQL_INJECTION" required />
        </label>
        <label>
          이름
          <input name="name" required />
        </label>
        <label>
          분류
          <input name="category" required />
        </label>
        <label>
          언어
          <select name="language">
            {["COMMON", "Java", "C", "C++", "Python", "JavaScript"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          CWE
          <input name="cweCode" placeholder="CWE-89" required />
        </label>
        <label>
          위험도
          <select name="risk">
            <option>LOW</option>
            <option>MEDIUM</option>
            <option>HIGH</option>
            <option>CRITICAL</option>
          </select>
        </label>
        <label>
          버전
          <input name="version" defaultValue="DRAFT-1" required />
        </label>
        <label className="wide">
          설명
          <textarea name="description" required />
        </label>
        <label className="wide">
          진단 가이드
          <textarea name="detectionGuide" required />
        </label>
        <label className="wide">
          조치 가이드
          <textarea name="remediationGuide" required />
        </label>
        <label className="wide">
          참고
          <input name="reference" defaultValue="독립 작성 샘플 콘텐츠" />
        </label>
        <button className="button button-dark" type="submit">
          보안약점 저장
        </button>
      </form>

      <form
        className="admin-form admin-panel"
        action={(data) =>
          save({
            entity: "SECURE_CODE_SAMPLE",
            courseId: data.get("courseId"),
            weaknessId: data.get("weaknessId"),
            questionId: data.get("questionId"),
            language: data.get("language"),
            title: data.get("title"),
            vulnerableCode: data.get("vulnerableCode"),
            secureCode: data.get("secureCode"),
            vulnerableLines: csv(data.get("vulnerableLines")).map(Number),
            explanation: data.get("explanation"),
            falsePositivePossible: data.get("falsePositivePossible") === "on",
            expectedTruePositive: data.get("expectedTruePositive") === "on",
            callRelation: data.get("callRelation"),
            executionFlow: data.get("executionFlow"),
            remediationKeywords: csv(data.get("remediationKeywords")),
            sourceDate: data.get("sourceDate"),
            active: true,
          })
        }
      >
        <h2 className="wide">취약 코드 · 안전한 코드 샘플</h2>
        <label>
          과정
          <select name="courseId">
            {courses.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          보안약점
          <select name="weaknessId">
            {weaknesses.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          연결 문제
          <select name="questionId">
            <option value="">없음</option>
            {questions.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          언어
          <select name="language">
            {["Java", "C", "C++", "Python", "JavaScript"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          제목
          <input name="title" required />
        </label>
        <label>
          취약 라인
          <input name="vulnerableLines" placeholder="3,4" required />
        </label>
        <label>
          기준일
          <input name="sourceDate" type="date" required />
        </label>
        <label>
          <input name="expectedTruePositive" type="checkbox" defaultChecked /> 정탐
          사례
        </label>
        <label>
          <input name="falsePositivePossible" type="checkbox" /> 오탐 가능
        </label>
        <label className="wide">
          취약 코드
          <textarea className="code-input" name="vulnerableCode" rows={8} required />
        </label>
        <label className="wide">
          안전한 코드
          <textarea className="code-input" name="secureCode" rows={8} required />
        </label>
        <label className="wide">
          해설
          <textarea name="explanation" required />
        </label>
        <label>
          호출 관계
          <textarea name="callRelation" />
        </label>
        <label>
          실행 흐름
          <textarea name="executionFlow" />
        </label>
        <label className="wide">
          조치 키워드
          <input name="remediationKeywords" placeholder="검증, 매개변수화" />
        </label>
        <button className="button button-dark" type="submit">
          코드 샘플 저장
        </button>
      </form>

      <form
        className="admin-form admin-panel"
        action={(data) =>
          save({
            entity: "SECURE_CODE_RULE",
            sampleId: data.get("sampleId"),
            lineScore: data.get("lineScore"),
            weaknessScore: data.get("weaknessScore"),
            cweScore: data.get("cweScore"),
            judgmentScore: data.get("judgmentScore"),
            keywordScore: data.get("keywordScore"),
            remediationCodeScore: data.get("remediationCodeScore"),
            maximumScore: data.get("maximumScore"),
          })
        }
      >
        <h2 className="wide">코드 분석 부분점수 기준</h2>
        <label className="wide">
          샘플
          <select name="sampleId">
            {samples.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {[
          ["lineScore", "취약 라인 점수", 30],
          ["weaknessScore", "약점 유형 점수", 20],
          ["cweScore", "CWE 점수", 15],
          ["judgmentScore", "정탐·오탐 판단 점수", 15],
          ["keywordScore", "조치 키워드 점수", 15],
          ["remediationCodeScore", "수정 코드 점수", 5],
          ["maximumScore", "최대 점수", 100],
        ].map(([name, label, value]) => (
          <label key={String(name)}>
            {label}
            <input name={String(name)} type="number" min={0} defaultValue={Number(value)} />
          </label>
        ))}
        <button className="button button-dark" type="submit">
          채점 기준 저장
        </button>
      </form>

      <form
        className="admin-form admin-panel"
        action={(data) =>
          save({
            entity: "PRIVACY_ITEM",
            code: data.get("code"),
            category: data.get("category"),
            title: data.get("title"),
            description: data.get("description"),
            checkPoints: data.get("checkPoints"),
            evidenceExamples: data.get("evidenceExamples"),
            riskExamples: data.get("riskExamples"),
            improvementExamples: data.get("improvementExamples"),
            version: data.get("version"),
            effectiveDate: data.get("effectiveDate"),
            active: true,
          })
        }
      >
        <h2 className="wide">영향평가 항목 · 버전</h2>
        <label>
          코드
          <input name="code" placeholder="PIA_ACCESS" required />
        </label>
        <label>
          분류
          <input name="category" required />
        </label>
        <label className="wide">
          제목
          <input name="title" required />
        </label>
        <label>
          버전
          <input name="version" defaultValue="DRAFT-1" required />
        </label>
        <label>
          기준일
          <input name="effectiveDate" type="date" required />
        </label>
        <label className="wide">
          설명
          <textarea name="description" required />
        </label>
        <label className="wide">
          확인사항
          <textarea name="checkPoints" required />
        </label>
        <label>
          증적 예시
          <textarea name="evidenceExamples" />
        </label>
        <label>
          침해요인 예시
          <textarea name="riskExamples" />
        </label>
        <label className="wide">
          개선방안 예시
          <textarea name="improvementExamples" />
        </label>
        <button className="button button-dark" type="submit">
          평가 항목 저장
        </button>
      </form>

      <form
        className="admin-form admin-panel"
        action={(data) =>
          save({
            entity: "PRIVACY_SCENARIO",
            courseId: data.get("courseId"),
            title: data.get("title"),
            description: data.get("description"),
            organizationType: data.get("organizationType"),
            systemType: data.get("systemType"),
            processedData: data.get("processedData"),
            dataSubjects: data.get("dataSubjects"),
            processingPurpose: data.get("processingPurpose"),
            track: data.get("track"),
            correctTargetDecision: data.get("correctTargetDecision"),
            expectedAssessmentItems: csv(data.get("expectedAssessmentItems")),
            modelImprovementPlan: data.get("modelImprovementPlan"),
            riskKeywords: csv(data.get("riskKeywords")),
            improvementKeywords: csv(data.get("improvementKeywords")),
            active: true,
          })
        }
      >
        <h2 className="wide">영향평가 시나리오 · 모범답안</h2>
        <label>
          과정
          <select name="courseId">
            {courses.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          트랙
          <select name="track">
            <option value="EXAM_PREP">평가자 시험 대비</option>
            <option value="PRACTICE">영향평가 실무</option>
          </select>
        </label>
        <label className="wide">
          제목
          <input name="title" required />
        </label>
        <label>
          기관 유형
          <input name="organizationType" required />
        </label>
        <label>
          시스템 유형
          <input name="systemType" required />
        </label>
        <label>
          대상 판단
          <select name="correctTargetDecision">
            <option value="REQUIRED">대상</option>
            <option value="NOT_REQUIRED">비대상</option>
            <option value="REVIEW_NEEDED">추가 검토</option>
          </select>
        </label>
        <label className="wide">
          설명
          <textarea name="description" required />
        </label>
        <label className="wide">
          처리 개인정보
          <textarea name="processedData" required />
        </label>
        <label>
          정보주체
          <input name="dataSubjects" required />
        </label>
        <label>
          처리 목적
          <input name="processingPurpose" required />
        </label>
        <label className="wide">
          정답 평가 항목 ID
          <input
            name="expectedAssessmentItems"
            placeholder={items
              .slice(0, 2)
              .map((item) => item.id)
              .join(",")}
          />
        </label>
        <label>
          위험 키워드
          <input name="riskKeywords" />
        </label>
        <label>
          개선 키워드
          <input name="improvementKeywords" />
        </label>
        <label className="wide">
          모범 개선방안
          <textarea name="modelImprovementPlan" required />
        </label>
        <button className="button button-dark" type="submit">
          시나리오 저장
        </button>
      </form>

      <form
        className="admin-form admin-panel"
        action={(data) =>
          save({
            entity: "PRIVACY_NODE",
            scenarioId: data.get("scenarioId"),
            nodeType: data.get("nodeType"),
            title: data.get("title"),
            description: data.get("description"),
            systemName: data.get("systemName"),
            organizationName: data.get("organizationName"),
            displayX: data.get("displayX"),
            displayY: data.get("displayY"),
            displayOrder: data.get("displayOrder"),
          })
        }
      >
        <h2 className="wide">흐름 노드</h2>
        <label className="wide">
          시나리오
          <select name="scenarioId">
            {scenarios.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          유형
          <select name="nodeType">
            {[
              "DATA_SUBJECT",
              "COLLECTION",
              "PROCESSING",
              "STORAGE",
              "TRANSFER",
              "DESTRUCTION",
              "EXTERNAL",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          제목
          <input name="title" required />
        </label>
        <label>
          시스템
          <input name="systemName" />
        </label>
        <label>
          기관
          <input name="organizationName" />
        </label>
        <label>
          X
          <input name="displayX" type="number" min={0} defaultValue={50} />
        </label>
        <label>
          Y
          <input name="displayY" type="number" min={0} defaultValue={50} />
        </label>
        <label>
          정렬
          <input name="displayOrder" type="number" min={0} defaultValue={0} />
        </label>
        <label className="wide">
          설명
          <textarea name="description" />
        </label>
        <button className="button button-dark" type="submit">
          노드 저장
        </button>
      </form>

      <form
        className="admin-form admin-panel"
        action={(data) =>
          save({
            entity: "PRIVACY_EDGE",
            scenarioId: data.get("scenarioId"),
            sourceNodeId: data.get("sourceNodeId"),
            targetNodeId: data.get("targetNodeId"),
            dataTypes: data.get("dataTypes"),
            transferMethod: data.get("transferMethod"),
            purpose: data.get("purpose"),
            protectionMeasures: data.get("protectionMeasures"),
          })
        }
      >
        <h2 className="wide">흐름 연결</h2>
        <label className="wide">
          시나리오
          <select name="scenarioId">
            {scenarios.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          출발
          <select name="sourceNodeId">
            {nodes.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          도착
          <select name="targetNodeId">
            {nodes.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          개인정보 유형
          <input name="dataTypes" required />
        </label>
        <label>
          전송 방법
          <input name="transferMethod" required />
        </label>
        <label>
          목적
          <textarea name="purpose" />
        </label>
        <label>
          보호조치
          <textarea name="protectionMeasures" />
        </label>
        <button className="button button-dark" type="submit">
          연결 저장
        </button>
      </form>

      {message ? (
        <p className="form-message admin-sticky-message" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

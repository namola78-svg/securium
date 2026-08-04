"use client";

import { useState } from "react";

type Option = { id: string; name: string };

async function submitSpecialized(body: Record<string, unknown>) {
  return fetch("/api/admin/specialized", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function AdminSpecializedForms({
  courses,
  standards,
  questions,
  methods,
}: {
  courses: Option[];
  standards: Array<{ id: string; name: string }>;
  questions: Array<{ id: string; name: string }>;
  methods: Array<{ id: string; name: string }>;
}) {
  const [message, setMessage] = useState("");

  async function save(body: Record<string, unknown>) {
    const response = await submitSpecialized(body);
    const payload = (await response.json()) as { error?: { message?: string } };
    setMessage(
      response.ok
        ? "저장했습니다."
        : (payload.error?.message ?? "저장하지 못했습니다."),
    );
    if (response.ok) window.location.reload();
  }

  return (
    <div className="admin-specialized-grid">
      <form
        className="admin-form admin-panel"
        action={(data) =>
          save({
            entity: "ISMS_STANDARD",
            code: data.get("code"),
            title: data.get("title"),
            majorCategory: data.get("majorCategory"),
            middleCategory: data.get("middleCategory"),
            description: data.get("description"),
            keyPoints: data.get("keyPoints"),
            evidenceExamples: data.get("evidenceExamples"),
            defectExamples: data.get("defectExamples"),
            auditPoints: data.get("auditPoints"),
            version: data.get("version"),
            effectiveDate: data.get("effectiveDate"),
            sourceUrl: data.get("sourceUrl"),
            active: true,
          })
        }
      >
        <h2 className="wide">ISMS-P 기준 등록</h2>
        <label>
          기준 번호
          <input name="code" required />
        </label>
        <label>
          제목
          <input name="title" required />
        </label>
        <label>
          대분류
          <input name="majorCategory" required />
        </label>
        <label>
          중분류
          <input name="middleCategory" required />
        </label>
        <label className="wide">
          설명
          <textarea name="description" required />
        </label>
        <label className="wide">
          확인사항
          <textarea name="keyPoints" required />
        </label>
        <label className="wide">
          주요 증적
          <textarea name="evidenceExamples" required />
        </label>
        <label className="wide">
          결함 예시
          <textarea name="defectExamples" required />
        </label>
        <label className="wide">
          심사 포인트
          <textarea name="auditPoints" required />
        </label>
        <label>
          버전
          <input name="version" required />
        </label>
        <label>
          시행 기준일
          <input name="effectiveDate" type="date" required />
        </label>
        <label className="wide">
          출처 URL
          <input name="sourceUrl" type="url" />
        </label>
        <button className="button button-dark" type="submit">
          기준 저장
        </button>
      </form>

      <form
        className="admin-form admin-panel"
        action={(data) =>
          save({
            entity: "ISMS_DEFECT_CASE",
            title: data.get("title"),
            situation: data.get("situation"),
            defectDescription: data.get("defectDescription"),
            relatedStandardId: data.get("relatedStandardId"),
            evidence: data.get("evidence"),
            correctiveAction: data.get("correctiveAction"),
            source: data.get("source"),
            sourceDate: data.get("sourceDate"),
          })
        }
      >
        <h2 className="wide">ISMS-P 결함사례</h2>
        <label className="wide">
          제목
          <input name="title" required />
        </label>
        <label className="wide">
          관련 기준
          <select name="relatedStandardId" required>
            {standards.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          상황
          <textarea name="situation" required />
        </label>
        <label className="wide">
          결함 설명
          <textarea name="defectDescription" required />
        </label>
        <label className="wide">
          증적
          <textarea name="evidence" required />
        </label>
        <label className="wide">
          시정조치
          <textarea name="correctiveAction" required />
        </label>
        <label>
          출처 구분
          <input name="source" required />
        </label>
        <label>
          기준일
          <input name="sourceDate" type="date" required />
        </label>
        <button className="button button-dark" type="submit">
          사례 저장
        </button>
      </form>

      <form
        className="admin-form admin-panel"
        action={(data) =>
          save({
            entity: "LEGAL_ARTICLE",
            lawName: data.get("lawName"),
            articleNumber: data.get("articleNumber"),
            articleTitle: data.get("articleTitle"),
            content: data.get("content"),
            effectiveDate: data.get("effectiveDate"),
            revisionDate: data.get("revisionDate"),
            sourceUrl: data.get("sourceUrl"),
            version: data.get("version"),
            active: true,
          })
        }
      >
        <h2 className="wide">법령·조문 및 버전</h2>
        <label>
          법령명
          <input name="lawName" required />
        </label>
        <label>
          조문 번호
          <input name="articleNumber" required />
        </label>
        <label className="wide">
          조문 제목
          <input name="articleTitle" required />
        </label>
        <label className="wide">
          관리 내용
          <textarea name="content" required />
        </label>
        <label>
          시행일
          <input name="effectiveDate" type="date" required />
        </label>
        <label>
          개정일
          <input name="revisionDate" type="date" required />
        </label>
        <label>
          버전
          <input name="version" required />
        </label>
        <label>
          출처 URL
          <input name="sourceUrl" type="url" />
        </label>
        <button className="button button-dark" type="submit">
          법령 버전 저장
        </button>
      </form>

      <form
        className="admin-form admin-panel"
        action={(data) =>
          save({
            entity: "WRITTEN_RULE",
            questionId: data.get("questionId"),
            modelAnswer: data.get("modelAnswer"),
            requiredKeywords: String(data.get("requiredKeywords") ?? "")
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            optionalKeywords: String(data.get("optionalKeywords") ?? "")
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            maximumScore: data.get("maximumScore"),
            partialScoreRules: [],
            guidance: data.get("guidance"),
            referenceDate: data.get("referenceDate"),
          })
        }
      >
        <h2 className="wide">서술형 채점규칙</h2>
        <label className="wide">
          문제
          <select name="questionId" required>
            {questions.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          예시 답안
          <textarea name="modelAnswer" required />
        </label>
        <label className="wide">
          필수 키워드(쉼표 구분)
          <input name="requiredKeywords" required />
        </label>
        <label className="wide">
          선택 키워드(쉼표 구분)
          <input name="optionalKeywords" />
        </label>
        <label>
          최대 점수
          <input name="maximumScore" type="number" min={1} defaultValue={100} />
        </label>
        <label>
          기준일
          <input name="referenceDate" type="date" required />
        </label>
        <label className="wide">
          참고 안내
          <textarea
            name="guidance"
            defaultValue="키워드 기반 학습 보조채점이며 공식 채점 결과가 아닙니다."
          />
        </label>
        <button className="button button-dark" type="submit">
          채점규칙 저장
        </button>
      </form>

      <form
        className="admin-form admin-panel"
        action={(data) => {
          let configuration: Record<string, unknown> = {};
          try {
            configuration = JSON.parse(String(data.get("configuration") ?? "{}"));
          } catch {
            setMessage("설정 JSON을 확인하세요.");
            return;
          }
          return save({
            entity: "RISK_METHOD",
            name: data.get("name"),
            description: data.get("description"),
            formulaType: data.get("formulaType"),
            configuration,
            active: true,
          });
        }}
      >
        <h2 className="wide">위험평가 방법</h2>
        <label>
          이름
          <input name="name" required />
        </label>
        <label>
          계산식
          <select name="formulaType">
            <option value="MULTIPLY">곱셈</option>
            <option value="ADD">합산</option>
            <option value="WEIGHTED">가중합</option>
            <option value="MATRIX">매트릭스</option>
          </select>
        </label>
        <label className="wide">
          설명
          <textarea name="description" required />
        </label>
        <label className="wide">
          설정 JSON
          <textarea
            name="configuration"
            defaultValue={'{"multiplier":1,"minimum":0,"maximum":25}'}
            required
          />
        </label>
        <button className="button button-dark" type="submit">
          평가 방법 저장
        </button>
      </form>

      <form
        className="admin-form admin-panel"
        action={(data) =>
          save({
            entity: "RISK_GRADE",
            calculationMethodId: data.get("calculationMethodId"),
            code: data.get("code"),
            label: data.get("label"),
            minValue: data.get("minValue"),
            maxValue: data.get("maxValue"),
            treatmentGuidance: data.get("treatmentGuidance"),
            displayOrder: data.get("displayOrder"),
          })
        }
      >
        <h2 className="wide">위험등급 기준</h2>
        <label className="wide">
          평가 방법
          <select name="calculationMethodId" required>
            {methods.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          코드
          <input name="code" required />
        </label>
        <label>
          표시명
          <input name="label" required />
        </label>
        <label>
          최솟값
          <input name="minValue" type="number" required />
        </label>
        <label>
          최댓값
          <input name="maxValue" type="number" required />
        </label>
        <label>
          정렬
          <input name="displayOrder" type="number" defaultValue={0} />
        </label>
        <label className="wide">
          처리 안내
          <textarea name="treatmentGuidance" />
        </label>
        <button className="button button-dark" type="submit">
          등급 저장
        </button>
      </form>

      <form
        className="admin-form admin-panel"
        action={(data) =>
          save({
            entity: "RISK_SCENARIO",
            courseId: data.get("courseId"),
            calculationMethodId: data.get("calculationMethodId"),
            title: data.get("title"),
            asset: data.get("asset"),
            threat: data.get("threat"),
            vulnerability: data.get("vulnerability"),
            existingControls: data.get("existingControls"),
            likelihood: data.get("likelihood"),
            impact: data.get("impact"),
            treatmentOption: data.get("treatmentOption"),
            residualRisk: data.get("residualRisk"),
            description: data.get("description"),
            referenceDate: data.get("referenceDate"),
          })
        }
      >
        <h2 className="wide">위험 시나리오</h2>
        <label>
          과정
          <select name="courseId" required>
            {courses.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          평가 방법
          <select name="calculationMethodId">
            {methods.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          제목
          <input name="title" required />
        </label>
        <label>
          자산
          <input name="asset" required />
        </label>
        <label>
          위협
          <input name="threat" required />
        </label>
        <label className="wide">
          취약점
          <textarea name="vulnerability" required />
        </label>
        <label className="wide">
          기존 통제
          <textarea name="existingControls" />
        </label>
        <label>
          가능성
          <input name="likelihood" type="number" min={0} defaultValue={3} />
        </label>
        <label>
          영향도
          <input name="impact" type="number" min={0} defaultValue={3} />
        </label>
        <label>
          처리 방안
          <input name="treatmentOption" required />
        </label>
        <label>
          잔여위험
          <input name="residualRisk" type="number" min={0} defaultValue={0} />
        </label>
        <label className="wide">
          설명
          <textarea name="description" />
        </label>
        <label>
          기준일
          <input name="referenceDate" type="date" required />
        </label>
        <button className="button button-dark" type="submit">
          시나리오 저장
        </button>
      </form>

      <form
        className="admin-form admin-panel"
        action={(data) =>
          save({
            entity: "CONTENT_LINK",
            contentType: data.get("contentType"),
            contentId: data.get("contentId"),
            courseId: data.get("courseId"),
            questionId: data.get("questionId") || undefined,
            relationType: data.get("relationType"),
            displayOrder: data.get("displayOrder"),
          })
        }
      >
        <h2 className="wide">과정 간 콘텐츠 연결</h2>
        <label>
          콘텐츠 유형
          <select name="contentType">
            <option value="ISMS_STANDARD">ISMS 기준</option>
            <option value="ISMS_DEFECT_CASE">결함사례</option>
            <option value="LEGAL_ARTICLE">법령 조문</option>
            <option value="RISK_SCENARIO">위험 시나리오</option>
          </select>
        </label>
        <label>
          콘텐츠 ID
          <input name="contentId" required />
        </label>
        <label>
          연결 과정
          <select name="courseId">
            {courses.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          관련 문제
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
          관계 유형
          <input name="relationType" defaultValue="RELATED" />
        </label>
        <label>
          정렬
          <input name="displayOrder" type="number" defaultValue={0} />
        </label>
        <button className="button button-dark" type="submit">
          연결 저장
        </button>
      </form>
      {message ? <p className="form-message admin-sticky-message">{message}</p> : null}
    </div>
  );
}

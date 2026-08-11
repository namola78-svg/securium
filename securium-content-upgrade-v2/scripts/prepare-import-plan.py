import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
kb = json.loads((DATA / "normalized-knowledge-base.json").read_text(encoding="utf-8"))

def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")

def difficulty(value):
    return {1: "EASY", 2: "EASY", 3: "MEDIUM", 4: "HARD", 5: "HARD"}.get(value, "MEDIUM")

def subject_code(concept, practical=False):
    if practical:
        return "PRACTICE"
    c = concept.casefold()
    if any(x in c for x in ("sql", "xss", "command", "web", "api")):
        return "APPLICATION_SECURITY"
    if any(x in c for x in ("network", "dns", "ids", "firewall", "dos", "arp", "tls", "email")):
        return "NETWORK_SECURITY"
    if any(x in c for x in ("linux", "windows", "endpoint", "malware", "forensics")):
        return "SYSTEM_SECURITY"
    if any(x in c for x in ("risk", "bcp", "isms", "governance", "evaluation")):
        return "SECURITY_LAW"
    return "SECURITY_FOUNDATION"

content_rows = []
for lesson in kb["lessons"]:
    body = {
        "overview": lesson["overview"],
        "keyPoints": lesson["keyPoints"],
        "practiceTip": lesson["practiceTip"],
        "fieldExample": lesson["fieldExample"],
        "relatedConcepts": lesson["relatedConcepts"],
        "provenance": lesson["provenance"],
    }
    content_rows.append({
        "id": lesson["id"],
        "slug": slug(lesson["id"]),
        "canonicalKey": f"securium.upgrade.{slug(lesson['concepts'][0])}",
        "title": lesson["title"],
        "summary": lesson["overview"],
        "body": json.dumps(body, ensure_ascii=False),
        "bodyFormat": "STRUCTURED_JSON",
        "learningObjectivesJson": json.dumps(lesson["learningObjectives"], ensure_ascii=False),
        "coreConceptsJson": json.dumps(lesson["concepts"], ensure_ascii=False),
        "practicalExamplesJson": json.dumps([lesson["fieldExample"]], ensure_ascii=False),
        "version": "2.0.0",
        "status": "DRAFT",
        "createdBy": "user-content-editor",
        "sourceRefs": lesson["source_refs"],
    })

question_rows = []
choice_rows = []
course_links = []
for group, course_id in (("writtenQuestions", "course-ise"), ("practicalQuestions", "course-ise")):
    for q in kb[group]:
        qtype = "SINGLE_CHOICE" if q["type"] == "single_choice" else q["type"]
        if qtype in {"PRACTICAL", "NETWORK_ANALYSIS", "CONFIG_ANALYSIS"}: qtype = "CASE_ANALYSIS"
        question_rows.append({
            "id": q["id"],
            "title": f"{q['concepts'][0]} 적용 판단",
            "content": q["prompt"],
            "type": qtype,
            "difficulty": difficulty(q["difficulty"]),
            "explanation": q.get("explanation", ""),
            "wrongAnswerExplanation": "오답은 문제에서 요구한 보안 판단 범위와 맞지 않거나 통제 효과를 과대평가한다.",
            "status": "DRAFT",
            "createdBy": "user-content-editor",
            "source": "SECURIUM_CONTENT_UPGRADE_V2",
            "sourceDate": None,
            "version": 1,
            "answerConfigJson": json.dumps({"answerIndex": q.get("answer_index"), "answerOutline": q.get("answer_outline", [])}, ensure_ascii=False),
            "sourceRefs": q["source_refs"],
        })
        if qtype == "SINGLE_CHOICE":
            for index, choice in enumerate(q["choices"], 1):
                choice_rows.append({
                    "id": f"{q['id']}-choice-{index:02d}", "questionId": q["id"], "content": choice,
                    "displayOrder": index, "isCorrect": index - 1 == q["answer_index"],
                    "explanation": "정답은 시나리오의 핵심 통제 목적과 직접 연결된다." if index - 1 == q["answer_index"] else "이 선택지는 문제의 신뢰 경계 또는 통제 범위를 잘못 해석한다.",
                })
        course_links.append({"questionId": q["id"], "courseId": course_id, "weight": 100})

plan = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "mode": "DRY_RUN_DRAFT_ONLY",
    "publish": False,
    "targetTables": ["contents", "questions", "question_choices", "question_courses"],
    "bindings": {"contentCreatedBy": "user-content-editor", "questionCreatedBy": "user-content-editor", "questionReviewer": "user-content-reviewer", "writtenCourseId": "course-ise", "practicalCourseId": "course-ise", "bindingSource": "SECURIUM_CONTENT_UPGRADE_V2 source package targets 정보보안기사 theory, written, and practical material"},
    "requiresBindings": [],
    "contentRows": content_rows,
    "questionRows": question_rows,
    "choiceRows": choice_rows,
    "courseLinks": course_links,
}
plan["courseLessonRows"] = []
for lesson in kb["lessons"]:
    code = subject_code(lesson["concepts"][0])
    plan["courseLessonRows"].append({
        "id": f"upgrade-course-lesson-{slug(lesson['concepts'][0])}",
        "courseId": "course-ise", "contentId": lesson["id"],
        "displayTitle": lesson["title"], "subjectCode": code,
        "subjectId": f"course-ise-subject-{code.casefold()}",
        "topicId": f"course-ise-subject-{code.casefold()}-topic-core",
        "difficulty": difficulty(lesson["difficulty"]), "importance": 70,
        "estimatedMinutes": 15, "isRequired": False, "status": "DRAFT",
    })
(DATA / "normalized-kb-import-plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"contents": len(content_rows), "questions": len(question_rows), "choices": len(choice_rows), "courseLinks": len(course_links), "publish": False}, ensure_ascii=False))

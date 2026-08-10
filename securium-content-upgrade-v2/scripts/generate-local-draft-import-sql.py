import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT.parent / "tmp" / "securium-draft-import.sql"
OUT.parent.mkdir(parents=True, exist_ok=True)
plan = json.loads((DATA / "normalized-kb-import-plan.json").read_text(encoding="utf-8"))

def q(value):
    if value is None: return "NULL"
    return "'" + str(value).replace("'", "''") + "'"
def j(value):
    return q(json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else value)

lines = ["BEGIN TRANSACTION;"]
for row in plan["contentRows"]:
    lines.append("INSERT INTO contents (id, slug, canonical_key, title, summary, body, body_format, learning_objectives_json, core_concepts_json, practical_examples_json, version, status, created_by) VALUES (" + ", ".join([
        q(row["id"]), q(row["slug"]), q(row["canonicalKey"]), q(row["title"]), q(row["summary"]), q(row["body"]), q(row["bodyFormat"]), q(row["learningObjectivesJson"]), q(row["coreConceptsJson"]), q(row["practicalExamplesJson"]), q(row["version"]), q(row["status"]), q(row["createdBy"])
    ]) + ");")
for row in plan["courseLessonRows"]:
    lines.append("INSERT INTO course_lessons (id, course_id, curriculum_node_id, content_id, lesson_id, display_title, sort_order, difficulty, importance, estimated_minutes, is_required, completion_rule, status) VALUES (" + ", ".join([
        q(row["id"]), q(row["courseId"]), "NULL", q(row["contentId"]), "NULL", q(row["displayTitle"]), q(9000 + len(lines)), q(row["difficulty"]), q(row["importance"]), q(row["estimatedMinutes"]), "0", q("MANUAL"), q(row["status"])
    ]) + ");")
for row in plan["questionRows"]:
    lines.append("INSERT INTO questions (id, title, content, type, difficulty, explanation, wrong_answer_explanation, status, source, source_date, version, answer_config_json, created_by) VALUES (" + ", ".join([
        q(row["id"]), q(row["title"]), q(row["content"]), q(row["type"]), q(row["difficulty"]), q(row["explanation"]), q(row["wrongAnswerExplanation"]), q(row["status"]), q(row["source"]), "NULL", q(row["version"]), q(row["answerConfigJson"]), q(row["createdBy"])
    ]) + ");")
for row in plan["choiceRows"]:
    lines.append("INSERT INTO question_choices (id, question_id, content, display_order, is_correct, explanation) VALUES (" + ", ".join([
        q(row["id"]), q(row["questionId"]), q(row["content"]), q(row["displayOrder"]), "1" if row["isCorrect"] else "0", q(row["explanation"])
    ]) + ");")
for row in plan["courseLinks"]:
    lines.append(f"INSERT INTO question_courses (question_id, course_id, weight) VALUES ({q(row['questionId'])}, {q(row['courseId'])}, {q(row['weight'])});")

subject_for = {}
for row in plan["courseLessonRows"]:
    concept = next((c for c in plan["contentRows"] if c["id"] == row["contentId"]), None)
    if concept:
        concepts = json.loads(concept["coreConceptsJson"])
        if concepts: subject_for[concepts[0]] = (row["subjectId"], row["topicId"])
for row in plan["questionRows"]:
    # Practical questions use the practice subject; written questions use the matching lesson subject.
    if row["id"].startswith("sec-upgrade-practical-"):
        subject_id = "course-isie-subject-practice"
        topic_id = "course-isie-subject-practice-topic-core"
    else:
        concept = row["id"]
        # The import plan preserves source refs and titles; use the question title's concept prefix.
        label = row["title"].removesuffix(" 적용 판단")
        subject_id, topic_id = subject_for.get(label, ("course-ise-subject-security_foundation", "course-ise-subject-security_foundation-topic-core"))
    lines.append(f"INSERT INTO question_subjects (question_id, subject_id) VALUES ({q(row['id'])}, {q(subject_id)});")
    lines.append(f"INSERT INTO question_topics (question_id, topic_id) VALUES ({q(row['id'])}, {q(topic_id)});")
lines.append("COMMIT;")
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(json.dumps({"path": str(OUT), "statements": len(lines) - 2, "transaction": True}, ensure_ascii=False))

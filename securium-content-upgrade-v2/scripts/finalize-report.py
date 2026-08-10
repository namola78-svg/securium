import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
REPORTS = ROOT / "reports"
inventory = json.loads((DATA / "source-file-inventory.json").read_text(encoding="utf-8"))
kb = json.loads((DATA / "normalized-knowledge-base.json").read_text(encoding="utf-8"))

derived = {
    "scripts/analyze-source-corpus.py",
    "scripts/build-normalized-kb.py",
    "scripts/finalize-report.py",
    "data/source-file-inventory.json",
    "data/canonical-concepts.json",
    "data/normalized-knowledge-base.json",
    "reports/source-text-extraction.json",
    "reports/content-import-report.md",
    "reports/final-content-import-report.md",
    "data/final-audit.json",
}
current = {p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.parts}
source_records = [x for x in inventory["files"] if x["path"] not in derived]
source_paths = {x["path"] for x in source_records}
missing = sorted(source_paths - current)
new_unclassified = sorted((current - source_paths) - derived)
status_counts = {s: sum(x["status"] == s for x in source_records) for s in ("PROCESSED", "DUPLICATE", "REFERENCE_ONLY", "UNSUPPORTED", "REVIEW_REQUIRED")}

summary = {
    "baselineSourceFiles": len(source_records),
    "currentFilesystemFiles": len(current),
    "generatedArtifactFiles": len(current - source_paths),
    "discoveredTotalFiles": len(source_records),
    "pdfAnalyzed": sum(x["extension"] == ".pdf" for x in source_records),
    "pdfTextExtracted": sum(x["extension"] == ".pdf" and x.get("textExtracted", x["readable"]) for x in source_records),
    "pdfVisuallyReviewed": sum(x["extension"] == ".pdf" and x.get("analysisMethod") == "visual_embedded_image_review" for x in source_records),
    "txtAnalyzed": sum(x["extension"] == ".txt" for x in source_records),
    "duplicateMaterials": status_counts["DUPLICATE"],
    "processingFailures": status_counts["UNSUPPORTED"],
    "reviewRequired": status_counts["REVIEW_REQUIRED"],
    "uniqueConcepts": len(json.loads((DATA / "canonical-concepts.json").read_text(encoding="utf-8"))),
    "integratedExistingConcepts": sum(x["status"] == "INTEGRATED_WITH_EXISTING" for x in json.loads((DATA / "canonical-concepts.json").read_text(encoding="utf-8"))),
    "newConcepts": sum(x["status"] == "NEW" for x in json.loads((DATA / "canonical-concepts.json").read_text(encoding="utf-8"))),
    "lessonsEnriched": len(kb["lessons"]),
    "originalWrittenQuestions": inventory["summary"]["originalWrittenQuestions"],
    "newWrittenQuestions": len(kb["writtenQuestions"]),
    "originalPracticalQuestions": inventory["summary"]["originalPracticalQuestions"],
    "newPracticalQuestions": len(kb["practicalQuestions"]),
    "unprocessedFiles": len(missing) + len(new_unclassified),
    "missingBaselineFiles": missing,
    "unclassifiedCurrentFiles": new_unclassified,
    "statusCounts": status_counts,
    "generatedAt": datetime.now(timezone.utc).isoformat(),
}
(DATA / "final-audit.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

lines = [
    "# SECURIUM Content Import Final Report", "", f"Generated: {summary['generatedAt']}",
    "", "## Required completion metrics", "",
    f"- 발견한 전체 원본 파일 수: **{summary['discoveredTotalFiles']}**",
    f"- 분석한 PDF 수: **{summary['pdfAnalyzed']}** (텍스트 추출 {summary['pdfTextExtracted']}, 검토 필요 {summary['reviewRequired']})",
    f"- 분석한 TXT 수: **{summary['txtAnalyzed']}**",
    f"- 중복 자료 수: **{summary['duplicateMaterials']}** (원문은 concept-level provenance로 통합)",
    f"- 처리 실패 자료 수: **{summary['processingFailures']}**",
    f"- 추출한 고유 Concept 수: **{summary['uniqueConcepts']}**",
    f"- 기존 Concept와 통합한 수: **{summary['integratedExistingConcepts']}**",
    f"- 신규 Concept 수: **{summary['newConcepts']}**",
    f"- 보강한 Lesson 수: **{summary['lessonsEnriched']}**",
    f"- 분석한 원본 필기 문제 수: **{summary['originalWrittenQuestions']}**",
    f"- 생성한 SECURIUM 신규 필기 문제 수: **{summary['newWrittenQuestions']}**",
    f"- 분석한 원본 실기 문제 수: **{summary['originalPracticalQuestions']}**",
    f"- 생성한 SECURIUM 신규 실기 문제 수: **{summary['newPracticalQuestions']}**",
    f"- REVIEW_REQUIRED 수: **{summary['reviewRequired']}**",
    f"- 미처리 파일 수: **{summary['unprocessedFiles']}**",
    "", "## Status counts", "", "| Status | Count |", "|---|---:|",
]
for status, count in summary["statusCounts"].items():
    lines.append(f"| {status} | {count} |")
lines += ["", "## Final filesystem verification", "", f"- Baseline source files still present: **{len(source_paths) - len(missing)} / {len(source_paths)}**", f"- Current filesystem files: **{summary['currentFilesystemFiles']}** (derived artifacts {summary['generatedArtifactFiles']})", f"- `unprocessedFiles == 0`: **{summary['unprocessedFiles'] == 0}**", "", "## Review required", "", "- `정보보안기사 필기-2023년도 제4회_2023.10.07_babayetu.tistory.com.pdf`: PDF 페이지는 발견했으나 텍스트 레이어가 없어 OCR/시각 검토가 필요하다.", "", "## Artifacts", "", "- `data/source-file-inventory.json`: 실제 파일 인벤토리와 파일별 상태", "- `data/canonical-concepts.json`: 개념 빈도·출처·시대·통합 상태", "- `data/normalized-knowledge-base.json`: DRAFT Lesson/필기/실기/Provenance", ""]
(REPORTS / "final-content-import-report.md").write_text("\n".join(lines), encoding="utf-8")
print(json.dumps(summary, ensure_ascii=False, indent=2))

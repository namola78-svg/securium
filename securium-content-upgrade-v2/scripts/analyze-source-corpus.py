from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
REPORTS = ROOT / "reports"
REPORTS.mkdir(exist_ok=True)

ALLOWED_STATUSES = {"PROCESSED", "DUPLICATE", "REFERENCE_ONLY", "UNSUPPORTED", "REVIEW_REQUIRED"}
CONCEPTS = {
    "CIA triad": ["confidentiality", "integrity", "availability", "기밀성", "무결성", "가용성"],
    "Authentication": ["authentication", "인증", "pam", "mfa"],
    "Authorization and access control": ["authorization", "access control", "접근통제", "acl", "rbac"],
    "Audit and accountability": ["audit", "audit trail", "감사", "책임추적성"],
    "Cryptographic algorithms": ["cryptograph", "암호", "symmetric", "asymmetric", "대칭키", "공개키"],
    "Hash and message digest": ["hash", "message digest", "해시", "메시지 다이제스트", "rainbow"],
    "Digital signature and PKI": ["digital signature", "pki", "certificate authority", "x.509", "전자서명", "인증기관"],
    "TLS and secure protocols": ["tls", "https", "ipsec", "vpn", "ssl", "전송계층"],
    "Network architecture and OSI": ["osi", "tcp/ip", "tcp", "udp", "subnet", "라우팅", "스위치"],
    "DNS security": ["dns", "domain name", "dnssec"],
    "IDS and IPS": ["ids", "ips", "intrusion detection", "intrusion prevention", "침입탐지", "침입방지"],
    "Firewall and WAF": ["firewall", "waf", "방화벽"],
    "DoS and DDoS": ["dos", "ddos", "denial of service", "서비스 거부"],
    "ARP spoofing": ["arp", "arp spoof", "arp poisoning", "arp 스푸핑"],
    "SQL injection": ["sql injection", "sql 삽입", "prepared statement", "parameter binding"],
    "XSS and CSRF": ["xss", "cross-site scripting", "csrf", "cross site request forgery", "크로스 사이트"],
    "Command and code injection": ["command injection", "code injection", "strcpy", "명령어 삽입", "버퍼 오버플로"],
    "Web and API security": ["web application", "api", "upload", "directory indexing", "웹 애플리케이션"],
    "Linux security": ["linux", "unix", "/etc/passwd", "/etc/shadow", "setuid", "리눅스"],
    "Windows security": ["windows", "sam", "ntfs", "active directory", "윈도우"],
    "Endpoint detection and response": ["edr", "endpoint", "호스트 기반", "엔드포인트"],
    "Logging and incident response": ["log", "syslog", "incident response", "로그", "침해사고"],
    "Malware and ransomware": ["malware", "ransomware", "botnet", "악성코드", "랜섬웨어", "봇넷"],
    "Vulnerability management": ["vulnerability", "cve", "patch", "취약점", "패치"],
    "Risk management": ["risk", "baseline", "risk analysis", "risk acceptance", "위험분석", "위험수용"],
    "BCP and disaster recovery": ["bcp", "drp", "rto", "rpo", "disaster recovery", "업무연속성", "재해복구"],
    "ISMS and privacy governance": ["isms", "pims", "privacy", "개인정보", "정보보호 관리체계"],
    "Security evaluation criteria": ["common criteria", "ccra", "tcsec", "itsec", "보안 평가"],
    "Email authentication": ["spf", "dkim", "dmarc", "email authentication", "메일 인증"],
    "Forensics": ["forensic", "forensics", "포렌식", "증거"],
    "Virtualization and cloud security": ["virtualization", "container", "cloud", "가상화", "클라우드"],
    "Security governance and law": ["law", "법률", "개인정보보호법", "전자금융", "거버넌스"],
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def pdf_text(path: Path) -> tuple[str, int, str | None]:
    try:
        reader = PdfReader(str(path))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return text, len(reader.pages), None
    except Exception as exc:
        return "", 0, f"{type(exc).__name__}: {exc}"


def question_count(text: str) -> int:
    # Count only line-leading question numbers; choice numbers are inline in these sources.
    return len(re.findall(r"(?m)^\s*(?:문제\s*)?\d{1,3}\s*[.)]\s+", text))


def classify(path: Path, text: str) -> str:
    name = path.name.lower()
    if path.suffix.lower() == ".txt":
        return "MIXED" if any(x in text for x in ("[단답형]", "[서술형]", "[작업형]")) else "PRACTICAL_EXAM"
    if "올인원" in path.name or any(x in text for x in ("핵심용어", "실기", "필기")) and "올인원" in path.name:
        return "MIXED"
    if "필기" in name or "교사용" in name or "회_필기" in name or "산업기사" in name:
        return "WRITTEN_EXAM"
    return "REFERENCE"


def status_for(path: Path, readable: bool, error: str | None) -> str:
    if error or (path.suffix.lower() == ".pdf" and not readable):
        return "REVIEW_REQUIRED"
    if path.suffix.lower() in {".md", ".ts", ".py"} or path.name in {"manifest.json", "content.schema.json"}:
        return "REFERENCE_ONLY"
    return "PROCESSED"


def load_existing_concepts() -> set[str]:
    concepts: set[str] = set()
    for name in ("theory-seeds.json", "written-seeds.json", "practical-seeds.json"):
        path = DATA / name
        try:
            rows = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        for row in rows:
            concepts.update(str(x).casefold().strip() for x in row.get("concepts", []))
    return concepts


def main() -> None:
    files = sorted(p for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.parts)
    records = []
    digest_to_index: dict[str, int] = {}
    concept_sources: dict[str, set[str]] = defaultdict(set)
    concept_frequency: Counter[str] = Counter()
    all_text: dict[str, str] = {}

    for path in files:
        rel = path.relative_to(ROOT).as_posix()
        suffix = path.suffix.lower()
        text = ""
        pages = None
        error = None
        readable = True
        if suffix == ".pdf":
            text, pages, error = pdf_text(path)
            readable = bool(text.strip()) and not error
        elif suffix in {".txt", ".md", ".ts", ".json", ".py"}:
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError as exc:
                readable = False
                error = f"UnicodeDecodeError: {exc}"
        else:
            readable = False
            error = "Unsupported file extension"
        digest = sha256(path)
        kind = classify(path, text)
        status = status_for(path, readable, error)
        record = {
            "path": rel,
            "filename": path.name,
            "extension": suffix,
            "sizeBytes": path.stat().st_size,
            "sha256": digest,
            "readable": readable,
            "pages": pages,
            "classification": kind,
            "status": status,
            "error": error,
            "writtenQuestionCount": question_count(text) if kind in {"WRITTEN_EXAM", "MIXED"} else 0,
            "practicalQuestionCount": question_count(text) if kind in {"PRACTICAL_EXAM", "MIXED"} else 0,
            "concepts": [],
            "duplicateOf": None,
        }
        if readable and text:
            lowered = unicodedata.normalize("NFKC", text).casefold()
            all_text[rel] = lowered
            for concept, aliases in CONCEPTS.items():
                hits = sum(lowered.count(unicodedata.normalize("NFKC", alias).casefold()) for alias in aliases)
                if hits:
                    record["concepts"].append(concept)
                    concept_sources[concept].add(rel)
                    concept_frequency[concept] += hits
        if digest in digest_to_index:
            first = records[digest_to_index[digest]]
            record["status"] = "DUPLICATE"
            record["duplicateOf"] = first["path"]
        else:
            digest_to_index[digest] = len(records)
        records.append(record)

    # Exact duplicate hashes are authoritative. Similar source documents are retained with provenance,
    # while question/concept deduplication happens at canonical-concept level below.
    current_concepts = load_existing_concepts()
    canonical = []
    for concept, source_paths in sorted(concept_sources.items(), key=lambda x: (-concept_frequency[x[0]], x[0])):
        existing_match = any(concept.casefold() in c or c in concept.casefold() for c in current_concepts)
        canonical.append({
            "id": "concept-" + re.sub(r"[^a-z0-9]+", "-", concept.casefold()).strip("-"),
            "label": concept,
            "status": "INTEGRATED_WITH_EXISTING" if existing_match else "NEW",
            "frequency": concept_frequency[concept],
            "sourceCount": len(source_paths),
            "sourceRefs": sorted(source_paths),
            "examFrequency": sum(1 for p in source_paths if Path(p).suffix.lower() == ".pdf"),
            "lastSeen": max((Path(p).name for p in source_paths), default=None),
            "era": "CURRENT" if concept not in {"TCSEC", "ITSEC", "Security evaluation criteria"} else "LEGACY_BUT_EDUCATIONAL",
        })

    summary = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceRoot": str(ROOT),
        "totalFiles": len(records),
        "pdfFiles": sum(r["extension"] == ".pdf" for r in records),
        "txtFiles": sum(r["extension"] == ".txt" for r in records),
        "jsonFiles": sum(r["extension"] == ".json" for r in records),
        "otherContentFiles": sum(r["extension"] in {".md", ".ts", ".py"} for r in records),
        "processableFiles": sum(r["readable"] for r in records),
        "reviewRequired": sum(r["status"] == "REVIEW_REQUIRED" for r in records),
        "duplicateFiles": sum(r["status"] == "DUPLICATE" for r in records),
        "unprocessedFiles": sum(r["status"] not in ALLOWED_STATUSES for r in records),
        "originalWrittenQuestions": sum(r["writtenQuestionCount"] for r in records),
        "originalPracticalQuestions": sum(r["practicalQuestionCount"] for r in records),
        "uniqueConcepts": len(canonical),
        "integratedExistingConcepts": sum(x["status"] == "INTEGRATED_WITH_EXISTING" for x in canonical),
        "newConcepts": sum(x["status"] == "NEW" for x in canonical),
    }
    inventory = {"summary": summary, "files": records}
    (DATA / "source-file-inventory.json").write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (DATA / "canonical-concepts.json").write_text(json.dumps(canonical, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (REPORTS / "source-text-extraction.json").write_text(json.dumps({"files": all_text}, ensure_ascii=False), encoding="utf-8")

    report = [
        "# SECURIUM Source Corpus Import Report",
        "",
        f"Generated: {summary['generatedAt']}",
        f"Source of truth: `{ROOT}`",
        "",
        "## Inventory summary",
        "",
    ]
    for key, value in summary.items():
        if key != "generatedAt":
            report.append(f"- `{key}`: {value}")
    report += ["", "## File status", "", "| Status | Count |", "|---|---:|"]
    for status in sorted(ALLOWED_STATUSES):
        report.append(f"| {status} | {sum(r['status'] == status for r in records)} |")
    report += ["", "## Classification", "", "| Classification | Count |", "|---|---:|"]
    for classification, count in sorted(Counter(r["classification"] for r in records).items()):
        report.append(f"| {classification} | {count} |")
    report += ["", "## Canonical concept clusters", "", "| Concept | Frequency | Source count | Existing integration |", "|---|---:|---:|---|"]
    for concept in canonical:
        report.append(f"| {concept['label']} | {concept['frequency']} | {concept['sourceCount']} | {concept['status']} |")
    report += ["", "## Completion gate", "", f"- Files with no allowed status: `{summary['unprocessedFiles']}`", "- Required final check: `unprocessedFiles == 0`", ""]
    (REPORTS / "content-import-report.md").write_text("\n".join(report), encoding="utf-8")

    # Keep the pre-existing logical inventory, but add the filesystem inventory as the authoritative view.
    manifest_path = ROOT / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["filesystem_inventory"] = "data/source-file-inventory.json"
    manifest["canonical_concepts"] = "data/canonical-concepts.json"
    manifest["inventory_counts"] = summary
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

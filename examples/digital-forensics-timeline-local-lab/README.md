# Synthetic Forensics Timeline Local Lab

독립 실행 가능한 합성 파일 활동 타임라인 실습 초안이다. 입력은 명시적으로
`synthetic-local-only`로 표시된 JSON 또는 CSV 기록만 받는다. 실제 디스크,
사용자 홈, 개인정보, 네트워크, credential, DB를 탐색하거나 수집하지 않는다.

## Foundation과의 관계

현재 [Digital Forensics 8H Foundation](../../content-drafts/digital-forensics-8h-foundation/)
은 `DRAFT_UNPUBLISHED`이고 manifest의 `executableLabs`는 `0`이다. 이 lab은
기존 [DF-H06 Network and Log Timeline Forensics](../../content-drafts/digital-forensics-8h-foundation/modules.json)의
주제와 다음 objective/practical에 개념적으로 맞는다.

- Objectives: `DF-H06-O01` source/scope 분류, `DF-H06-O02` timestamp 정규화,
  `DF-H06-O03` timeline 구성, `DF-H06-O04` gap/conflict/clock 한계 분석
- Practical specification: `DF-H06-P01 Network and log timeline construction`
- Question reference: `DF-H06-Q01`–`DF-H06-Q05`

이 연결은 교육적 traceability일 뿐이며 canonical ID에 executable lab을 등록하거나
Foundation의 practical/objective/question 상태를 변경하지 않는다. 기존
[무결성 lab](../digital-forensics-integrity-local-lab/)과도 독립적이다. 이 실습은
실제 NTFS/MFT/USN 분석기, disk imaging, deleted-file recovery를 구현하지 않는다.

## 학습 목표

학습자는 다음을 수행한다.

1. 합성 event의 identity와 source identity를 구분한다.
2. 원래 timestamp와 timezone-aware UTC 표현을 함께 보존한다.
3. 서로 다른 offset 기록을 UTC로 정렬한다.
4. 동일 UTC 시각의 deterministic tie-break가 실제 선후관계가 아님을 설명한다.
5. timezone 누락, 잘못된 시간, duplicate identity, 잠재적 source conflict를 식별한다.
6. timeline에서 관찰 사실, 가능한 해석, 알 수 없는 사항과 추가 증거를 분리한다.

## 지원 환경과 실행

Python 표준 라이브러리만 사용하며 Python `>=3.11`을 대상으로 한다. 모든 출력
경로는 학습자가 만든 새 경로여야 한다. 기존 파일은 덮어쓰지 않는다.

저장소 루트의 PowerShell에서 실행한다.

```powershell
$lab = ".\examples\digital-forensics-timeline-local-lab"
$work = Join-Path $env:TEMP "securium-forensics-timeline-lab"
New-Item -ItemType Directory -Force -Path $work | Out-Null

python "$lab\cli.py" generate `
  --output "$work\synthetic-fixture.json" `
  --fixture-created-at "2026-09-11T09:15:00+09:00"

python "$lab\cli.py" analyze `
  --input "$work\synthetic-fixture.json" `
  --output "$work\timeline-report.json" `
  --analysis-run-at "2026-09-11T09:30:00+09:00"

Get-Content "$work\timeline-report.json"
```

`generate`는 고정된 창작 event 6개를 만든다. `fixture_created_at`은 fixture를
만든 시각이고, 각 record의 `timestamp_original`은 관찰된 사건 시각이며,
`analysis_run_at`은 분석 실행 시각이다. 세 시각을 같은 의미로 기록하지 않는다.

CSV도 생성·분석할 수 있다.

```powershell
python "$lab\cli.py" generate `
  --format csv `
  --output "$work\synthetic-fixture.csv" `
  --fixture-created-at "2026-09-11T09:15:00+09:00"

python "$lab\cli.py" analyze `
  --input "$work\synthetic-fixture.csv" `
  --output "$work\csv-timeline-report.json" `
  --analysis-run-at "2026-09-11T09:30:00+09:00"
```

CLI는 성공 시 `input_sha256`, `deterministic_result_sha256`,
`report_bytes_sha256`를 출력한다. 같은 입력과 같은 `--analysis-run-at`이면 보고서
bytes가 재현된다. analysis time을 생략하면 현재 UTC가 기록되므로 전체 report
bytes는 달라질 수 있지만, 시간 필드를 제외한 deterministic result hash는 같은
분석 결과를 나타낸다. 두 개념을 혼동하지 않는다.

## 입력 계약

JSON root는 다음 필드를 갖는다.

```json
{
  "format": "securium-digital-forensics-timeline-local-lab-v1",
  "scope": "synthetic-local-only",
  "fixture_id": "synthetic-case-v1",
  "fixture_created_at": "2026-09-11T09:15:00+09:00",
  "records": [
    {
      "event_id": "evt-001",
      "source_id": "synthetic-filesystem-alpha",
      "synthetic_file_id": "synth-file-alpha",
      "event_type": "created",
      "timestamp_original": "2026-09-11T09:00:00+09:00",
      "timestamp_meaning": "source-reported file creation observation",
      "notes": "synthetic note"
    }
  ]
}
```

필수 field는 event identity, source identity, 합성 파일 ID, event 종류, 원래
timestamp, timestamp 의미/출처다. timezone이 없는 timestamp는 실행 컴퓨터의
timezone으로 추정하지 않고 거부한다. 입력 record는 최대 100개, UTF-8 입력은
최대 1 MiB이며, archive·shell·pickle·eval은 사용하지 않는다.

원본 입력은 read-only로 읽고 raw input SHA-256을 report에 기록한다. report output은
exclusive create로만 쓰며 이미 있는 report를 덮어쓰지 않는다. 입력과 출력이 같은
파일이거나 기존 symlink/Windows reparse 경로를 통과하면 거부한다. 출력 생성 중
오류가 나면 lab이 만든 partial output을 정리한다. 이 검사는 path-based 경계이며
TOCTOU를 해결한다고 주장하지 않는다. 사용자가 지정한 입력은 반드시 창작 local
record임을 root의 `scope`로 표시해야 한다.

## 출력 해석

report는 다음을 분리한다.

- `records`: 원래 timestamp, UTC 정규화 값, offset, source와 file identity
- `ordering.tie_groups`: 동일 UTC 시각의 event IDs와 “display-only” 경고
- `observed_facts`: record에 실제 적힌 사실의 source-linked 요약
- `potential_conflicts`: 같은 source/file/UTC instant에서 event 종류나 timestamp
  의미가 충돌하는 후보
- `interpretation_limits`: clock 정확성, 인과관계, 사용자/의도, provenance의 한계
- `additional_evidence_needed`: clock 설정, 독립 로그, parser/version, retention/gap 자료

같은 UTC 시각의 event는 출력 재현성을 위해 `event_id` 등으로 정렬한다. 이는 실제
사건의 선후관계나 causality를 증명하지 않는다. timestamp만으로 실제 사용자 행위,
저작자, 의도, 인과관계 또는 법적 증명력을 확정하지 않는다.

## 검증

```powershell
python -m py_compile `
  "$lab\timeline_lab.py" `
  "$lab\cli.py" `
  "$lab\test_timeline_lab.py" `
  "$lab\run_tests.py"

python -m unittest discover `
  -s "$lab" `
  -p "test_*.py" `
  -v
```

테스트는 offset 동치, 입력 순서 독립성, tie 해석 제한, timezone/invalid 입력,
UTC 범위 초과와 leap second 거부, duplicate identity, unexpected field와 CSV
extra column, potential conflict, malformed/과대 field, 정상/실패 CLI, 한글 경로,
symlink 입력, 입력 보존, 동일 입출력 경로, report hash 차이를 확인한다.

현재 로컬 검증은 Windows 11 build 26200 / PowerShell 5.1 / Python 3.14.5에서
10개 테스트 PASS다. 전용 CI는 Windows/Linux × Python 3.11/3.14를 별도로 실행하며,
CI가 실행되기 전에는 해당 조합을 검증 완료로 집계하지 않는다.

이 package는 Securium runtime, Evidence projection, learner state, scoring,
canonical practical registration, approval, publication 또는 delivery readiness와
연결되지 않는다.

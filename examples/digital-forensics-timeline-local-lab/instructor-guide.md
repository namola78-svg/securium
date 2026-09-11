# Instructor Guide: Synthetic Timeline Reasoning

## 상태와 연결

이 문서는 독립 executable draft를 위한 진행 자료다. 현재
[Digital Forensics 8H Foundation](../../content-drafts/digital-forensics-8h-foundation/)
은 `DRAFT_UNPUBLISHED`이며 `executableLabs: 0`이다. 이 lab은 새 canonical ID를
만들거나 `DF-H06-P01`을 executable로 승격하지 않는다.

개념상 연결은 다음과 같다.

- `DF-H06-O01`: source와 scope 분류
- `DF-H06-O02`: original timestamp 보존과 UTC normalization
- `DF-H06-O03`: 부분적으로 보이는 event로 timeline 구성
- `DF-H06-O04`: gap, conflict, clock limitation 분석
- `DF-H06-P01`: Network and log timeline construction
- `DF-H06-Q01`–`Q05`: 기존 assessment reference only

기존 [integrity local lab](../digital-forensics-integrity-local-lab/)의 byte hash·custody
교육을 반복하지 않는다. 이 lab의 핵심은 시간 의미, source provenance의 한계,
관찰과 추론의 경계다.

## 권장 진행

다음은 파일럿 진행을 위한 예상 순서다. 자동 테스트 시간이나 강사 단독 실행
시간을 수강생 소요 시간으로 보고하지 않는다.

1. 5분: 실제 evidence와 synthetic record의 경계 설명
2. 10분: fixture metadata와 record 필드 읽기
3. 10분: 서로 다른 timezone offset의 UTC 정규화 확인
4. 10분: tie group을 deterministic ordering과 causality로 구분
5. 10분: potential conflict와 추가 corroboration 토론
6. 10분: 오류 입력·timezone 누락·duplicate identity 실패 확인
7. 10분: 학습자 observation/inference 기록지 작성 및 리뷰

이는 측정된 강의 시간이 아니라 독립 lab의 진행 예측이다. 전체 포렌식 8시간 과정
완성 또는 delivery readiness를 의미하지 않는다.

## 실행 시연

```powershell
$lab = ".\examples\digital-forensics-timeline-local-lab"
$work = Join-Path $env:TEMP "securium-forensics-timeline-instructor"
New-Item -ItemType Directory -Force -Path $work | Out-Null

python "$lab\cli.py" generate `
  --output "$work\fixture.json" `
  --fixture-created-at "2026-09-11T09:15:00+09:00"

python "$lab\cli.py" analyze `
  --input "$work\fixture.json" `
  --output "$work\report.json" `
  --analysis-run-at "2026-09-11T09:30:00+09:00"
```

예상 결과:

- fixture 6 records가 생성된다.
- `evt-001`의 `09:00 +09:00`과 `evt-003`/`evt-005`의 `00:00Z`는 같은 UTC
  instant를 나타낸다.
- `evt-002`와 `evt-004`는 `01:00Z`에서 tie를 만든다.
- `evt-001`, `evt-003`, `evt-005`는 같은 source/file/UTC group에서 event type이
  달라 `potential_conflicts` 후보로 표시된다.
- tie group은 event ID로 정렬되지만 그 순서는 실제 선후관계가 아니다.
- report는 각 row의 `timestamp_original`과 `timestamp_meaning`을 유지한다.

## 핵심 해설

### 반드시 관찰 사실로 인정할 것

- 특정 source가 특정 original timestamp와 의미를 기록했다.
- 같은 timestamp가 offset 변환 후 같은 UTC instant가 되었다.
- 분석기가 고정된 tie-break key로 결과를 정렬했다.
- 동일 source/file/UTC group에 서로 다른 event 설명이 존재한다.

### 관찰만으로 확정하지 말 것

- UTC가 같으므로 어느 event가 먼저였다는 주장
- file event가 특정 사용자의 행동이었다는 주장
- timestamp가 정확하므로 실제 clock이 정확했다는 주장
- record가 존재하므로 event의 provenance/authenticity가 입증됐다는 주장
- proxy/log에 기록이 없으므로 event가 없었다는 주장
- timeline이 있으므로 인과관계나 의도가 입증됐다는 주장

## 흔한 오답과 힌트

| 학습자 오답 | 교정 질문/힌트 |
| --- | --- |
| `+09:00`을 제거하고 시각 숫자만 비교 | offset을 적용하면 UTC 값이 어떻게 달라지는가? |
| JSON 배열에 먼저 나온 row가 먼저 발생했다고 결론 | 입력 순서를 바꾸어도 출력이 같은가? 같다면 그것은 어떤 종류의 순서인가? |
| 동일 UTC tie를 event ID 순서로 확정 | `tie_order_is_not_causality`의 의미는 무엇인가? |
| 파일 `modified` 기록을 사용자가 수정했다고 표현 | source는 무엇을 관찰했고, actor/intent를 기록했는가? |
| potential conflict에서 한 source를 정답으로 선택 | 어떤 source documentation 또는 독립 evidence가 필요한가? |
| timezone 누락을 로컬 PC timezone으로 보정 | 그 보정 가정은 원본 기록의 어디에 근거하는가? |
| report hash가 법적 무결성을 증명한다고 표현 | hash가 실제로 비교한 범위와 증명하지 않는 범위는 무엇인가? |

## 오류 대응

- `explicit timezone offset`: 원본 timestamp를 수정해 추측하지 말고, source가
  명시한 offset을 기록한 새 synthetic copy를 사용한다.
- `duplicate event identity`: duplicate는 같은 event의 두 원본으로 합치지 말고
  source identity를 먼저 확인한다. 이 lab은 ambiguous input을 거부한다.
- `scope must be explicitly marked`: 실제 파일을 사용하지 말고 root scope와
  synthetic fixture metadata를 갖춘 교육용 입력만 사용한다.
- `symlink or reparse path`: path-based 안전 경계가 실제 link/reparse를 따라가지
  않도록 입력·출력 경로를 새 regular file로 준비한다. link 생성 권한 실패를
  성공으로 바꾸지 않는다.
- `refusing to overwrite`: 새로운 report filename을 사용한다. 기존 report와
  Foundation 보고서를 지우지 않는다.
- 한글 경로 오류: PowerShell에서 경로를 따옴표로 감싸고 Python UTF-8 환경을
  확인한다. 경로 문제를 해결하려고 ASCII-only로 강제하지 않는다.

## 추가 증거 토론

학습자가 작성해야 하는 추가 요청은 최소한 다음을 포함한다.

- 각 source clock의 설정·동기화와 관찰 당시 offset 근거
- 독립 source의 corroborating event
- parser/tool 버전, 수집 방법, retention/visibility 범위
- 같은 파일 ID가 source마다 동일 대상을 뜻한다는 identity 근거
- 기록이 없는 구간의 원인이 retention gap인지 source 미수집인지 확인할 자료

“더 많은 로그”라고만 쓰지 말고, 어느 질문을 해결하기 위한 어떤 source인지
적게 한다.

## 검증 및 안전 확인

```powershell
python -m py_compile `
  "$lab\timeline_lab.py" `
  "$lab\cli.py" `
  "$lab\test_timeline_lab.py"
python -m unittest discover -s "$lab" -p "test_*.py" -v
```

현재 테스트는 표준 라이브러리 기반 CLI/분석 동작과 입력 경계를 확인한다. 실제
OS 파일 timestamp, disk image, NTFS/MFT/USN parser, deleted-file recovery는
검증 대상이 아니다. 이 lab은 Securium runtime import, DB write, Evidence/mastery
계산, canonical registration, approval, publication을 수행하지 않는다.

수강생 기록이 “PASS” checkbox만으로 끝나지 않게 하고, event ID·source·원래 값·UTC
값·해석 한계를 함께 쓰게 한다. 최종 결론은 “무엇이 관찰되었고 무엇이 아직
입증되지 않았는가”로 끝내야 한다.

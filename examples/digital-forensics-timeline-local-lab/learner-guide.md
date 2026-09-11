# Learner Guide: Synthetic Timeline Reasoning

## 실습 경계

이 실습의 모든 event와 합성 파일 ID는 창작된 교육용 값이다. 실제 디스크, 사용자
파일, 개인정보, 브라우저 기록, 계정, credential, 네트워크 대상, incident record를
사용하지 않는다. 이 도구는 forensic acquisition이나 NTFS/MFT/USN 분석기가 아니다.

## 수행 순서

### 1. 세 시각을 먼저 기록한다

아래 표를 시작 전에 작성한다.

| 구분 | 의미 | 실습에서 확인할 위치 |
| --- | --- | --- |
| fixture creation time | 합성 기록 묶음을 만든 시각 | JSON `fixture_created_at` |
| observed event time | source가 관찰했다고 기록한 사건 시각 | record `timestamp_original`, `timestamp_meaning` |
| analysis run time | 분석 명령을 실행한 시각 | report `analysis_run_at` |

### 2. fixture 생성

저장소 루트의 PowerShell에서 다음을 실행한다.

```powershell
$lab = ".\examples\digital-forensics-timeline-local-lab"
$work = Join-Path $env:TEMP "securium-forensics-timeline-learner"
New-Item -ItemType Directory -Force -Path $work | Out-Null

python "$lab\cli.py" generate `
  --output "$work\fixture.json" `
  --fixture-created-at "2026-09-11T09:15:00+09:00"
```

fixture를 열어 다음 질문에 답한다.

- event identity와 source identity는 각각 무엇인가?
- `synthetic_file_id`가 실제 경로인가, 교육용 식별자인가?
- timestamp의 의미가 `created`, `modified`, `accessed` 중 무엇인지 source가
  명시하는가?
- 같은 UTC 시각을 가리키는 event가 있는가?

### 3. 분석 실행

분석 실행 시각을 고정해 결과를 재현한다.

```powershell
python "$lab\cli.py" analyze `
  --input "$work\fixture.json" `
  --output "$work\report.json" `
  --analysis-run-at "2026-09-11T09:30:00+09:00"

Get-Content "$work\report.json"
```

report에서 `records`, `ordering.tie_groups`, `observed_facts`,
`potential_conflicts`, `interpretation_limits`를 확인한다. 원래 timestamp가
사라지고 UTC만 남아 있다면 결과를 완성된 관찰 기록으로 인정하지 않는다.

### 4. 관찰과 추론 기록

아래 기록지를 문서나 별도 학습자 파일에 복사해 실제 event ID와 report 근거를
기록한다. 체크박스만 채우지 말고 위치와 값을 적는다.

#### 관찰 기록

| event ID | source ID | synthetic file | original timestamp | UTC | source가 말한 의미 | report 근거 |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

#### 추론·한계 기록

| 질문 | 나의 기록 | 직접 근거 event/report 위치 |
| --- | --- | --- |
| 확정적으로 관찰한 사실은 무엇인가? |  |  |
| 동일 UTC tie에서 알 수 없는 것은 무엇인가? |  |  |
| potential conflict를 어떻게 표시했는가? |  |  |
| 실제 사용자 행위나 의도를 말할 수 없는 이유는? |  |  |
| 추가로 필요한 증거는 무엇인가? |  |  |

### 5. tie와 conflict 토론

`ordering.tie_groups`를 찾아 lexical event ID 정렬 순서를 적는다. 그 순서를
“먼저 발생한 사건”이라고 쓰지 말고 다음 문장을 완성한다.

> 이 순서는 ________을 위한 표시 순서이며, ________의 증거가 아니다.

`potential_conflicts`가 있다면 어느 source/file/UTC group에서 event type 또는
timestamp meaning이 달라졌는지 기록한다. 한 record를 임의로 정답으로 선택하지
말고, source documentation이나 독립 corroboration이 필요하다고 적는다.

### 6. 오류 입력 확인

원본 fixture를 편집하지 말고 복사본에서 수행한다. 다음 입력은 실패해야 한다.

- timezone 없는 `timestamp_original`
- ISO-8601이 아닌 timestamp
- duplicate `event_id`
- `scope`가 `synthetic-local-only`가 아닌 root
- malformed JSON 또는 2,000자를 넘는 `notes`

실패 명령의 non-zero exit code와 오류 의미를 기록한다. 오류를 성공으로 처리하거나
timezone을 실행 컴퓨터 설정으로 보정하지 않는다.

### 7. 재현성 확인

같은 입력을 같은 `--analysis-run-at`으로 다시 분석하면 report bytes와
`deterministic_result_sha256`가 일치한다. analysis time을 바꾸면 전체 report bytes는
달라질 수 있지만 deterministic result hash는 유지된다. 이는 동적 실행 시각과
분석 내용의 재현성을 구분하기 위한 관찰이다.

## 제출 기록

- Python/OS/shell:
- 실행 명령:
- input SHA-256:
- report bytes SHA-256:
- deterministic result SHA-256:
- 관찰한 tie group:
- 관찰한 potential conflict:
- 가장 중요한 해석 한계:
- 추가로 필요한 증거:
- 내가 확인하지 못한 항목:

마지막에 자신이 만든 임시 경로만 정리한다. 이 실습의 결과는 교육용 분석 기록이며
실제 수사, 법적 판단, 공식 자격 또는 delivery 완료를 의미하지 않는다.

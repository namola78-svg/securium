# AI Explainability Console Wireframes

AI Explainability Console은 AI 답변의 생성 과정을 투명하게 보여준다. 일반 사용자는 요약된 근거와 고지만 보고, 관리자는 전체 trace를 검토한다.

## Flow

```text
Question
↓
Expanded Query
↓
Concept Detection
↓
Alias Expansion
↓
Retrieval
↓
Context
↓
Citation
↓
Answer
↓
Feedback
↓
Reviewer Note
```

## Admin View

```text
[Trace Header]
  Request ID
  Provider / Model
  Status
  Latency
  Token / Cost
  Reviewed State

[Left Timeline]
  1. Question
  2. Expanded Query
  3. Concept Detection
  4. Alias Expansion
  5. Retrieval
  6. Context
  7. Citation
  8. Answer
  9. Feedback
  10. Reviewer Note

[Center Detail]
  Selected step detail
  Redacted prompt
  Retrieval result
  Context excerpts
  Citation list

[Right Inspector]
  Metadata
  Source context IDs
  Permission state
  Risk flags
  Reviewer actions
```

## User View

```text
[AI Explanation]
  Disclaimer
  Summary
  Reasoning summary
  Related citations
  Feedback buttons
```

사용자 화면에서는 시스템 프롬프트, 내부 점수, 전체 retrieval payload, 비용 정보, 관리자 검수 메모를 노출하지 않는다.

## Step Details

| Step | Admin Visible | User Visible |
| --- | --- | --- |
| Question | Redacted question context | Original visible question only |
| Expanded Query | Yes | No |
| Concept Detection | Yes | Concept summary only |
| Alias Expansion | Yes | No |
| Retrieval | Full result metadata | Citation titles only |
| Context | Redacted excerpts | Short evidence snippets |
| Citation | Full citation list | Citation list |
| Answer | Original + reviewed answer | Reviewed or generated answer |
| Feedback | Yes | Own feedback only |
| Reviewer Note | Yes | No |

## States

- Empty: “아직 AI Trace가 없습니다.”
- Loading: 단계별 skeleton timeline.
- Error: “AI Trace를 불러오지 못했습니다.”
- Insufficient Context: “검수된 근거가 부족하여 확정적인 설명을 제공하기 어렵습니다.”

## Reviewer Actions

- 검수 완료
- 수정 후 승인
- 반려
- 삭제
- 검수 콘텐츠로 복사


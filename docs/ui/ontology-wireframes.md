# Ontology Explorer Wireframes

Ontology Explorer는 개념, alias, synonym, parent/child, related concept, cross-course mapping을 탐색하고 검토하는 관리자 도구다.

## Explorer Layout

```text
[Console Shell]

[Left: Tree]
  Search
  Filters
  Concept Tree
  Saved Views

[Center: Concept Detail]
  Concept name
  Official / platform label
  Definition
  Related lessons
  Related questions
  Related curriculum nodes
  Cross-course mapping

[Right: Inspector Panel]
  Summary
  Metadata
  Alias
  Relation
  Coverage
  AI Usage
  Audit
  History
```

## Left Tree

- 목적: 개념 계층과 관계를 빠르게 탐색한다.
- 정보 우선순위: 공식 개념명 → 개념 유형 → coverage 상태 → child count.
- 상호작용: expand/collapse, keyboard navigation, search, filter.
- Empty State: “등록된 개념이 없습니다.”

## Center Concept Detail

- 목적: 선택한 개념의 학습·문제·커리큘럼 연결을 이해한다.
- 정보 우선순위: 정의 → 관계 → 연결 콘텐츠 → 관련 문제 → AI 사용.
- 주요 CTA: `관계 검토`, `콘텐츠 연결`.

## Right Inspector Panel

| Section | Content |
| --- | --- |
| Summary | 개념 요약, 상태, 검수 여부 |
| Metadata | stable key, source, version, updated at |
| Alias | 별칭, 동의어, 약어 |
| Relation | parent, child, related, prerequisite |
| Coverage | 연결된 curriculum node, lesson, question |
| AI Usage | retrieval 사용 횟수, 최근 AI trace |
| Audit | 최근 변경자, 변경 결과 |
| History | 버전 및 변경 이력 |

## Mobile Behavior

관리자용이므로 모바일은 read-only 검토 중심으로 제한한다.

- Tree는 상단 dropdown/search로 축약
- Concept Detail은 본문 중심
- Inspector는 drawer

## Accessibility

- Tree는 `aria-expanded`와 현재 선택 상태를 제공한다.
- 관계 그래프는 텍스트 기반 relation list를 함께 제공한다.
- 색상만으로 coverage 상태를 표현하지 않는다.


# SECURIUM Interaction Pattern Decisions

이 문서는 SECURIUM에서 Drawer, Dialog, Inspector, Split Panel, Tree, Wizard를 언제 사용하는지 정리한 의사결정 기준이다.

복잡한 관리자 Console과 학습 화면이 늘어날수록 “무엇을 어디에 보여줄지”가 제품 품질을 좌우한다.  
아래 기준은 화면 구현 전에 먼저 확인한다.

## 1. 빠른 판단표

| 패턴 | 사용할 때 | 피해야 할 때 |
| --- | --- | --- |
| Drawer | 현재 화면 맥락을 유지한 채 보조 정보나 메뉴를 보여줄 때 | 사용자의 최종 확인이 필요한 위험 작업 |
| Dialog | 사용자의 집중과 명확한 확인이 필요한 짧은 작업 | 긴 정보 탐색, 복잡한 편집 |
| Inspector | 선택한 대상의 상세 정보와 관련 액션을 계속 보여줄 때 | 화면 전체 흐름을 가로막아야 하는 작업 |
| Split Panel | 목록과 상세를 동시에 보며 비교·검토해야 할 때 | 모바일 단일 흐름, 간단한 상세 보기 |
| Tree | 계층 구조를 탐색하거나 부모/자식 관계가 핵심일 때 | 단순 목록, 계층이 의미 없는 데이터 |
| Wizard | 여러 단계가 순서대로 완료되어야 할 때 | 한 화면에서 충분히 끝나는 단순 폼 |

## 2. Drawer를 사용하는 경우

Drawer는 “현재 화면을 떠나지 않고 보조 작업을 수행”할 때 사용한다.

### 적합한 상황

- 모바일 내비게이션
- 계정 메뉴
- 필터 패널
- 선택 항목의 모바일 상세 보기
- 보조 액션 목록
- 짧은 설정 변경

### SECURIUM 예시

- 모바일 헤더 메뉴
- 프로필/계정 Drawer
- 관리자 목록의 모바일 필터
- CurriculumNode 상세를 모바일에서 하단 Drawer로 표시
- AI Trace의 근거 목록을 모바일 Drawer로 표시

### 기준

- 배경 스크롤을 막는다.
- ESC로 닫힌다.
- 닫기 버튼에는 `aria-label`을 제공한다.
- 메뉴 항목 선택 후 닫힌다.
- 데스크톱에서는 Inspector 또는 Split Panel이 더 적합한지 먼저 검토한다.

### 피해야 할 상황

- 삭제, 게시, 반려처럼 명시적 확인이 필요한 작업
- 긴 작성 폼
- 많은 테이블 데이터를 넣는 경우

## 3. Dialog를 사용하는 경우

Dialog는 “사용자가 잠시 멈추고 판단해야 하는 짧은 작업”에 사용한다.

### 적합한 상황

- 위험 작업 확인
- 게시/반려/보관 확인
- 짧은 입력
- 미리보기
- Command Palette
- 오류 복구 안내

### SECURIUM 예시

- 문제 게시 확인
- AI 검수 결과 반려 확인
- 커리큘럼 트리 ACTIVE 전환 확인
- 콘텐츠 보관 확인
- Command Palette

### 기준

- `role="dialog"`와 `aria-modal="true"`를 사용한다.
- ESC 닫기를 지원한다.
- focus가 Dialog 안에서 관리되어야 한다.
- 닫힌 뒤 원래 트리거로 focus를 돌려주는 것이 좋다.
- 위험 작업은 영향 범위를 문장으로 표시한다.

### 피해야 할 상황

- 긴 문서 읽기
- 복잡한 다단계 설정
- 목록과 상세를 오가며 비교해야 하는 검토 작업

## 4. Inspector를 사용하는 경우

Inspector는 “선택한 대상의 상세 정보와 관련 액션을 옆에 고정해 보여주는 패널”이다.

### 적합한 상황

- 목록 또는 Tree에서 항목을 선택한다.
- 선택 항목의 상세 정보가 자주 바뀐다.
- 사용자가 목록과 상세를 비교하며 판단한다.
- 관련 메타, 연결 상태, 액션을 함께 보여줘야 한다.

### SECURIUM 예시

- CurriculumNode 상세
- CourseLesson 상세
- Shared Content 상세
- Ontology Concept 상세
- AI Trace 상세
- Coverage Gap 상세
- AuditLog 상세

### 기준

- 공식 명칭 또는 대표 제목을 가장 먼저 보여준다.
- 상태는 반복 문장 대신 Badge로 표시한다.
- stable key, source page, version, review status 같은 메타는 `dl` 구조로 표시한다.
- 액션은 하단에 모은다.
- 모바일에서는 Drawer 또는 본문 아래 패널로 전환한다.

### 피해야 할 상황

- 사용자의 단일 확인만 필요한 작업
- 항목 선택 없이 독립적으로 긴 내용을 작성하는 화면

## 5. Split Panel을 사용하는 경우

Split Panel은 “목록/탐색 영역과 상세/작업 영역을 동시에 보여줄 때” 사용한다.

### 적합한 상황

- 왼쪽 목록, 오른쪽 상세
- 왼쪽 Tree, 오른쪽 Inspector
- 왼쪽 필터 결과, 오른쪽 작업 패널
- 대량 데이터 검수
- 연결 상태 비교

### SECURIUM 예시

- Curriculum Console
- Ontology Console
- AI Explainability Console
- Shared Content Mapping
- Coverage Gap Queue
- AuditLog 상세 조회

### 기준

- 왼쪽은 탐색과 선택, 오른쪽은 상세와 액션에 집중한다.
- 모바일에서는 단일 column으로 전환한다.
- 선택된 항목이 명확해야 한다.
- URL query로 선택 상태를 유지할지 화면별로 결정한다.

### 피해야 할 상황

- 공개 랜딩처럼 메시지 전달이 중요한 화면
- 선택-상세 관계가 없는 단순 카드 목록
- 모바일에서 너무 많은 정보를 동시에 보여주려는 경우

## 6. Tree를 사용하는 경우

Tree는 “계층 관계 자체가 사용자의 이해와 조작에 중요할 때” 사용한다.

### 적합한 상황

- 공식 출제기준 계층
- 과목 → 주요항목 → 세부항목 → 세세항목
- Concept parent/child
- 콘텐츠 연결 위치 탐색
- 커버리지 누락 위치 확인

### SECURIUM 예시

- CurriculumTree
- Learn Curriculum Path
- Ontology Parent/Child
- CurriculumNode Mapping
- Coverage Tree

### 기준

- 중첩 카드보다 compact tree list를 우선한다.
- 기본 상태는 필요한 단계까지만 펼친다.
- expand/collapse와 전체 펼치기/접기를 제공한다.
- 공식 명칭을 첫 번째 시각 요소로 둔다.
- stable key는 보조 텍스트로 낮추고 복사 기능을 제공한다.
- 내부 타입보다 한글 사용자 명칭을 우선한다.

### 피해야 할 상황

- 계층이 1단계뿐인 데이터
- 정렬/필터/비교가 핵심인 데이터
- 많은 열을 동시에 봐야 하는 데이터

이 경우 Table이 더 적합하다.

## 7. Wizard를 사용하는 경우

Wizard는 “순서가 중요한 다단계 작업”에 사용한다.

### 적합한 상황

- 한 단계의 결과가 다음 단계 입력에 영향을 준다.
- 사용자가 전체 과정을 한 번에 이해하기 어렵다.
- 중간 저장, 검증, 미리보기가 필요하다.
- 완료 전 체크리스트가 필요하다.

### SECURIUM 예시

- 새 과정 생성
- 공식 커리큘럼 import
- 대량 콘텐츠 연결
- 모의고사 생성
- AI 검수본 게시
- Ontology Concept 대량 매핑
- Production 활성화 체크리스트

### 권장 단계 구조

```text
1. 기본 정보
2. 연결 대상 선택
3. 콘텐츠 또는 문제 구성
4. 검증 결과 확인
5. 게시 또는 저장
```

### 기준

- 현재 단계와 전체 단계를 표시한다.
- 이전/다음/저장 후 나가기 동작을 명확히 한다.
- 각 단계의 validation 오류를 가까이에 표시한다.
- 마지막 단계에는 영향 범위와 요약을 보여준다.
- 운영 데이터 변경은 감사로그와 연결한다.

### 피해야 할 상황

- 한 화면에서 충분히 끝나는 간단한 폼
- 단계 순서가 중요하지 않은 필터 설정
- 반복적으로 빠르게 처리해야 하는 Queue 작업

이 경우 Form, Dialog, Split Panel이 더 적합하다.

## 8. SECURIUM 의사결정 흐름

새 UI를 만들 때 다음 순서로 판단한다.

```text
1. 계층 관계가 핵심인가?
   → 예: Tree

2. 목록과 상세를 동시에 비교해야 하는가?
   → 예: Split Panel + Inspector

3. 선택한 항목의 상세를 계속 보여줘야 하는가?
   → 예: Inspector

4. 현재 화면을 유지한 채 보조 정보를 잠깐 보여주면 되는가?
   → 예: Drawer

5. 사용자가 멈춰서 확인해야 하는가?
   → 예: Dialog

6. 여러 단계를 순서대로 완료해야 하는가?
   → 예: Wizard

7. 단순 실행인가?
   → Button 또는 Inline Form
```

## 9. 대표 조합

### Curriculum Console

```text
Tree + Split Panel + Inspector + Search + Badge
```

### Ontology Console

```text
Table + Tree + Split Panel + Inspector + Tabs + Search
```

### AI Trace Console

```text
Table + Inspector + Tabs + Dialog + Badge
```

### Mobile Learner Navigation

```text
Drawer + Button + Badge
```

### Production Activation

```text
Wizard + Dialog + Audit + Badge
```

## 10. 원칙

- 사용자를 막아야 하면 Dialog.
- 맥락을 유지하고 보조 정보를 보여주면 Drawer.
- 선택 항목을 계속 설명해야 하면 Inspector.
- 비교와 검토가 핵심이면 Split Panel.
- 계층이 핵심이면 Tree.
- 순서와 검증이 핵심이면 Wizard.

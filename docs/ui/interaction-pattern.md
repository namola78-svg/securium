# Interaction Pattern

SECURIUM 인터랙션은 빠른 학습 흐름과 안전한 관리자 작업을 동시에 지원해야 한다.

Interaction Pattern은 화면 구조가 확정된 뒤 적용한다. Hover, Focus, Selection, Expand/Collapse, Drawer, Dialog는 컴포넌트마다 다르게 구현하지 않고 제품 전체 기준을 따른다.

## Hover

- 클릭 가능한 카드와 행에만 적용한다.
- 과도한 shadow보다 border, surface change를 우선한다.

## Focus

- 모든 interactive element는 명확한 focus-visible ring을 가진다.
- 키보드 사용자는 hover 없이도 같은 정보를 확인할 수 있어야 한다.

## Selection

- Tree, Table, Timeline에서 선택 상태를 명확히 표시한다.
- 선택된 항목은 Inspector와 동기화된다.

## Drag

- 정렬이 필요한 관리자 화면에서만 사용한다.
- drag만 제공하지 말고 keyboard 또는 숫자 기반 정렬 대체 수단을 제공한다.

## Expand / Collapse

- Tree와 Disclosure에 사용한다.
- `aria-expanded`를 상태와 동기화한다.
- 기본 펼침은 사용자가 한 화면에서 맥락을 이해할 수 있는 수준까지만 허용한다.

## Keyboard

- Command Palette: `Ctrl/Cmd + K`, Arrow, Enter, Esc
- Dialog/Drawer: Esc 닫기, focus trap
- Tree: Arrow navigation 확장 고려

## Dialog

- 위험 작업 확인, 짧은 폼, 중단이 필요한 결정을 처리한다.
- 닫기 후 focus를 원래 trigger로 돌려준다.

## Drawer

- 상세 정보, inspector, 모바일 보조 패널에 사용한다.
- 배경 스크롤 차단과 Esc 닫기를 지원한다.

## Transition

- 화면 이동보다 상태 전환에 작게 사용한다.
- 학습 본문 읽기를 방해하는 과한 animation은 피한다.

## Animation

- 목적: 변화 인지, 위치 관계 이해, 피드백.
- 금지: 필수 정보 노출 지연, 과도한 장식, motion sickness 유발.
- `prefers-reduced-motion`을 존중한다.

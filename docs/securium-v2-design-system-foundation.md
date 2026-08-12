# SECURIUM V2 Design System Foundation

Status: Phase 1 foundation only

Date: 2026-08-11

Production adoption: none

## 1. Foundation Contract

V2 token definition은 Production token migration이 아니다. V2 값은 `V2Foundation` 경계 내부에서만 존재하며, 현재 route, layout, shell, navigation, page, shared component는 이 경계를 사용하지 않는다.

```tsx
import { V2Foundation } from "@/components/v2";

// Phase 2 이후 승인된 pilot에서만 사용한다.
<V2Foundation>{/* V2 pilot presentation */}</V2Foundation>;
```

이 예시는 adoption contract를 설명하기 위한 것이며 Phase 1에서는 Production 화면에 적용하지 않는다.

## 2. Files

| File | Responsibility |
| --- | --- |
| `components/v2/v2-foundation.module.css` | 격리된 V2 raw/semantic token과 focus/motion contract |
| `components/v2/v2-foundation.tsx` | token을 활성화하는 유일한 opt-in boundary |
| `components/v2/index.ts` | 향후 V2 public component entry |
| `tests/v2-design-system-foundation.test.ts` | root token 비변경과 Production 미적용 guard |

CSS Module을 사용하므로 root layout이나 `app/globals.css`에서 V2 stylesheet를 import하지 않는다. V2 wrapper가 사용되지 않는 현재 Production UI에는 V2 cascade가 추가되지 않는다.

## 3. Color Foundation

Raw palette와 semantic role을 분리한다.

### 3.1 Surface and text

| Token | Role |
| --- | --- |
| `--v2-color-bg-canvas` | page canvas |
| `--v2-color-bg-subtle` | grouped background |
| `--v2-color-bg-inverse` | dark learning/brand context |
| `--v2-color-surface-default` | default card/control surface |
| `--v2-color-surface-raised` | elevated surface |
| `--v2-color-surface-selected` | selected state |
| `--v2-color-surface-disabled` | unavailable state |
| `--v2-color-text-primary/secondary/muted/inverse/disabled` | semantic text hierarchy |
| `--v2-color-border-default/subtle/strong` | structural borders |

### 3.2 Action and status

| Token | Role |
| --- | --- |
| `--v2-color-action-primary` | primary action background |
| `--v2-color-action-primary-hover` | primary hover |
| `--v2-color-action-primary-text` | primary action text |
| `--v2-color-action-secondary*` | secondary action surface/text |
| `--v2-color-accent/strong` | highlight and brand accent |
| `--v2-color-success/warning/danger/info` | semantic state |
| `--v2-color-ai` | AI-generated/contextual helper identity |
| `--v2-color-focus/inverse` | keyboard focus on light/dark surface |

색상만으로 상태를 전달하지 않는다. 상태명, icon 또는 구조적 label을 함께 사용한다.

## 4. Typography Foundation

- 기존 Production font family를 fallback으로 재사용하며 font import를 추가하지 않는다.
- 최소 caption은 12px equivalent이며 10~11px token을 만들지 않는다.
- Korean body 기본은 16px/1.65이다.
- Size roles: caption, label, body-sm, body, body-lg, heading-sm/md/lg/xl, display.
- Heading letter spacing은 `-0.025em`, 본문에는 별도 negative tracking을 적용하지 않는다.
- Weight roles: regular, medium, semibold, bold.

## 5. Spacing Foundation

4px 계열을 유지하면서 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px을 명명한다. 신규 V2 component는 임의 spacing을 추가하기 전에 이 scale로 해결 가능한지 확인한다.

## 6. Radius and Shadow Foundation

Radius는 control, small/medium/large surface, pill의 5개 역할로 제한한다. Shadow는 none, surface, raised, overlay의 4개 elevation으로 제한한다. 상태 표현을 shadow 강도만으로 구분하지 않는다.

## 7. Focus and Target Size

- 기본 focus width/offset은 각각 3px이다.
- light surface focus와 inverse surface focus 색을 분리한다.
- `data-v2-focus-ring`은 V2 scope 내부 interactive primitive가 사용할 명시적 hook이다.
- control 최소 크기는 `2.75rem`(44px)이다.
- native focus를 제거하려면 같은 declaration 안에서 V2 focus indicator를 반드시 제공해야 한다.

## 8. Motion Foundation

| Role | Duration |
| --- | ---: |
| instant | 1ms |
| fast | 120ms |
| base | 180ms |
| slow | 260ms |

`prefers-reduced-motion: reduce`에서는 V2 scope의 fast/base/slow token이 instant로 축소된다. Motion은 상태 변화 이해를 돕는 용도로만 사용하며 필수 정보를 animation에 의존하지 않는다.

## 9. Responsive Foundation

Phase 1에서는 기존 media query를 통합하거나 값을 바꾸지 않는다. 향후 V2 component 설계 기준만 다음처럼 고정한다.

| Range | Design intent |
| --- | --- |
| 0–639px | mobile |
| 640–1023px | tablet/compact |
| 1024–1439px | desktop |
| 1440px+ | wide workspace |

CSS custom property는 media query condition에 사용할 수 없으므로 breakpoint 숫자를 token처럼 CSS에 선언하지 않는다. 각 V2 component는 필요한 container behavior를 우선 검토하고, viewport query는 위 역할에 맞춰 제한한다.

## 10. Primitive Boundary

Phase 1의 유일한 신규 primitive는 `V2Foundation`이다. Button, Badge, Card, Input 등을 미리 복제하지 않는다. 기존 `ActionButton`, `StatusBadge`, `ProgressBar`, state UI를 실제 V2 pilot에서 평가한 뒤 adapter, extension, replacement 중 하나를 결정한다.

## 11. Production Regression Guard

자동 검증은 다음을 보장한다.

1. V2 CSS에 `:root`가 없다.
2. 기존 Production token의 baseline 값이 유지된다.
3. `app/globals.css`에 V2 selector/token이 없다.
4. `app/**`와 기존 `components/**`에서 `V2Foundation`을 소비하지 않는다.
5. focus, reduced motion, 44px minimum target token이 존재한다.

## 12. Phase Boundary

이번 Phase에서 하지 않은 작업:

- Landing/Login/Signup/Dashboard/Learner/Admin 화면 V2 적용
- Header, sidebar, drawer, bottom navigation 변경
- route, auth, API, DB, taxonomy, curriculum, Content V3 변경
- 기존 global token migration
- breakpoint consolidation
- legacy CSS 삭제

Phase 2 pilot을 시작하기 전에는 대상 화면, visual baseline, rollback 단위, accessibility acceptance criteria를 별도로 승인해야 한다.

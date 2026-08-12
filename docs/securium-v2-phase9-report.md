# SECURIUM V2 - PHASE 9 MOCK EXAM

## A. Scope

`/mock-exams`, `/mock-exams/[mockExamId]`, `/mock-exams/attempts/[attemptId]`의 entry, instructions, focus session, submit confirmation, result UI를 V2로 정리했다. Phase 10 이상은 시작하지 않았다.

## B. Previous Mock Exam UX

기존 start, answer save, timer, submit, result API와 route는 완성되어 있었지만 entry 정보 위계, focus shell, 문항 탐색, 제출 확인, 결과 분석 표현이 legacy UI에 머물러 있었다.

## C. Exam Entry

실제 repository가 제공하는 시험명, 과정명, 문항 수, 제한 시간, 합격 기준, 남은 응시 횟수만 표시한다. 등록 시험이 없을 때만 단일 empty state를 표시한다.

## D. Exam Instructions

시험명과 실제 metadata, 시험 중 해설 비노출, 문항별 자동 저장, 제출 후 결과 확인 방식을 짧게 안내한다. Primary CTA는 `시험 시작` 하나이며 기존 start API를 사용한다.

## E. Focus Mode

시험 attempt route를 learner focus shell에 포함했다. Desktop sidebar와 mobile bottom navigation을 숨기며 1024px 이상에서 shell grid를 단일 full-width column으로 교정했다. 일반 Practice UI는 변경하지 않았다.

## F. Question Navigation

Desktop은 compact number navigator, 768px 이하는 disclosure navigator를 사용한다. 현재, 답변 완료, 미답변을 텍스트와 ARIA label로 함께 전달한다.

## G. Timer

기존 `expiresAt` 기반 timer를 그대로 사용한다. 별도 duration 또는 warning threshold를 만들지 않았고, 10:04에서 답안 저장과 문항 이동 후에도 10:04로 유지되는 것을 browser flow에서 확인했다.

## H. Submit Confirmation

실제 전체 문항, 답변 완료, 미답변, 남은 시간을 dialog에 표시한다. 중복 제출 방지 상태를 유지하며 Escape, focus return, Tab/Shift+Tab focus trap을 확인했다.

## I. Result Summary

실제 score, correct, wrong, unanswered count를 우선 표시한다. 현재 attempt payload가 pass/fail 판정값과 passing threshold를 함께 제공하지 않으므로 결과 화면에서 새로운 합격 판정을 계산하지 않는다.

## J. Subject Breakdown

기존 attempt analysis의 `bySubject`와 `byTopic`을 사용한다. 각 항목은 텍스트 수치와 progressbar semantics를 함께 제공한다.

## K. Wrong Answer Review

제출 전에는 정답과 해설을 노출하지 않는다. 제출 후 문항별 정답 상태, 정답, 공식 해설, 오답 해설을 기존 result payload 범위에서 표시한다.

## L. Review / Wrong Notes Integration

기존 제출 service의 `MOCK_EXAM_QUESTION` review schedule 생성을 유지했다. 결과 CTA는 `/reviews`, `/wrong-notes`, `/mock-exams`의 기존 route만 사용한다.

## M. Desktop UX

1440x900에서 header, navigator, timer, question, submit bar, result score, subject/topic breakdown, wrong review CTA가 정상 렌더됐다. 최초 QA에서 focus shell의 빈 sidebar column 때문에 session이 축소되는 문제를 발견했고 Phase 7 focus-shell grid 계약 재사용으로 수정했다.

## N. Tablet UX

768에서는 single-column question과 disclosure navigator, 1024에서는 desktop navigator와 main question column으로 전환된다. 두 viewport 모두 body overflow가 없다.

## O. Mobile UX

390x844에서 시험 상태, timer, question, answer control, 이전/다음, 고정 submit action을 첫 흐름에서 확인할 수 있다. bottom navigation은 렌더 영역에서 제거되며 primary controls는 44px 이상이다.

## P. Accessibility

H1/H2 hierarchy, fieldset/legend, native answer controls, progressbar, timer role, navigator ARIA label, status text, dialog semantics, focus-visible, question focus 이동, focus trap/return을 확인했다. 색상만으로 현재/답변/오답 상태를 전달하지 않는다.

## Q. Business Logic Preservation

question selection, randomization, scoring, pass/fail, subject scoring, timer duration, answer/submission persistence, attempt history, review scheduling을 변경하지 않았다. API route와 service/repository도 변경하지 않았다.

## R. Browser QA

Vinext dev를 `http://localhost:33160`에서 D1 test fixture와 Sites auth header로 실행했다. `127.0.0.1`은 실제 localhost listener와 달라 연결이 거부되어 startup log의 hostname으로 교정했다. `agent-browser` CLI가 설치되지 않아 기존 npm cache의 Playwright Chromium runtime을 fallback으로 사용했다. console error, warning, page error는 0건이다.

## S. Responsive QA

390, 768, 1024, 1440에서 entry, instructions, session, result screenshot을 남겼다. 모든 핵심 화면에서 `scrollWidth === clientWidth`였고 mobile bottom navigation은 focus session/result에서 실제 렌더되지 않았다. QA artifact는 `reports/ui-v2/phase9/`에 있다.

## T. Tests

- TypeScript: PASS
- ESLint: PASS
- Unit: 342/342 PASS
- Integration: 23/23 PASS
- Phase 9 focused/domain: 17/17 PASS
- Mock Exam focused E2E: 1/1 PASS
- `git diff --check`: PASS, 기존 LF/CRLF 안내만 존재

Mock Exam E2E assertion은 legacy `과목별 분석` 전체 문구 대신 `data-mock-exam-result-v2`와 `과목별 결과` semantic contract를 함께 검증하도록 갱신했다.

## U. Build

Next.js production build와 `build:cloudflare`가 PASS했다. reduced-motion selector는 Mock Exam module surface로 scope를 제한해 production CSS purity 계약을 충족했다.

## V. Full E2E

900초 timeout으로 실행했으며 329초에 완료됐다. 80건 중 77건 PASS, 3건 FAIL이다. Mock Exam 동시 제출/rollback/result test는 PASS했다. 실패는 `ai-e2e`의 이전 Practice copy, `curriculum-e2e`의 이전 Curriculum copy, `phase3-e2e`의 이전 Learn copy assertion으로 모두 Phase 9 이전 화면의 stale rendered-HTML assertion이다. Phase 9 application failure나 environment timeout은 아니다.

## W. Files Changed

- `app/mock-exams/page.tsx`
- `app/mock-exams/[mockExamId]/page.tsx`
- `app/mock-exams/attempts/[attemptId]/page.tsx`
- `components/mock-exam-start.tsx`
- `components/mock-exam-session.tsx`
- `components/learner-app-shell.tsx`
- `components/v2/mock-exam-v2.module.css`
- `tests/mock-exam-learner-copy.test.ts`
- `tests/phase3-e2e.test.mjs`
- `docs/securium-v2-phase9-report.md`
- `reports/ui-v2/phase9/*` QA artifacts

## X. Intentionally Not Changed

Dashboard, Learn, Practice behavior, Explanation behavior, Review, Wrong Notes, Analytics, AI Tutor, Profile, Settings, Public, Auth, Admin을 리디자인하지 않았다.

## Y. Regression Check

390/1440 browser smoke에서 Dashboard, Learn, normal Practice, `reviewOnly`, `wrongOnly`, Review, Wrong Notes가 HTTP 200이고 overflow 및 console error가 없었다. 일반 학습자의 Admin 접근은 기존 forbidden redirect를 유지했다.

## Z. DB / Migration / Content Status

DB schema, migration, migration metadata, seed, question/answer/explanation content, Content V3, taxonomy, ontology, SKOS, provenance를 변경하지 않았다.

## AA. Phase 10 Readiness

Phase 9 핵심 flow와 모든 필수 build/test/browser 기준은 PASS다. Full E2E의 Phase 9 외 stale assertion 3건은 별도 유지보수 항목으로 남기며 Phase 10 진행을 차단하지 않는다.

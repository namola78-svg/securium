# Production Manual QA Checksheet

This checksheet is the final hands-on browser review for SECURIUM before a production release decision.

Target:

`https://securium.vercel.app`

Use this document in order. It is written as a click-by-click flow rather than a system checklist.

## Safety rules

- Do not paste secrets into screenshots, notes, tickets, or this file.
- Do not run production migration or seed scripts from this checksheet.
- Do not perform destructive admin actions.
- Use prepared test accounts only.
- Record failures with expected result, actual result, URL, viewport, and browser.

## Browser setup

| Item | Value |
| --- | --- |
| Browser | TBD |
| Viewport | Desktop first, then mobile 390 × 844 |
| Test account | Prepared learner account |
| Admin account | Prepared admin account |
| Candidate commit | TBD |
| Vercel deployment | TBD |

## 1. Public visitor flow

| Step | Action | Expected | Result |
| --- | --- | --- | --- |
| 1 | Open `/` | SECURIUM landing page renders. | TBD |
| 2 | Click logo | Returns to home. | TBD |
| 3 | Click `과정 둘러보기` | Goes to `/courses`. | TBD |
| 4 | Open a course detail | Course intro, target learner, difficulty, duration, topics, questions, and CTA render. | TBD |
| 5 | Click logged-out course CTA | Goes to `/login?return_to=<internal path>`. | TBD |
| 6 | Try unsafe `return_to` manually | External or script URL is not used. | TBD |

## 2. Authentication flow

| Step | Action | Expected | Result |
| --- | --- | --- | --- |
| 1 | Open `/login` while logged out | Login form renders. | TBD |
| 2 | Submit empty form | Field-level validation appears. | TBD |
| 3 | Login with valid account | Lands on `/dashboard` or safe `return_to`. | TBD |
| 4 | Refresh page | Session remains active. | TBD |
| 5 | Open `/login` while logged in | Redirects away from login form. | TBD |
| 6 | Click logout | Session clears and UI switches to logged-out state. | TBD |
| 7 | Back to protected page | Protected content is not shown. | TBD |

## 3. Learner flow

| Step | Action | Expected | Result |
| --- | --- | --- | --- |
| 1 | Login as learner | Learner header and account menu render. | TBD |
| 2 | Open `/dashboard` | Next learning action and course summary render. | TBD |
| 3 | Open `/my-courses` | Enrolled courses render with separated progress. | TBD |
| 4 | Open course detail | CTA reflects enrolled or unenrolled state. | TBD |
| 5 | Add course if needed | Button disables during action and avoids duplicate enrollment. | TBD |
| 6 | Open `/learn/information-security-engineer` | Curriculum path renders. | TBD |
| 7 | Open lesson or CourseLesson | Lesson content and progress action render. | TBD |
| 8 | Complete or revisit lesson | Progress remains idempotent. | TBD |
| 9 | Open `/practice` | Practice entry renders. | TBD |
| 10 | Submit answer | Graded once; answer is not exposed before submit. | TBD |
| 11 | Open `/wrong-notes` | Empty or populated state is clear. | TBD |
| 12 | Open `/reviews` | Review queue or empty state is clear. | TBD |
| 13 | Open `/analytics` | Sparse data does not break the page. | TBD |

## 4. AI flow

| Step | Action | Expected | Result |
| --- | --- | --- | --- |
| 1 | Open AI Tutor path | Page renders or unavailable state is explicit. | TBD |
| 2 | Request AI explanation where available | Response is marked reference-only. | TBD |
| 3 | Inspect citations/context if shown | Sources are understandable and non-sensitive. | TBD |
| 4 | Trigger unavailable or empty context state | Safe fallback message appears. | TBD |

## 5. Admin flow

| Step | Action | Expected | Result |
| --- | --- | --- | --- |
| 1 | Login as non-admin and open `/admin` | Access is denied or redirected. | TBD |
| 2 | Login as admin and open `/admin` | Admin Console Shell renders. | TBD |
| 3 | Open `/admin/curriculum` | Compact tree, stable key copy, source page, and inspector render. | TBD |
| 4 | Open `/admin/coverage` | Queue and inspector render. | TBD |
| 5 | Open `/admin/ontology` | Explorer and inspector render. | TBD |
| 6 | Open `/admin/ai-explainability` | Trace, retrieval, citation, and inspector sections render. | TBD |
| 7 | Open `/admin/content-revisions` | Revision list and inspector render. | TBD |
| 8 | Open `/admin/audit-logs` | Audit list renders without edit/delete controls. | TBD |

## 6. Mobile flow

| Step | Action | Expected | Result |
| --- | --- | --- | --- |
| 1 | Set viewport to 390 × 844 | No horizontal scroll. | TBD |
| 2 | Open mobile menu | `aria-expanded` changes and menu is visible. | TBD |
| 3 | Click menu item | Menu closes and route changes. | TBD |
| 4 | Press ESC with menu open | Menu closes. | TBD |
| 5 | Open account drawer | Focus, labels, and logout action are usable. | TBD |
| 6 | Review course cards | Cards remain readable in one column. | TBD |

## 7. Final result

| Area | Result | Notes |
| --- | --- | --- |
| Public | TBD | |
| Auth | TBD | |
| Learner | TBD | |
| AI | TBD | |
| Admin | TBD | |
| Mobile | TBD | |

Decision:

- GO
- CONDITIONAL GO
- NO-GO

Rationale:

TBD

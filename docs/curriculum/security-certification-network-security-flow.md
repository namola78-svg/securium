# 정보보안 자격 과정 네트워크보안 학습 흐름 검증

이 문서는 정보보안기사와 정보보안산업기사의 네트워크보안 과목이
공유 본문 콘텐츠를 재사용하면서도 과정별 학습 진도와 문제풀이 흐름을
분리하는지 확인하기 위한 로컬 검증 기준을 정리한다.

## 검증 대상

- 공유 본문 콘텐츠:
  `content-official-security-cert-network-security-overview`
- 공유 canonical key:
  `official.security-certification.network-security.overview`
- 정보보안기사 CourseLesson:
  `course-lesson-ise-official-network-security-overview`
- 정보보안산업기사 CourseLesson:
  `course-lesson-isie-official-network-security-overview`
- 문제풀이 라우트 패턴:
  `/practice/[courseSlug]`

## 기대 동작

1. 네트워크보안 본문은 하나의 Content 레코드로 유지한다.
2. 정보보안기사와 정보보안산업기사는 각각 별도 CourseLesson으로 연결한다.
3. 사용자 진도는 Lesson이나 Content가 아니라 CourseLesson 기준으로 분리한다.
4. 문제풀이 진입은 course slug를 통해 과정 범위를 유지한다.
5. 문제은행·추천 검색에 필요한 핵심 토큰이 본문 또는 메타데이터에 포함되어야 한다.
6. 과정별 시험 포인트와 실무 메모는 CourseLessonExtension에서 분리한다.

## 문제은행 연결 준비 토큰

현재 네트워크보안 본문은 다음 토큰을 포함해야 한다.

- `DoS/DDoS`
- `스캐닝`
- `스푸핑`
- `스니핑`
- `Firewall`
- `IDS/IPS`
- `VPN`
- `NAC`
- `SIEM`

이 검증은 실제 운영 문제를 생성하거나 운영 DB seed를 적용하지 않는다.
로컬 도메인 테스트로 공유 콘텐츠, CourseLesson 연결, 진도 분리, 문제풀이
연결 준비 상태를 고정하는 것이 목적이다.

## 과정별 Extension 차등 적용

공유 본문은 동일하지만, 정보보안기사와 정보보안산업기사는 다음 항목을
CourseLessonExtension으로 다르게 제공한다.

| 과정 | Extension | 강조점 |
| --- | --- | --- |
| 정보보안기사 | `course-lesson-extension-ise-official-network-security-overview` | 실기형 로그·구성도·보안장비 설정 분석, 서술형 대응 방안 작성 |
| 정보보안산업기사 | `course-lesson-extension-isie-official-network-security-overview` | 네트워크 계층·프로토콜·대표 공격·기본 대응 구분 |

이 구조는 공통 Content를 수정하지 않고도 과정별 학습 목표, 시험 포인트,
실무 메모, 오답 주의사항을 조정할 수 있게 한다.

## 실행

```powershell
node --test tests/security-certification-course-lessons-seed.test.ts
```

# 백업 및 복구

## 현재 범위

현재 운영 데이터 계층은 `.openai/hosting.json`의 `DB` binding을 사용하는 Cloudflare D1/Drizzle 구조다. R2 binding은 `null`이며 Supabase DB와 Storage는 준비 코드와 문서만 있고 실제 연결 완료 상태가 아니다.

이 문서는 운영 절차의 기준이다. 실제 백업 작업, 보존 위치, 암호화 키, RPO와 RTO는 운영기관이 승인하고 배포 환경에서 검증해야 한다.

## DB 백업

- 배포 전과 migration 전에 대상 DB, 환경, schema 버전을 식별한다.
- 공급자가 지원하는 일관된 export 또는 시점 복구 기능을 사용한다.
- 백업 파일은 암호화하고 Production 접근권한과 분리된 최소 권한 저장소에 보관한다.
- 백업 파일명과 메타데이터에는 환경, 생성 시각, schema 버전, 애플리케이션 버전, 체크섬을 기록하되 개인정보를 넣지 않는다.
- 백업 성공 로그만으로 복구 가능성을 간주하지 않는다. 정기적으로 격리 환경에서 복구 시험을 수행한다.
- `db:seed`는 복구 도구가 아니며 Production 데이터에 실행하지 않는다.

Supabase 전환 시에는 D1 원본 백업과 Supabase 복구 지점을 모두 확보한다. cutover 이후 양쪽에 쓰기가 존재하면 백업 시점과 데이터 분기를 별도로 기록한다.

## Storage 백업

현재 실제 원격 Storage 연결은 완료되지 않았다. Storage가 활성화되면 다음 항목을 함께 백업해야 한다.

- 객체 본문
- 서버 생성 storage key
- MIME, 크기, 공개/비공개 구분
- 소유자 및 연결 콘텐츠 ID
- 버전과 체크섬
- signed URL이 아니라 원본 객체와 접근 정책

향후 Supabase Storage 또는 R2를 사용할 때에는 DB와 객체 저장소의 복구 시점을 맞추고, 누락 객체와 orphan 객체를 탐지하는 정합성 작업을 별도로 둔다.

## Migration 전 절차

1. 대상 환경과 migration 목록을 확정한다.
2. destructive 여부와 이전 애플리케이션 버전 호환성을 검토한다.
3. 최신 DB 백업과 Storage 백업 완료를 확인한다.
4. 폐기 가능한 복제본에 migration과 애플리케이션 검증을 수행한다.
5. 복구 또는 forward-fix 결정 기준과 담당자를 정한다.
6. 승인된 별도 작업으로 migration을 실행한다. Build 명령에는 migration을 포함하지 않는다.

## 복구 시험

복구 시험은 Production과 분리된 환경에서 수행한다.

1. 새 빈 대상에 DB와 Storage를 복구한다.
2. schema/migration 상태와 주요 행 수를 비교한다.
3. 참조 무결성과 고아 레코드를 검사한다.
4. 아래 핵심 시나리오를 읽기 중심으로 검증한다.
5. 쓰기 검증이 필요하면 시험 전용 계정과 데이터를 사용한다.
6. 결과, 소요 시간, 데이터 손실 범위, 발견 문제를 기록한다.

## 복구 후 정합성 확인

- 사용자, 역할, 활성 `SUPER_ADMIN` 수
- 과정, 과목, 주제, 수강 등록의 과정별 분리
- Lesson/LessonProgress와 이론 진도
- AudioProgress와 LectureProgress, 메모, 즐겨찾기
- QuestionAttempt, WrongNote, ReviewSchedule
- MockExamAttempt, 답안, 결과와 제출 상태
- 과정·과목·주제 통계와 0 분모 처리
- 콘텐츠 revision의 최신 버전 단일성
- AI 결과와 관리자 검수본의 분리
- 감사로그의 연속성, request ID와 민감정보 미포함
- Storage 객체의 체크섬, 공개 범위와 소유권

## 장애 시 원칙

- Production 데이터를 임의 초기화하거나 Seed로 대체하지 않는다.
- 백업 이후 발생한 학습 기록의 손실 범위를 먼저 산정한다.
- 복구와 forward fix 중 더 안전한 방법을 승인권자가 선택한다.
- 관리자 권한을 임시 공용 계정으로 우회하지 않는다.
- 복구 완료 후 자격 증명, signed URL, 세션과 캐시의 무효화 필요성을 검토한다.
- 실제 복구 실행, 승인자, 검증자, 결과는 변경 불가능한 운영 기록으로 남긴다.

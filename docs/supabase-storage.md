# Supabase Storage

Storage Provider, 검증 정책과 REST adapter는 코드 준비 완료다. 실제 프로젝트, bucket, policy와 signed URL은 검증하지 않았다.

- `LocalStorageProvider`: 메모리 기반 개발/테스트 전용
- `SupabaseStorageProvider`: 서버 전용 Service Role REST 요청
- 논리 bucket과 실제 bucket 이름을 환경변수로 매핑
- 서버 생성 object key
- MIME, 확장자, 크기, SVG·실행 콘텐츠와 경로 조작 차단
- private read 전 서버 RBAC/소유권 검증
- 60~3600초 signed URL

`public-thumbnails`만 공개 URL을 허용한다. 오디오, 강의, 과정 자산과 관리자 import는 비공개다. 실제 bucket 생성 SQL은 `docs/supabase/storage-policies.example.sql`에 있으나 적용되지 않았다.

운영 전 bucket 이름과 환경 분리, malware/quarantine, 보존·백업·고아 정리, signed URL 철회와 cross-user 삭제 차단을 검증한다.

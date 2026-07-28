# Rollback and recovery

## D1/Supabase Provider 전환

- D1은 Supabase cutover 검증과 승인된 보존기간이 끝날 때까지 삭제하지 않는다.
- 전환 전 D1 read-only 시점과 Supabase import checkpoint를 기록한다.
- Supabase에서 신규 쓰기가 발생한 뒤에는 단순 환경변수 원복으로 양쪽 데이터가 합쳐지지 않는다.
- rollback 결정 전 사용자·수강·답안·오답·모의고사·감사로그의 분기 건수를 산정한다.
- 데이터 손실이 허용되지 않으면 역동기화 또는 점검 창 복구를 승인받는다.
- 잘못된 `DB_PROVIDER`나 미완성 adapter는 D1로 자동 fallback하지 않는다.

## Principles

- Application rollback and database rollback are separate decisions.
- Never delete production data or reverse a migration automatically.
- Prefer backward-compatible additive migrations and a forward fix.
- Record the exact application version, migration set, and deployment target.

## Application rollback

1. Stop further releases and identify the last known healthy commit/version.
2. Confirm it can read the current schema and content revisions.
3. Roll back using the hosting provider's reviewed version history.
4. Do not rebuild an old commit with newly resolved dependencies; use the
   previously validated artifact/version where the provider supports it.
5. Run public, authenticated, administrator, and write-path smoke tests.
6. Monitor errors, latency, data writes, and audit events.

For Sites, keep `.openai/hosting.json` and use the control plane's saved
versions. For a future Vercel deployment, use Vercel's deployment rollback or
promote a known-good deployment only after that target is approved and tested.

## Database incident

1. Disable the affected write path if safe.
2. Preserve evidence, request IDs, audit logs, and backups.
3. Determine whether the application can be forward-fixed without schema
   reversal.
4. Restore only from a verified backup under explicit operator approval.
5. Reconcile writes made after the restore point.
6. Validate user/course isolation, counts, constraints, and migration journal.

SQLite/D1 and future PostgreSQL migration histories must not be rewritten.
Production migration commands must never be embedded in a hosting build.

## Storage incident

- Revoke or shorten signed URLs and disable the affected upload/read route.
- Preserve object metadata and audit events; do not bulk-delete objects.
- Rotate a service role key if exposure is confirmed.
- Reconcile database references before removing orphaned objects.

## Security incident

Follow `SECURITY.md`, rotate affected credentials in the provider control
plane, invalidate sessions where supported, preserve audit evidence, and avoid
placing sensitive incident details in public issues.

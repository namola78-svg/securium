# Storage policy

> Prepared policy only. No remote bucket or policy was created.

## Buckets

| Bucket | Visibility | Accepted content | Maximum size |
| --- | --- | --- | --- |
| `public-thumbnails` | Public read | JPEG, PNG, WebP | 10 MiB |
| `private-audio` | Private | MP3, M4A, WAV, OGG | 100 MiB |
| `private-lectures` | Private | MP4, WebM | 500 MiB |
| `course-assets` | Private | approved images, PDF, TXT | type-specific |
| `admin-imports` | Private | CSV, JSON, XLSX | 25 MiB |

SVG, HTML, scripts, executables, path separators, control characters, MIME
mismatches, empty files, and oversized files are rejected. The server ignores
the client filename for storage placement and generates a UUID-based key.

## Authorization

- Public thumbnails may be read without authentication.
- Private reads require an authenticated owner check or a storage management
  role.
- Writes and deletes require `CONTENT_EDITOR`, `COURSE_MANAGER`, `ADMIN`, or
  `SUPER_ADMIN`.
- Ownership is supplied by a repository callback so a route cannot infer access
  merely from an object key.
- Private URLs expire after 60–3600 seconds; the default is 900 seconds.
- The service role key is sent only from the server.

No direct client upload or public private-bucket URL is prepared. If direct
uploads are later needed, use narrowly scoped signed upload tokens after the
same RBAC, enrollment, ownership, MIME, and size checks.

## Provider behavior

`LocalStorageProvider` is in-memory and suitable only for deterministic tests
and local development. Its `local-storage://` locator is not a public serving
route and data does not survive process restart.

`SupabaseStorageProvider` uses Storage REST endpoints. It rejects non-HTTPS
project URLs, avoids upsert by default, validates returned signed URLs against
the configured Supabase origin, and emits generic errors without response
bodies or credentials.

## Operational requirements before activation

1. Review and manually apply bucket/policy SQL in a non-production project.
2. Configure real secrets in the hosting control plane.
3. Add repository-backed ownership checks to each future upload/read API.
4. Test malware scanning/quarantine for `admin-imports`.
5. Decide retention, backup, object versioning, and orphan cleanup policies.
6. Confirm Supabase plan limits, maximum object sizes, and egress behavior.
7. Run signed URL and policy-denial tests with non-privileged identities.

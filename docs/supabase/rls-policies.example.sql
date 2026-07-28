-- REVIEW TEMPLATE ONLY. NOT APPLIED BY THIS SPRINT.
--
-- The current application uses SIWC IDs and server repositories, not
-- Supabase auth.uid(). These policies are for a future restricted runtime role
-- that sets both values with SET LOCAL inside each transaction:
--
--   set local app.user_id = '<verified application user id>';
--   set local app.actor_role = 'USER';
--
-- Do not use these policies with an owner/service-role connection and do not
-- expose the settings to browser input.

begin;

create schema if not exists app_private;

create or replace function app_private.current_user_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')
$$;

create or replace function app_private.is_content_manager()
returns boolean
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('app.actor_role', true), '')
      in ('CONTENT_EDITOR', 'COURSE_MANAGER', 'ADMIN', 'SUPER_ADMIN'),
    false
  )
$$;

alter table public.audio_progress enable row level security;
create policy audio_progress_owner
on public.audio_progress
for all
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

alter table public.lecture_progress enable row level security;
create policy lecture_progress_owner
on public.lecture_progress
for all
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

alter table public.lecture_notes enable row level security;
create policy lecture_notes_owner
on public.lecture_notes
for all
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

alter table public.bookmarks enable row level security;
create policy bookmarks_owner
on public.bookmarks
for all
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

-- Representative administrator-managed tables. Apply the same reviewed
-- pattern to every mutable content table before granting the restricted role.
alter table public.courses enable row level security;
create policy courses_public_read
on public.courses
for select
using (active = 1 and published = 1 and deleted_at is null);
create policy courses_manager_write
on public.courses
for all
using (app_private.is_content_manager())
with check (app_private.is_content_manager());

alter table public.lessons enable row level security;
create policy lessons_public_read
on public.lessons
for select
using (active = 1 and published = 1 and deleted_at is null);
create policy lessons_manager_write
on public.lessons
for all
using (app_private.is_content_manager())
with check (app_private.is_content_manager());

commit;

-- Private Storage objects deliberately receive no anon/authenticated direct
-- policies in the current design. The server validates ownership and issues a
-- short-lived signed URL with the server-only service role.

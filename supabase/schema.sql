-- Run this once in your Supabase project's SQL editor (Database -> SQL Editor).
-- Safe to re-run: uses "if not exists" / "or replace" where possible.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  start_date date,
  eta date,
  readme text not null default '',
  tracker_sheet_url text,
  tracker_percent_cell text,
  tracker_percent_numerator_cell text,
  tracker_percent_denominator_cell text,
  tracker_percent_cached numeric,
  tracker_percent_synced_at timestamptz,
  last_notes_raw text,
  tracker_label_column text,
  tracker_value_column text,
  tracker_numerator_labels text,
  tracker_denominator_label text,
  tracker_start_date_cell text,
  tracker_eta_cell text,
  readme_backup text,
  tracker_backup jsonb,
  backup_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If you ran an earlier version of this schema, bring an existing table up to date:
alter table public.projects add column if not exists start_date date;
alter table public.projects add column if not exists eta date;
alter table public.projects add column if not exists tracker_sheet_url text;
alter table public.projects add column if not exists tracker_percent_cell text;
alter table public.projects add column if not exists tracker_percent_numerator_cell text;
alter table public.projects add column if not exists tracker_percent_denominator_cell text;
alter table public.projects add column if not exists tracker_percent_cached numeric;
alter table public.projects add column if not exists tracker_percent_synced_at timestamptz;
alter table public.projects add column if not exists last_notes_raw text;
alter table public.projects add column if not exists tracker_label_column text;
alter table public.projects add column if not exists tracker_value_column text;
alter table public.projects add column if not exists tracker_numerator_labels text;
alter table public.projects add column if not exists tracker_denominator_label text;
alter table public.projects add column if not exists tracker_start_date_cell text;
alter table public.projects add column if not exists tracker_eta_cell text;
alter table public.projects add column if not exists readme_backup text;
alter table public.projects add column if not exists tracker_backup jsonb;
alter table public.projects add column if not exists backup_created_at timestamptz;
alter table public.projects drop column if exists status;

create table if not exists public.tracker_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  task text not null,
  owner text not null default '',
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done')),
  deadline date,
  created_at timestamptz not null default now()
);

-- Was "email_drafts" — generalized into "documents", which can be either a
-- plain email draft (subject/recipients/body) or a pasted Google Docs/Slides/
-- Sheets link (link_url + auto-fetched link_title/link_kind/link_icon).
alter table if exists public.email_drafts rename to documents;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  subject text not null default '',
  recipients text not null default '',
  body text not null default '',
  link_url text,
  link_title text,
  link_kind text,
  link_icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents add column if not exists link_url text;
alter table public.documents add column if not exists link_title text;
alter table public.documents add column if not exists link_kind text;
alter table public.documents add column if not exists link_icon text;

create table if not exists public.google_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expiry timestamptz not null,
  scope text not null,
  connected_email text,
  connected_at timestamptz not null default now()
);

-- Read-only dashboard sharing: an owner invites someone by email to view
-- their *entire* dashboard (all their projects). viewer_user_id starts out
-- null (the invitee may not have an account yet) and gets filled in the
-- first time that person logs in — see the "claim_own_invite" policy below,
-- which lets a user attach their own verified account email to a pending
-- invite without needing a service-role key.
create table if not exists public.dashboard_viewers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  owner_email text not null,
  invited_email text not null,
  viewer_user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists dashboard_viewers_owner_email_idx
  on public.dashboard_viewers (owner_user_id, lower(invited_email));
create index if not exists dashboard_viewers_viewer_user_id_idx
  on public.dashboard_viewers (viewer_user_id);

create index if not exists tracker_items_project_id_idx on public.tracker_items (project_id);
create index if not exists documents_project_id_idx on public.documents (project_id);

alter table public.projects enable row level security;
alter table public.tracker_items enable row level security;
alter table public.documents enable row level security;
alter table public.google_tokens enable row level security;
alter table public.dashboard_viewers enable row level security;

drop policy if exists "projects_owner_all" on public.projects;
create policy "projects_owner_all" on public.projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A second, read-only permissive policy for the same command (select) is
-- OR'd with the owner policy above, so this only ever *adds* read access —
-- it can't weaken the owner's own access or grant any write.
drop policy if exists "projects_viewer_select" on public.projects;
create policy "projects_viewer_select" on public.projects
  for select
  using (
    exists (
      select 1 from public.dashboard_viewers v
      where v.owner_user_id = projects.user_id and v.viewer_user_id = auth.uid()
    )
  );

drop policy if exists "tracker_items_owner_all" on public.tracker_items;
create policy "tracker_items_owner_all" on public.tracker_items
  for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = tracker_items.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = tracker_items.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "tracker_items_viewer_select" on public.tracker_items;
create policy "tracker_items_viewer_select" on public.tracker_items
  for select
  using (
    exists (
      select 1 from public.projects p
      join public.dashboard_viewers v on v.owner_user_id = p.user_id
      where p.id = tracker_items.project_id and v.viewer_user_id = auth.uid()
    )
  );

drop policy if exists "email_drafts_owner_all" on public.documents;
drop policy if exists "documents_owner_all" on public.documents;
create policy "documents_owner_all" on public.documents
  for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = documents.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = documents.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "documents_viewer_select" on public.documents;
create policy "documents_viewer_select" on public.documents
  for select
  using (
    exists (
      select 1 from public.projects p
      join public.dashboard_viewers v on v.owner_user_id = p.user_id
      where p.id = documents.project_id and v.viewer_user_id = auth.uid()
    )
  );

drop policy if exists "google_tokens_owner_all" on public.google_tokens;
create policy "google_tokens_owner_all" on public.google_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Owner manages (invite/revoke) the people who can view their dashboard.
drop policy if exists "dashboard_viewers_owner_manage" on public.dashboard_viewers;
create policy "dashboard_viewers_owner_manage" on public.dashboard_viewers
  for all
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

-- A viewer can see the invite rows that name them, once claimed.
drop policy if exists "dashboard_viewers_self_select" on public.dashboard_viewers;
create policy "dashboard_viewers_self_select" on public.dashboard_viewers
  for select
  using (auth.uid() = viewer_user_id);

-- Narrow helper for the policy below: the "authenticated" role has no grant
-- on auth.users by default (and shouldn't — it holds password hashes etc.),
-- so this security-definer function is the only thing that can read it, and
-- it only ever returns the caller's own email, nothing else.
create or replace function public.my_email()
returns text
language sql
security definer
stable
set search_path = auth, public
as $$
  select email from auth.users where id = auth.uid();
$$;

grant execute on function public.my_email() to authenticated;

-- Lets a freshly-signed-in user claim a pending invite addressed to their
-- own verified email — the "with check" pins viewer_user_id to their own
-- auth.uid(), so this can never be used to claim someone else's invite.
drop policy if exists "dashboard_viewers_claim_own_invite" on public.dashboard_viewers;
create policy "dashboard_viewers_claim_own_invite" on public.dashboard_viewers
  for update
  using (viewer_user_id is null and lower(invited_email) = lower(public.my_email()))
  with check (viewer_user_id = auth.uid() and lower(invited_email) = lower(public.my_email()));

-- Postgres RLS for UPDATE also requires the row to be visible under an
-- applicable SELECT policy (to identify the row in the first place),
-- separate from the UPDATE policy's own USING clause — without this, the
-- claim above silently matches zero rows via PostgREST even though the
-- expression itself is correct. Harmless to expose: it only reveals a
-- not-yet-claimed invite that's already addressed to this exact person.
drop policy if exists "dashboard_viewers_claim_own_invite_select" on public.dashboard_viewers;
create policy "dashboard_viewers_claim_own_invite_select" on public.dashboard_viewers
  for select
  using (viewer_user_id is null and lower(invited_email) = lower(public.my_email()));

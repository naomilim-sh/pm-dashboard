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

create table if not exists public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  subject text not null default '',
  recipients text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.google_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expiry timestamptz not null,
  scope text not null,
  connected_email text,
  connected_at timestamptz not null default now()
);

create index if not exists tracker_items_project_id_idx on public.tracker_items (project_id);
create index if not exists email_drafts_project_id_idx on public.email_drafts (project_id);

alter table public.projects enable row level security;
alter table public.tracker_items enable row level security;
alter table public.email_drafts enable row level security;
alter table public.google_tokens enable row level security;

drop policy if exists "projects_owner_all" on public.projects;
create policy "projects_owner_all" on public.projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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

drop policy if exists "email_drafts_owner_all" on public.email_drafts;
create policy "email_drafts_owner_all" on public.email_drafts
  for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = email_drafts.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = email_drafts.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "google_tokens_owner_all" on public.google_tokens;
create policy "google_tokens_owner_all" on public.google_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

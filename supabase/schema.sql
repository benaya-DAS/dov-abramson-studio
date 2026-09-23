-- ============================================================================
-- Dov Abramson Studio — Studio Management App
-- Full database schema, security policies, and business-logic functions.
--
-- Run this once against a fresh Supabase project (SQL editor, or via the
-- Supabase CLI: `supabase db push`). Idempotent-ish via IF NOT EXISTS /
-- CREATE OR REPLACE where practical, but intended to run on an empty schema.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. ALLOWED EMAIL DOMAINS  (controls who may ever sign up)
-- ============================================================================

create table if not exists public.allowed_domains (
  domain text primary key
);

-- Domains are always stored lowercase and trimmed, so a manually
-- copy-pasted row (stray whitespace, mixed case) can never silently break
-- matching in is_allowed_email() below.
create or replace function public.normalize_allowed_domain()
returns trigger
language plpgsql
as $$
begin
  new.domain = lower(trim(new.domain));
  return new;
end;
$$;

drop trigger if exists normalize_allowed_domain_trigger on public.allowed_domains;
create trigger normalize_allowed_domain_trigger
  before insert or update on public.allowed_domains
  for each row execute function public.normalize_allowed_domain();

-- Seed with the studio's domain. Add more rows here if the studio ever
-- needs to allow a second domain (e.g. a sister company).
insert into public.allowed_domains (domain)
values ('studiodov.com')
on conflict (domain) do nothing;

-- Strictly extracts the domain portion of the email (everything after the
-- last '@', lowercased and trimmed) and compares it for exact equality
-- against the (also lowercased/trimmed) allowed_domains rows. Deliberately
-- NOT a LIKE/pattern match — that form is fragile (a stray space in a
-- stored domain silently breaks it) and, if a domain value ever came from
-- untrusted input, would be vulnerable to LIKE wildcard injection ('%', '_').
create or replace function public.is_allowed_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_domains d
    where lower(trim(d.domain)) = lower(trim(split_part(coalesce(p_email, ''), '@', 2)))
      and split_part(coalesce(p_email, ''), '@', 2) <> ''
  );
$$;

-- ============================================================================
-- 2. PROFILES  (mirrors auth.users, auto-populated from Google OAuth)
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Studio personnel, one row per authenticated Google account.';

-- ----------------------------------------------------------------------------
-- 2a. Hard domain enforcement at the database level.
--
-- This BEFORE INSERT trigger on auth.users is the authoritative guard: even
-- if the OAuth `hd` hint or the Supabase Auth Hook (configured in the
-- dashboard, see README) is bypassed or misconfigured, no row for a
-- non-studio email can ever be created. Sign-up is aborted with a clear
-- error and no session is issued.
-- ----------------------------------------------------------------------------

create or replace function public.enforce_studio_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or not public.is_allowed_email(new.email) then
    raise exception using
      errcode = '42501',
      message = 'Sign-up blocked: email domain is not authorized for this studio workspace.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_studio_domain_trigger on auth.users;
create trigger enforce_studio_domain_trigger
  before insert on auth.users
  for each row execute function public.enforce_studio_domain();

-- ----------------------------------------------------------------------------
-- 2b. Auto-create/refresh a profile row whenever a studio user signs in,
-- keeping name/avatar in sync with their Google account.
-- ----------------------------------------------------------------------------

create or replace function public.handle_auth_user_upsert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- avatar_url is deliberately NOT in the on-conflict SET list below: this
  -- function fires on every sign-in (on_auth_user_updated, whenever
  -- Google refreshes raw_user_meta_data), not just the first one. Setting
  -- it there would silently overwrite a photo the user uploaded
  -- themselves (UserMenu's avatar upload) with Google's picture on their
  -- very next login. It's only ever set here on the initial INSERT, i.e.
  -- the first time this profile row is created.
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_upsert();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of raw_user_meta_data, email on auth.users
  for each row execute function public.handle_auth_user_upsert();

-- Small helper used throughout RLS policies below.
--
-- Access is gated purely on this — there is no separate workspace_members
-- table in this schema; every studio member can see every workspace/board
-- (see the RLS section's comment for why). Normally that just means "has a
-- public.profiles row," but a profiles row is only created reactively by
-- the handle_auth_user_upsert() trigger on auth.users, so a row that
-- predates that trigger (or hit some other insert failure) would otherwise
-- leave an authenticated, domain-valid user locked out of everything with
-- RLS silently returning zero rows rather than an error — which looks
-- identical to "there's no data" from the app. The is_allowed_email() OR
-- branch below closes that gap: it re-derives membership straight from the
-- JWT's own email/domain, independent of whether the profiles row exists.
create or replace function public.is_studio_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      exists (select 1 from public.profiles where id = auth.uid())
      or public.is_allowed_email(auth.jwt() ->> 'email')
    );
$$;

-- One-time (and self-healing on every re-run) backfill: create a profiles
-- row for any auth.users row that doesn't have one yet, covering exactly
-- the drift scenario above. Safe to run repeatedly — on conflict is a
-- no-op for users who already have a profile.
insert into public.profiles (id, email, full_name, avatar_url)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
where u.email is not null
on conflict (id) do nothing;

-- ============================================================================
-- 3. WORKSPACES / DEPARTMENTS
-- ============================================================================

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 4. BOARDS
-- ============================================================================

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  month smallint check (month between 1 and 12),
  year smallint,
  is_archived boolean not null default false,
  archived_at timestamptz,
  source_board_id uuid references public.boards (id) on delete set null,
  position integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists boards_workspace_id_idx on public.boards (workspace_id);
create index if not exists boards_is_archived_idx on public.boards (is_archived);

-- ============================================================================
-- 5. GROUPS  (sections within a board, e.g. "סדר בוקר", "כללי")
-- ============================================================================

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null,
  color text not null default '#579bfc',
  position integer not null default 0,
  is_collapsed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists groups_board_id_idx on public.groups (board_id);

-- A single group within a board can be archived independently of the whole
-- board (see boards.is_archived) - it drops to a separate "ארכיון" section
-- at the bottom of the board, its own edits and its items' edits are
-- blocked (see items_write_unarchived below), but it (and its items) stay
-- fully viewable.
alter table public.groups add column if not exists is_archived boolean not null default false;
create index if not exists groups_is_archived_idx on public.groups (is_archived);

-- ============================================================================
-- 6. ITEMS  (tasks / rows)
-- ============================================================================

create type public.item_status as enum ('not_started', 'working', 'stuck', 'done');

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null default '',
  deliverable text,
  status public.item_status not null default 'not_started',
  -- Optional free-text override shown instead of the fixed status label
  -- (e.g. "ממתין לאישור לקוח") without giving up the underlying enum that
  -- grouping/sorting/filtering and the status color all still key off.
  status_label text,
  serial_id text,
  start_date date,
  due_date date,
  hours numeric(8, 2) not null default 0,
  position integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotent: adds status_label to a project whose items table predates it.
alter table public.items add column if not exists status_label text;

-- Multiple assignees per item, replacing the older single person_id
-- column. A plain uuid[] rather than a join table - much less machinery
-- (no separate table/RLS/realtime wiring) for what's still a small
-- internal app, at the cost of no FK enforcement on each array element;
-- the cleanup trigger below (profiles_remove_from_item_assignees)
-- compensates for that by scrubbing a deleted profile's id out of every
-- item that had it assigned.
alter table public.items add column if not exists person_ids uuid[] not null default '{}';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'items' and column_name = 'person_id'
  ) then
    update public.items
      set person_ids = array[person_id]
      where person_id is not null and person_ids = '{}';
    alter table public.items drop column person_id;
  end if;
end $$;

create or replace function public.remove_profile_from_item_assignees()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.items
    set person_ids = array_remove(person_ids, old.id)
    where old.id = any(person_ids);
  return old;
end;
$$;

drop trigger if exists profiles_remove_from_item_assignees on public.profiles;
create trigger profiles_remove_from_item_assignees
  after delete on public.profiles
  for each row execute function public.remove_profile_from_item_assignees();

create index if not exists items_board_id_idx on public.items (board_id);
create index if not exists items_group_id_idx on public.items (group_id);
create index if not exists items_person_ids_idx on public.items using gin (person_ids);
create index if not exists items_serial_id_idx on public.items (serial_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 7. PROJECT CATALOG  (parsed from customer Excel files)
-- ============================================================================

create table if not exists public.project_catalog (
  id uuid primary key default gen_random_uuid(),
  serial_id text not null unique,
  title text not null,
  raw_text text,
  imported_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_catalog_serial_id_idx on public.project_catalog (serial_id);

drop trigger if exists project_catalog_set_updated_at on public.project_catalog;
create trigger project_catalog_set_updated_at
  before update on public.project_catalog
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 8. TIME LOGS  (play / stop timer sessions per item)
-- ============================================================================

create table if not exists public.time_logs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  start_time timestamptz not null default now(),
  end_time timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

-- Migrate a table created under this file's older column names
-- (started_at/ended_at) without losing data. No-ops on a fresh install
-- (the create table above already used the current names) and on a
-- project that's already been migrated once.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'time_logs' and column_name = 'started_at'
  ) then
    alter table public.time_logs rename column started_at to start_time;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'time_logs' and column_name = 'ended_at'
  ) then
    alter table public.time_logs rename column ended_at to end_time;
  end if;
end $$;

alter table public.time_logs add column if not exists created_at timestamptz not null default now();

create index if not exists time_logs_item_id_idx on public.time_logs (item_id);
create index if not exists time_logs_user_id_idx on public.time_logs (user_id);
drop index if exists time_logs_one_active_per_user;
create unique index if not exists time_logs_one_active_per_user
  on public.time_logs (user_id)
  where end_time is null;

-- duration_seconds is always server-derived from start_time/end_time, on
-- both insert and update — this is what makes manually adding or editing a
-- session (typing a new start/end time) "just work" without a separate
-- code path: whatever duration the client sends is ignored and
-- recalculated here, so it can never drift from the times actually stored.
-- A null end_time (an in-progress play/stop timer) keeps duration_seconds
-- null, same as before.
create or replace function public.compute_time_log_duration()
returns trigger
language plpgsql
as $$
begin
  if new.end_time is not null then
    new.duration_seconds = greatest(0, extract(epoch from (new.end_time - new.start_time))::int);
  else
    new.duration_seconds = null;
  end if;
  return new;
end;
$$;

drop trigger if exists time_logs_compute_duration on public.time_logs;
create trigger time_logs_compute_duration
  before insert or update on public.time_logs
  for each row execute function public.compute_time_log_duration();

-- security definer (not invoker): any studio member may stop a RUNNING
-- timer on an item, not just whoever started it - e.g. a teammate who
-- forgot to stop theirs before leaving for the day. This is the one
-- narrowly-scoped exception to time_logs' normal owner-only RLS
-- (time_logs_write_own_unarchived below): starting your own session, and
-- editing/deleting a manual entry, still go through ordinary RLS-gated
-- queries and remain owner-only. The function itself stays tightly scoped
-- (a single row, matched by id, only while still running, only on an
-- unarchived board) so the elevated privilege can't be used for anything
-- beyond that one UPDATE.
create or replace function public.stop_time_log(p_log_id uuid)
returns public.time_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.time_logs;
begin
  if not public.is_studio_member() then
    return null;
  end if;

  update public.time_logs tl
    set end_time = now()
    where tl.id = p_log_id
      and tl.end_time is null
      and exists (
        select 1 from public.items i
        join public.boards b on b.id = i.board_id
        where i.id = tl.item_id and b.is_archived = false
      )
    returning * into v_row;

  return v_row;
end;
$$;

-- ============================================================================
-- 9. HELPER VIEWS
-- ============================================================================

-- Sum of *completed* time-tracking sessions per item. Any currently running
-- session (end_time is null) is intentionally excluded here — the client
-- adds its live-ticking elapsed time on top of this base total so the
-- on-screen timer advances every second without refetching.
create or replace view public.item_tracked_seconds as
select
  item_id,
  coalesce(sum(duration_seconds), 0) as tracked_seconds
from public.time_logs
where end_time is not null
group by item_id;

-- ============================================================================
-- 10. MONTH ROLLOVER  ("חודש חדש")
--
-- Archives the given board as read-only, then creates a brand-new board in
-- the same workspace for the following month, duplicating groups (and their
-- colors/order) but with zero items and zero time logs.
-- ============================================================================

create or replace function public.rollover_board_month(p_board_id uuid)
returns public.boards
language plpgsql
security invoker
as $$
declare
  v_source public.boards;
  v_new public.boards;
  v_new_month smallint;
  v_new_year smallint;
  v_base_name text;
  v_new_name text;
  v_group record;
  v_new_group_id uuid;
  v_hebrew_months text[] := array[
    'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
    'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'
  ];
begin
  select * into v_source from public.boards where id = p_board_id;
  if not found then
    raise exception 'Board % not found', p_board_id;
  end if;
  if v_source.is_archived then
    raise exception 'Board is already archived';
  end if;

  -- Archive current board (becomes read-only via RLS policies below).
  update public.boards
    set is_archived = true,
        archived_at = now()
    where id = p_board_id
    returning * into v_source;

  -- Compute next month/year, defaulting to the current calendar month if unset.
  if v_source.month is null or v_source.year is null then
    v_new_month := extract(month from now())::smallint;
    v_new_year := extract(year from now())::smallint;
  elsif v_source.month = 12 then
    v_new_month := 1;
    v_new_year := v_source.year + 1;
  else
    v_new_month := v_source.month + 1;
    v_new_year := v_source.year;
  end if;

  -- Strip a trailing " - <Hebrew month> <year>" style suffix, if present, to
  -- recover the base project name before appending the new month/year.
  v_base_name := regexp_replace(v_source.name, '\s*-\s*\S+\s+\d{4}\s*$', '');
  v_new_name := v_base_name || ' - ' || v_hebrew_months[v_new_month] || ' ' || v_new_year;

  insert into public.boards (workspace_id, name, month, year, source_board_id, position, created_by)
  values (v_source.workspace_id, v_new_name, v_new_month, v_new_year, v_source.id, v_source.position, auth.uid())
  returning * into v_new;

  for v_group in
    select * from public.groups where board_id = v_source.id order by position
  loop
    insert into public.groups (board_id, name, color, position, is_collapsed)
    values (v_new.id, v_group.name, v_group.color, v_group.position, false)
    returning id into v_new_group_id;
  end loop;

  return v_new;
end;
$$;

-- ============================================================================
-- 11. ACTIVITY LOG & UNDO
--
-- Every insert/update/delete on items or groups is captured automatically
-- via AFTER triggers on the tables themselves, not from application code —
-- so the log is complete regardless of which UI action, importer, or
-- future code path performed the write. previous_state/new_state hold the
-- entire row as JSONB; undoing a log entry simply replays the opposite of
-- whatever the trigger recorded (re-delete an insert, re-insert a delete
-- from its captured previous_state, or write an update's old column
-- values back).
-- ============================================================================

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  entity_type text not null check (entity_type in ('item', 'group')),
  entity_id uuid not null,
  action_type text not null check (action_type in ('insert', 'update', 'delete')),
  previous_state jsonb,
  new_state jsonb,
  changed_by uuid references public.profiles (id) on delete set null,
  -- Set once a log entry has been reverted via undo_activity_log(), so the
  -- UI can hide/disable its Undo button rather than allowing a double-undo
  -- (the undo itself is a normal write, so it generates its own new log
  -- entry - this flag is only about not replaying THIS entry twice).
  undone_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_board_id_idx on public.activity_logs (board_id, created_at desc);

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board_id uuid;
  v_entity_id uuid;
  v_entity_type text;
  v_prev jsonb;
  v_new jsonb;
begin
  v_entity_type := case tg_table_name
    when 'items' then 'item'
    when 'groups' then 'group'
    else tg_table_name
  end;

  -- Branched in plain plpgsql (not a single SQL CASE expression) so that
  -- OLD/NEW are only ever referenced on the operation where Postgres
  -- actually assigns them - OLD doesn't exist on INSERT, NEW doesn't exist
  -- on DELETE, and referencing the unassigned one raises at runtime even
  -- inside a branch that "shouldn't" run, because plpgsql resolves the
  -- record's fields when binding the query, not when the branch executes.
  if tg_op = 'DELETE' then
    v_board_id := old.board_id;
    v_entity_id := old.id;
    v_prev := to_jsonb(old);
    v_new := null;
  elsif tg_op = 'INSERT' then
    v_board_id := new.board_id;
    v_entity_id := new.id;
    v_prev := null;
    v_new := to_jsonb(new);
  else
    v_board_id := new.board_id;
    v_entity_id := new.id;
    v_prev := to_jsonb(old);
    v_new := to_jsonb(new);
  end if;

  -- Skip logging when the parent board no longer exists. This matters for
  -- deleting a board itself: that cascades (on delete cascade) into its
  -- groups and items, which fires THIS trigger for each cascaded row - but
  -- by then the boards row is already gone from this transaction's view
  -- (the cascade's nested delete runs after a command-counter increment
  -- that makes it so), so an insert here referencing that board_id would
  -- violate activity_logs' own FK and abort the whole board deletion.
  -- There's no history worth keeping for a board that no longer exists
  -- anyway.
  if not exists (select 1 from public.boards b where b.id = v_board_id) then
    if tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

  insert into public.activity_logs (board_id, entity_type, entity_id, action_type, previous_state, new_state, changed_by)
  values (v_board_id, v_entity_type, v_entity_id, lower(tg_op), v_prev, v_new, auth.uid());

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

drop trigger if exists items_log_activity on public.items;
create trigger items_log_activity
  after insert or update or delete on public.items
  for each row execute function public.log_activity();

drop trigger if exists groups_log_activity on public.groups;
create trigger groups_log_activity
  after insert or update or delete on public.groups
  for each row execute function public.log_activity();

create or replace function public.undo_activity_log(p_log_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.activity_logs;
begin
  if not public.is_studio_member() then
    raise exception 'Not authorized';
  end if;

  select * into v_log from public.activity_logs where id = p_log_id;
  if not found then
    raise exception 'Activity log entry not found';
  end if;
  if v_log.undone_at is not null then
    raise exception 'This action was already undone';
  end if;
  -- This function is security definer, so it bypasses the
  -- items_write_unarchived/groups_write_unarchived RLS policies that
  -- normally make an archived board read-only - re-check the same
  -- condition explicitly here so undo can't be used as a backdoor around
  -- that protection.
  if exists (select 1 from public.boards b where b.id = v_log.board_id and b.is_archived = true) then
    raise exception 'Cannot undo changes on an archived board';
  end if;

  if v_log.entity_type = 'item' then
    if v_log.action_type = 'insert' then
      delete from public.items where id = v_log.entity_id;
    elsif v_log.action_type = 'delete' then
      insert into public.items select * from jsonb_populate_record(null::public.items, v_log.previous_state);
    elsif v_log.action_type = 'update' then
      update public.items set
        board_id = (v_log.previous_state ->> 'board_id')::uuid,
        group_id = (v_log.previous_state ->> 'group_id')::uuid,
        name = v_log.previous_state ->> 'name',
        person_ids = coalesce(
          (select array_agg(elem::uuid) from jsonb_array_elements_text(v_log.previous_state -> 'person_ids') as elem),
          '{}'::uuid[]
        ),
        deliverable = v_log.previous_state ->> 'deliverable',
        status = (v_log.previous_state ->> 'status')::public.item_status,
        status_label = v_log.previous_state ->> 'status_label',
        serial_id = v_log.previous_state ->> 'serial_id',
        start_date = (v_log.previous_state ->> 'start_date')::date,
        due_date = (v_log.previous_state ->> 'due_date')::date,
        hours = (v_log.previous_state ->> 'hours')::numeric,
        position = (v_log.previous_state ->> 'position')::integer
      where id = v_log.entity_id;
    end if;
  elsif v_log.entity_type = 'group' then
    if v_log.action_type = 'insert' then
      delete from public.groups where id = v_log.entity_id;
    elsif v_log.action_type = 'delete' then
      insert into public.groups select * from jsonb_populate_record(null::public.groups, v_log.previous_state);
    elsif v_log.action_type = 'update' then
      update public.groups set
        board_id = (v_log.previous_state ->> 'board_id')::uuid,
        name = v_log.previous_state ->> 'name',
        color = v_log.previous_state ->> 'color',
        position = (v_log.previous_state ->> 'position')::integer,
        is_collapsed = (v_log.previous_state ->> 'is_collapsed')::boolean
      where id = v_log.entity_id;
    end if;
  end if;

  update public.activity_logs set undone_at = now() where id = p_log_id;
end;
$$;

-- ============================================================================
-- 12. ROW LEVEL SECURITY
--
-- Blanket rule: any authenticated row in public.profiles (i.e. any signed-in
-- studio member — enforced at signup by the domain trigger above) may read
-- and collaborate on all workspace data. Archived boards become read-only:
-- writes to a board, its groups, or its items are rejected once
-- boards.is_archived = true.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.allowed_domains enable row level security;
alter table public.workspaces enable row level security;
alter table public.boards enable row level security;
alter table public.groups enable row level security;
alter table public.items enable row level security;
alter table public.project_catalog enable row level security;
alter table public.time_logs enable row level security;
alter table public.activity_logs enable row level security;

-- ---- profiles ---------------------------------------------------------
drop policy if exists "profiles_select_studio" on public.profiles;
create policy "profiles_select_studio" on public.profiles
  for select using (public.is_studio_member());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- profiles are inserted only by the trigger (security definer), never
-- directly by clients — no insert/delete policy is granted to users.

-- ---- allowed_domains (read-only reference data for admins/UI) ---------
drop policy if exists "allowed_domains_select_studio" on public.allowed_domains;
create policy "allowed_domains_select_studio" on public.allowed_domains
  for select using (public.is_studio_member());

-- ---- workspaces ---------------------------------------------------------
drop policy if exists "workspaces_select_studio" on public.workspaces;
create policy "workspaces_select_studio" on public.workspaces
  for select using (public.is_studio_member());

drop policy if exists "workspaces_write_studio" on public.workspaces;
create policy "workspaces_write_studio" on public.workspaces
  for all using (public.is_studio_member()) with check (public.is_studio_member());

-- ---- boards ---------------------------------------------------------
drop policy if exists "boards_select_studio" on public.boards;
create policy "boards_select_studio" on public.boards
  for select using (public.is_studio_member());

drop policy if exists "boards_insert_studio" on public.boards;
create policy "boards_insert_studio" on public.boards
  for insert with check (public.is_studio_member());

drop policy if exists "boards_update_unarchived" on public.boards;
create policy "boards_update_unarchived" on public.boards
  for update using (public.is_studio_member())
  with check (public.is_studio_member());

drop policy if exists "boards_delete_unarchived" on public.boards;
create policy "boards_delete_unarchived" on public.boards
  for delete using (public.is_studio_member() and is_archived = false);

-- ---- groups (blocked once parent board is archived) -------------------
drop policy if exists "groups_select_studio" on public.groups;
create policy "groups_select_studio" on public.groups
  for select using (public.is_studio_member());

drop policy if exists "groups_write_unarchived" on public.groups;
create policy "groups_write_unarchived" on public.groups
  for all using (
    public.is_studio_member()
    and exists (select 1 from public.boards b where b.id = board_id and b.is_archived = false)
  )
  with check (
    public.is_studio_member()
    and exists (select 1 from public.boards b where b.id = board_id and b.is_archived = false)
  );

-- ---- items (blocked once the parent board OR parent group is archived) -
drop policy if exists "items_select_studio" on public.items;
create policy "items_select_studio" on public.items
  for select using (public.is_studio_member());

drop policy if exists "items_write_unarchived" on public.items;
create policy "items_write_unarchived" on public.items
  for all using (
    public.is_studio_member()
    and exists (
      select 1 from public.boards b
      join public.groups g on g.id = items.group_id
      where b.id = items.board_id and b.is_archived = false and g.is_archived = false
    )
  )
  with check (
    public.is_studio_member()
    and exists (
      select 1 from public.boards b
      join public.groups g on g.id = items.group_id
      where b.id = items.board_id and b.is_archived = false and g.is_archived = false
    )
  );

-- ---- project_catalog ---------------------------------------------------
drop policy if exists "catalog_select_studio" on public.project_catalog;
create policy "catalog_select_studio" on public.project_catalog
  for select using (public.is_studio_member());

drop policy if exists "catalog_write_studio" on public.project_catalog;
create policy "catalog_write_studio" on public.project_catalog
  for all using (public.is_studio_member()) with check (public.is_studio_member());

-- ---- time_logs (blocked once parent item's board is archived) ---------
drop policy if exists "time_logs_select_studio" on public.time_logs;
create policy "time_logs_select_studio" on public.time_logs
  for select using (public.is_studio_member());

drop policy if exists "time_logs_write_own_unarchived" on public.time_logs;
create policy "time_logs_write_own_unarchived" on public.time_logs
  for all using (
    public.is_studio_member()
    and user_id = auth.uid()
    and exists (
      select 1 from public.items i
      join public.boards b on b.id = i.board_id
      where i.id = item_id and b.is_archived = false
    )
  )
  with check (
    public.is_studio_member()
    and user_id = auth.uid()
    and exists (
      select 1 from public.items i
      join public.boards b on b.id = i.board_id
      where i.id = item_id and b.is_archived = false
    )
  );

-- ---- activity_logs (read-only to clients; only the triggers/RPC above,
-- both security definer, ever write a row) ------------------------------
drop policy if exists "activity_logs_select_studio" on public.activity_logs;
create policy "activity_logs_select_studio" on public.activity_logs
  for select using (public.is_studio_member());

-- ============================================================================
-- 13. GRANTS
-- Supabase's `authenticated` role needs explicit table privileges; RLS
-- policies above still gate every row.
-- ============================================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.allowed_domains,
  public.workspaces,
  public.boards,
  public.groups,
  public.items,
  public.project_catalog,
  public.time_logs
to authenticated;
-- activity_logs is select-only for clients: no insert/update/delete grant,
-- since every row is written by the security definer trigger/RPC above.
grant select on public.activity_logs to authenticated;
grant select on public.item_tracked_seconds to authenticated;
grant execute on function public.rollover_board_month(uuid) to authenticated;
grant execute on function public.stop_time_log(uuid) to authenticated;
grant execute on function public.undo_activity_log(uuid) to authenticated;
grant execute on function public.is_allowed_email(text) to authenticated, anon;

-- ============================================================================
-- 14. REALTIME
--
-- Supabase's Realtime service only streams postgres_changes for tables
-- explicitly added to the `supabase_realtime` publication — a table isn't
-- included just because RLS/grants allow reading it. Every Supabase
-- project provisions this publication empty by default, so without this
-- block none of the app's `.channel(...).on("postgres_changes", ...)`
-- subscriptions (BoardWorkspace's live sync of items/groups, and the
-- time-tracking totals/active-session state that time_logs changes drive)
-- ever receive anything: the client-side code is correct and the writes
-- do land in the database, but nothing ever tells connected clients about
-- them, so a board only shows a change after a manual reload. Guarded
-- with a pg_publication_tables existence check since, unlike most of this
-- file, `alter publication ... add table` has no native IF NOT EXISTS and
-- errors on a table that's already a member.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'groups'
  ) then
    alter publication supabase_realtime add table public.groups;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'time_logs'
  ) then
    alter publication supabase_realtime add table public.time_logs;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_logs'
  ) then
    alter publication supabase_realtime add table public.activity_logs;
  end if;
end $$;

-- ============================================================================
-- 15. AVATAR STORAGE
--
-- A public bucket for user-uploaded profile pictures. Public (not just
-- authenticated-read) because the avatar is displayed via a plain URL in
-- <Image>/<img> tags - a signed-URL-only bucket would need every render to
-- mint a fresh signed URL first. Each user may only write inside a folder
-- named after their own auth.uid(), enforced by storage.foldername(name)
-- (path segments before the filename) rather than trusting the client.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_own_write" on storage.objects;
create policy "avatars_own_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_own_update" on storage.objects;
create policy "avatars_own_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_own_delete" on storage.objects;
create policy "avatars_own_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- Done. See supabase/seed.sql for optional sample workspaces/boards, and
-- README.md for wiring up the Google OAuth "Before User Created" Auth Hook.
-- ============================================================================

-- Operate — 003: close the org self-join hole, add invites, rate-limit usage,
-- and allow crew to write operational tables.
-- Apply after 001 and 002. Safe to run once (idempotent-ish; uses drop/create).

-- ============================================================
-- #5 — Close the self-join tenancy hole.
-- Old policy allowed `user_id = auth.uid()` for ANY org_id, letting any
-- authenticated user join any org (even as owner). Replace with: only
-- owners/managers add members directly; org creation & invite-accept go
-- through SECURITY DEFINER RPCs below.
-- ============================================================
drop policy if exists org_members_insert on public.org_members;
create policy org_members_insert on public.org_members for insert
  with check (public.user_can_write_org(org_id));

-- Atomically create an org and make the caller its owner (replaces the
-- client-side orgs.insert + org_members.insert dance).
create or replace function public.create_org(p_name text default 'My Tour')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.orgs(name) values (coalesce(nullif(p_name,''),'My Tour')) returning id into v_org;
  insert into public.org_members(org_id, user_id, role) values (v_org, auth.uid(), 'owner');
  insert into public.org_settings(org_id, settings) values (v_org, '{}'::jsonb)
    on conflict (org_id) do nothing;
  return v_org;
end; $$;
grant execute on function public.create_org(text) to authenticated;

-- ============================================================
-- #9 — Invites: the only way to add a crew/manager to an org.
-- ============================================================
create table if not exists public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','manager','crew')),
  token text not null unique default encode(gen_random_bytes(18),'hex'),
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.org_invites enable row level security;
drop policy if exists org_invites_select on public.org_invites;
create policy org_invites_select on public.org_invites for select
  using (org_id in (select public.user_org_ids()));
drop policy if exists org_invites_write on public.org_invites;
create policy org_invites_write on public.org_invites for all
  using (public.user_can_write_org(org_id)) with check (public.user_can_write_org(org_id));

-- Accept an invite whose email matches the signed-in user; grants membership.
create or replace function public.accept_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv public.org_invites; v_email text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_inv from public.org_invites where token = p_token and accepted_at is null;
  if not found then raise exception 'invalid_invite'; end if;
  select email into v_email from auth.users where id = auth.uid();
  if lower(v_inv.email) <> lower(coalesce(v_email,'')) then raise exception 'email_mismatch'; end if;
  insert into public.org_members(org_id, user_id, role)
    values (v_inv.org_id, auth.uid(), v_inv.role)
    on conflict (org_id, user_id) do update set role = excluded.role;
  update public.org_invites set accepted_at = now() where id = v_inv.id;
  return v_inv.org_id;
end; $$;
grant execute on function public.accept_invite(text) to authenticated;

-- ============================================================
-- #6 — Rate limiting for edge functions (shared OpenAI/AviationStack keys).
-- ============================================================
create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_kind_idx
  on public.usage_events(user_id, kind, created_at);
alter table public.usage_events enable row level security;  -- no direct client policies; RPC + service role only

-- Returns true and records the call if under the limit; false if over.
create or replace function public.rate_ok(p_kind text, p_limit int, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if auth.uid() is null then return false; end if;
  select count(*) into v from public.usage_events
    where user_id = auth.uid() and kind = p_kind and created_at > now() - p_window;
  if v >= p_limit then return false; end if;
  insert into public.usage_events(user_id, kind) values (auth.uid(), p_kind);
  return true;
end; $$;
grant execute on function public.rate_ok(text,int,interval) to authenticated;

-- ============================================================
-- #10 — Writable crew on OPERATIONAL tables only.
-- Shows, trips, org_settings, org_members stay owner|manager (finance/promoter
-- live on shows). Crew may update the day-of operational rows.
-- NOTE: the client's full-store push must be role-scoped before crew writes
-- work end-to-end (a crew push that also upserts `shows` will be rejected).
-- These policies are harmless until crew members exist.
-- ============================================================
create or replace function public.user_in_org(p_org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.org_members where org_id = p_org_id and user_id = auth.uid());
$$;

drop policy if exists checklist_write on public.show_checklist_items;
create policy checklist_write on public.show_checklist_items for all
  using (public.user_in_org(org_id)) with check (public.user_in_org(org_id));

drop policy if exists timeline_write on public.show_timeline_steps;
create policy timeline_write on public.show_timeline_steps for all
  using (public.user_in_org(org_id)) with check (public.user_in_org(org_id));

drop policy if exists ideas_write on public.ideas;
create policy ideas_write on public.ideas for all
  using (public.user_in_org(org_id)) with check (public.user_in_org(org_id));

drop policy if exists notes_write on public.notes;
create policy notes_write on public.notes for all
  using (public.user_in_org(org_id)) with check (public.user_in_org(org_id));

drop policy if exists logistics_write on public.logistics_items;
create policy logistics_write on public.logistics_items for all
  using (public.user_in_org(org_id)) with check (public.user_in_org(org_id));

-- Realtime for invites (optional)
alter publication supabase_realtime add table public.org_invites;

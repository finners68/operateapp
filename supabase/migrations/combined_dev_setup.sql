-- Operate â€” Supabase schema
-- Auth: magic-link (email OTP) | Tenancy: orgs + roles (owner | manager | crew)

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Orgs
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger orgs_updated before update on public.orgs
  for each row execute function public.set_updated_at();

create table public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','crew')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index org_members_user_idx on public.org_members(user_id);

create or replace function public.user_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select org_id from public.org_members where user_id = auth.uid();
$$;

create or replace function public.user_can_write_org(p_org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = auth.uid()
      and role in ('owner','manager')
  );
$$;

-- Shows (kind = 'show' in store.events)
create table public.shows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  legacy_id text not null,
  show_date date not null,
  artist text,
  trip_legacy_id text,
  status text,
  color text,
  venue text,
  city text,
  country text,
  set_time text,
  end_time text,
  arrival text,
  venue_addr text,
  notes text,
  content text,
  set_done boolean default false,
  flight_no text,
  terminal text,
  gate text,
  fstatus text,
  delay text,
  fi_updated timestamptz,
  fi_live boolean,
  hotel jsonb,
  driver jsonb,
  promoter jsonb,
  finance jsonb,
  advance jsonb,
  show_contacts jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, legacy_id)
);
create index shows_org_date_idx on public.shows(org_id, show_date);
create trigger shows_updated before update on public.shows
  for each row execute function public.set_updated_at();

-- Logistics (travel / stay / marker)
create table public.logistics_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  legacy_id text not null,
  show_id uuid references public.shows(id) on delete set null,
  show_legacy_id text,
  kind text not null check (kind in ('travel','stay','marker')),
  item_date date not null,
  title text,
  start_time text,
  end_time text,
  icon text,
  info text,
  all_day boolean default false,
  done boolean default false,
  passes jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, legacy_id)
);
create index logistics_org_date_idx on public.logistics_items(org_id, item_date);
create trigger logistics_updated before update on public.logistics_items
  for each row execute function public.set_updated_at();

create table public.show_flights (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  legacy_id text not null,
  code text,
  from_code text,
  to_code text,
  dep text,
  arr text,
  seat text,
  sort_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, legacy_id)
);
create index show_flights_show_idx on public.show_flights(show_id);
create trigger show_flights_updated before update on public.show_flights
  for each row execute function public.set_updated_at();

create table public.show_flight_passes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  flight_id uuid not null references public.show_flights(id) on delete cascade,
  legacy_id text not null,
  name text,
  mime_type text,
  storage_path text,
  sort_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, legacy_id)
);
create trigger show_flight_passes_updated before update on public.show_flight_passes
  for each row execute function public.set_updated_at();

create table public.show_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  show_id uuid references public.shows(id) on delete cascade,
  legacy_id text not null,
  file_role text not null check (file_role in ('attachment','header','itinerary','pass')),
  name text,
  mime_type text,
  storage_path text,
  parent_legacy_id text,
  sort_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, legacy_id)
);
create index show_files_show_idx on public.show_files(show_id);
create trigger show_files_updated before update on public.show_files
  for each row execute function public.set_updated_at();

create table public.show_checklist_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  legacy_id text not null,
  label text not null,
  done boolean default false,
  sort_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, legacy_id)
);
create trigger show_checklist_updated before update on public.show_checklist_items
  for each row execute function public.set_updated_at();

create table public.show_timeline_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  legacy_id text not null,
  time text,
  title text,
  sub text,
  done boolean default false,
  sort_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, legacy_id)
);
create trigger show_timeline_updated before update on public.show_timeline_steps
  for each row execute function public.set_updated_at();

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  legacy_id text not null,
  type text,
  title text,
  note text,
  prio text,
  done boolean default false,
  event_legacy_id text,
  trip_legacy_id text,
  sort_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, legacy_id)
);
create trigger ideas_updated before update on public.ideas
  for each row execute function public.set_updated_at();

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  legacy_id text not null,
  title text,
  body text,
  folder text,
  note_updated timestamptz,
  sort_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, legacy_id)
);
create trigger notes_updated before update on public.notes
  for each row execute function public.set_updated_at();

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  legacy_id text not null,
  name text,
  color text,
  start_date date,
  end_date date,
  archived boolean default false,
  checklist jsonb default '[]'::jsonb,
  timeline jsonb default '[]'::jsonb,
  emergency jsonb default '[]'::jsonb,
  sort_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, legacy_id)
);
create trigger trips_updated before update on public.trips
  for each row execute function public.set_updated_at();

create table public.org_settings (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  packing jsonb default '[]'::jsonb,
  contacts jsonb default '[]'::jsonb,
  invoices jsonb default '[]'::jsonb,
  itineraries jsonb default '[]'::jsonb,
  artists jsonb default '[]'::jsonb,
  active_trip_id text,
  active_show_id text,
  tab text default 'home',
  seq int default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger org_settings_updated before update on public.org_settings
  for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.shows enable row level security;
alter table public.logistics_items enable row level security;
alter table public.show_flights enable row level security;
alter table public.show_flight_passes enable row level security;
alter table public.show_files enable row level security;
alter table public.show_checklist_items enable row level security;
alter table public.show_timeline_steps enable row level security;
alter table public.ideas enable row level security;
alter table public.notes enable row level security;
alter table public.trips enable row level security;
alter table public.org_settings enable row level security;

create policy profiles_select on public.profiles for select using (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid());

create policy orgs_select on public.orgs for select
  using (id in (select public.user_org_ids()));
create policy orgs_insert on public.orgs for insert with check (auth.uid() is not null);

create policy org_members_select on public.org_members for select
  using (org_id in (select public.user_org_ids()));
create policy org_members_insert on public.org_members for insert
  with check (user_id = auth.uid() or public.user_can_write_org(org_id));

create policy shows_select on public.shows for select
  using (org_id in (select public.user_org_ids()));
create policy shows_insert on public.shows for insert
  with check (public.user_can_write_org(org_id));
create policy shows_update on public.shows for update
  using (public.user_can_write_org(org_id));
create policy shows_delete on public.shows for delete
  using (public.user_can_write_org(org_id));

create policy logistics_select on public.logistics_items for select
  using (org_id in (select public.user_org_ids()));
create policy logistics_write on public.logistics_items for all
  using (public.user_can_write_org(org_id))
  with check (public.user_can_write_org(org_id));

create policy show_flights_select on public.show_flights for select
  using (org_id in (select public.user_org_ids()));
create policy show_flights_write on public.show_flights for all
  using (public.user_can_write_org(org_id))
  with check (public.user_can_write_org(org_id));

create policy show_flight_passes_select on public.show_flight_passes for select
  using (org_id in (select public.user_org_ids()));
create policy show_flight_passes_write on public.show_flight_passes for all
  using (public.user_can_write_org(org_id))
  with check (public.user_can_write_org(org_id));

create policy show_files_select on public.show_files for select
  using (org_id in (select public.user_org_ids()));
create policy show_files_write on public.show_files for all
  using (public.user_can_write_org(org_id))
  with check (public.user_can_write_org(org_id));

create policy checklist_select on public.show_checklist_items for select
  using (org_id in (select public.user_org_ids()));
create policy checklist_write on public.show_checklist_items for all
  using (public.user_can_write_org(org_id))
  with check (public.user_can_write_org(org_id));

create policy timeline_select on public.show_timeline_steps for select
  using (org_id in (select public.user_org_ids()));
create policy timeline_write on public.show_timeline_steps for all
  using (public.user_can_write_org(org_id))
  with check (public.user_can_write_org(org_id));

create policy ideas_select on public.ideas for select
  using (org_id in (select public.user_org_ids()));
create policy ideas_write on public.ideas for all
  using (public.user_can_write_org(org_id))
  with check (public.user_can_write_org(org_id));

create policy notes_select on public.notes for select
  using (org_id in (select public.user_org_ids()));
create policy notes_write on public.notes for all
  using (public.user_can_write_org(org_id))
  with check (public.user_can_write_org(org_id));

create policy trips_select on public.trips for select
  using (org_id in (select public.user_org_ids()));
create policy trips_write on public.trips for all
  using (public.user_can_write_org(org_id))
  with check (public.user_can_write_org(org_id));

create policy org_settings_select on public.org_settings for select
  using (org_id in (select public.user_org_ids()));
create policy org_settings_write on public.org_settings for all
  using (public.user_can_write_org(org_id))
  with check (public.user_can_write_org(org_id));

-- Realtime
alter publication supabase_realtime add table public.shows;
alter publication supabase_realtime add table public.logistics_items;
alter publication supabase_realtime add table public.show_flights;
alter publication supabase_realtime add table public.show_flight_passes;
alter publication supabase_realtime add table public.show_files;
alter publication supabase_realtime add table public.show_checklist_items;
alter publication supabase_realtime add table public.show_timeline_steps;
alter publication supabase_realtime add table public.ideas;
alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.trips;
alter publication supabase_realtime add table public.org_settings;
-- Private Storage bucket for boarding passes, attachments, header photos
-- Path pattern: {org_id}/{show_id}/{uuid}-{filename}

insert into storage.buckets (id, name, public)
values ('operate-documents', 'operate-documents', false)
on conflict (id) do update set public = false;

create policy storage_read on storage.objects for select
  using (
    bucket_id = 'operate-documents'
    and (storage.foldername(name))[1]::uuid in (select public.user_org_ids())
  );

create policy storage_insert on storage.objects for insert
  with check (
    bucket_id = 'operate-documents'
    and public.user_can_write_org((storage.foldername(name))[1]::uuid)
  );

create policy storage_update on storage.objects for update
  using (
    bucket_id = 'operate-documents'
    and public.user_can_write_org((storage.foldername(name))[1]::uuid)
  );

create policy storage_delete on storage.objects for delete
  using (
    bucket_id = 'operate-documents'
    and public.user_can_write_org((storage.foldername(name))[1]::uuid)
  );

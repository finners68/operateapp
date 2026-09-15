-- Remember when a show has no stay booked, so Travel & stay does not keep
-- asking for accommodation after reload.
alter table public.shows
  add column if not exists no_accommodation boolean not null default false;

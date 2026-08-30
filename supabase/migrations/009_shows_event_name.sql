-- Event / booking name separate from venue (e.g. "Parklife" at "Heaton Park").
-- Applied manually on operate-dev; kept here for env parity.
alter table public.shows
  add column if not exists event_name text;

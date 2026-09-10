-- True calendar date the artist's set begins.
-- show_date stays the operational/event date.
-- Same-day sets: set_start_date = set_end_date = show_date.
-- Early-morning sets (e.g. Saturday show, 01:00–02:30 Sunday): both dates are the next day.

alter table public.shows
  add column if not exists set_start_date date;

comment on column public.shows.set_start_date is
  'True calendar date the set begins. Equals show_date unless the set starts after midnight on the following morning.';

comment on column public.shows.set_end_date is
  'True calendar date the set ends. Equals set_start_date unless the set crosses midnight.';

-- Default: operational date.
update public.shows
set set_start_date = show_date
where set_start_date is null;

-- Set starts in the small hours and does not wrap (01:00–02:30): both dates are the next morning.
update public.shows
set set_start_date = show_date + 1
where set_start_time is not null
  and set_start_time < time '06:00'
  and (set_end_time is null or set_end_time >= set_start_time);

-- End date must not be before the true start date.
update public.shows
set set_end_date = set_start_date
where set_start_date is not null
  and (set_end_date is null or set_end_date < set_start_date);

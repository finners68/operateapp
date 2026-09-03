-- True calendar date for a set that finishes after midnight.
-- show_date stays the operational/show day; set_end_date is the morning after.
alter table public.shows
  add column if not exists set_end_date date;

update public.shows
set set_end_date = show_date + 1
where set_end_date is null
  and set_start_time is not null
  and set_end_time is not null
  and set_end_time < set_start_time;

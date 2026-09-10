-- True end calendar date for schedule items that continue past midnight.
-- shows.set_end_date is the true date the set finishes (same as show_date, or next day).
-- journeys.passengers stays jsonb; objects may include booking_reference.

alter table public.schedule_items
  add column if not exists scheduled_end_date date;

comment on column public.schedule_items.scheduled_end_date is
  'True calendar date the item ends. Null when unknown.';

comment on column public.shows.set_end_date is
  'True calendar date the set ends. Equals show_date unless the set crosses midnight.';

update public.shows
set set_end_date = show_date
where set_end_date is null;

update public.schedule_items
set scheduled_end_date = scheduled_date + 1
where scheduled_end_date is null
  and scheduled_date is not null
  and scheduled_time is not null
  and scheduled_end_time is not null
  and scheduled_end_time < scheduled_time;

comment on column public.journeys.passengers is
  'Flight passengers: [{id, name, seat, booking_reference}]. Boarding passes link via travel_tickets.ticket_reference = passenger id.';

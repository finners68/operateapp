-- Store show / hotel / flight / driver notes as jsonb arrays: [{id, text}, ...]
-- journey_notes stays text (logistics packing + leftover itinerary copy).

create or replace function public.text_notes_to_jsonb(src text)
returns jsonb
language plpgsql
immutable
as $$
declare
  trimmed text;
  parsed jsonb;
begin
  if src is null then
    return null;
  end if;
  trimmed := btrim(src);
  if trimmed = '' then
    return null;
  end if;
  if left(trimmed, 1) = '[' then
    begin
      parsed := trimmed::jsonb;
      if jsonb_typeof(parsed) = 'array' then
        return parsed;
      end if;
    exception when others then
      parsed := null;
    end;
  end if;
  return jsonb_build_array(jsonb_build_object('id', 'legacy', 'text', src));
end;
$$;

alter table public.shows
  alter column internal_notes type jsonb
  using public.text_notes_to_jsonb(internal_notes);

comment on column public.shows.internal_notes is
  'Show notes as [{id, text}, ...]. Null means none.';

alter table public.hotel_bookings
  alter column room_notes type jsonb
  using public.text_notes_to_jsonb(room_notes);

comment on column public.hotel_bookings.room_notes is
  'Hotel room notes as [{id, text}, ...].';

alter table public.hotels
  alter column hotel_notes type jsonb
  using public.text_notes_to_jsonb(hotel_notes);

comment on column public.hotels.hotel_notes is
  'Hotel notes as [{id, text}, ...].';

alter table public.journeys
  add column if not exists note_items jsonb;

comment on column public.journeys.note_items is
  'User notes for show flights/drivers as [{id, text}, ...]. Separate from journey_notes.';

update public.journeys j
set note_items = public.text_notes_to_jsonb(j.journey_notes)
where j.deleted_at is null
  and j.note_items is null
  and j.journey_notes is not null
  and btrim(j.journey_notes) <> ''
  and j.journey_notes !~* '^Legacy seat:'
  and left(btrim(j.journey_notes), 1) <> '{'
  and (
    coalesce(j.legacy_id, '') like 'show_flight:%'
    or coalesce(j.legacy_id, '') like 'show_driver_journey:%'
    or (j.journey_type = 'flight' and j.related_show_id is not null)
  );

update public.journeys j
set journey_notes = null
where j.note_items is not null
  and coalesce(j.legacy_id, '') like 'show_flight:%';

drop function public.text_notes_to_jsonb(text);

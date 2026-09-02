-- Optional title text colour for a show (same palette keys as color_key).
alter table public.shows
  add column if not exists text_color_key text;

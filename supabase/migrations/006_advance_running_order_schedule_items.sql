-- Historical note: advancing running order previously used schedule_items
-- with legacy_id prefix advance_schedule:<uuid>. That contract is superseded
-- by show_advances.running_order (see 007_show_advances_running_order.sql).
-- Day timeline still uses schedule_items with show_timeline:<id>.

COMMENT ON TABLE public.schedule_items IS
  'Show/tour timed items. Day timeline uses legacy_id show_timeline:<id>. Advancing running order lives on show_advances.running_order.';

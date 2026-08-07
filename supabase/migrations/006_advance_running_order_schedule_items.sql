-- Running-order rows for show advancing are stored in schedule_items
-- (legacy_id prefix advance_schedule:<uuid>). No new columns required:
-- item_title, scheduled_time, sort_order, schedule_item_type already exist.
--
-- This migration documents the contract and ensures soft-deleted rows can be
-- cleaned up safely. Safe to re-run.

COMMENT ON TABLE public.schedule_items IS
  'Show/tour timed items. Advancing running order uses legacy_id advance_schedule:<id>; day timeline uses show_timeline:<id>.';

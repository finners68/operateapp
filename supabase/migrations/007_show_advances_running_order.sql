-- Advancing running order lives on show_advances (not schedule_items).
ALTER TABLE public.show_advances
  ADD COLUMN IF NOT EXISTS running_order jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.show_advances.running_order IS
  'Advancing running order: JSON array of {id, time, label} (optional done).';

COMMENT ON TABLE public.schedule_items IS
  'Show/tour timed items. Day timeline uses legacy_id show_timeline:<id>. Advancing running order lives on show_advances.running_order.';

-- Backfill from legacy advance_schedule: rows in schedule_items.
UPDATE public.show_advances sa
SET running_order = sub.items,
    updated_at = now()
FROM (
  SELECT show_id,
         jsonb_agg(
           jsonb_build_object(
             'id', id,
             'time', COALESCE(to_char(scheduled_time, 'HH24:MI'), ''),
             'label', COALESCE(item_title, '')
           ) ORDER BY sort_order, scheduled_time NULLS LAST
         ) AS items
  FROM public.schedule_items
  WHERE legacy_id LIKE 'advance_schedule:%'
    AND show_id IS NOT NULL
    AND deleted_at IS NULL
  GROUP BY show_id
) sub
WHERE sa.show_id = sub.show_id
  AND (sa.running_order IS NULL OR sa.running_order = '[]'::jsonb);

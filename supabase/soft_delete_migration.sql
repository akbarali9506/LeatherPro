-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Step 1: Add deleted_at column to batches
ALTER TABLE batches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Step 2: Schedule automatic hard-delete of soft-deleted batches older than 7 days
-- Requires pg_cron extension (enabled by default in Supabase)
SELECT cron.schedule(
  'purge-soft-deleted-batches',
  '0 3 * * *',   -- runs daily at 03:00 UTC
  $$
    DELETE FROM batches
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '7 days';
  $$
);

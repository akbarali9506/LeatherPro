-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Add soft-delete column to batches table
ALTER TABLE batches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- No pg_cron needed: the app automatically purges batches where
-- deleted_at < NOW() - 7 days on each pull from Supabase.

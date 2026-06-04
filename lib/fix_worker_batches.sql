-- ============================================================
-- Fix: Workers can now insert and update batches
-- Run this in Supabase SQL Editor
-- ============================================================

-- Workers need to push batch changes:
--   • INSERT: create new batches
--   • UPDATE: edit existing batches
-- Delete is still director-only, enforced both here and in the UI.

DROP POLICY IF EXISTS "batches_insert" ON batches;
CREATE POLICY "batches_insert" ON batches
  FOR INSERT
  WITH CHECK (organization_id = my_org_id());

DROP POLICY IF EXISTS "batches_update" ON batches;
CREATE POLICY "batches_update" ON batches
  FOR UPDATE
  USING (organization_id = my_org_id())
  WITH CHECK (organization_id = my_org_id());

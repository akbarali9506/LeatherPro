-- ============================================================
-- Fix: Workers can now update and insert inventory
-- Run this in Supabase SQL Editor
-- ============================================================

-- Workers need to push inventory changes when saving batches:
--   • UPDATE: deduct chemicals / wet blue quantities
--   • INSERT: create finished leather items from batch output
-- Price and name protection is enforced at the app level
-- (workers have no UI controls to change price/name/type).

DROP POLICY IF EXISTS "inventory_update" ON inventory;
CREATE POLICY "inventory_update" ON inventory
  FOR UPDATE
  USING (organization_id = my_org_id())
  WITH CHECK (organization_id = my_org_id());

DROP POLICY IF EXISTS "inventory_insert" ON inventory;
CREATE POLICY "inventory_insert" ON inventory
  FOR INSERT
  WITH CHECK (organization_id = my_org_id());

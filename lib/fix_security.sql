-- ============================================================
-- Security fixes — run these in Supabase SQL Editor
-- ============================================================

-- ── Finding #2 (CRITICAL): profiles_update missing WITH CHECK ──────────────
-- Without WITH CHECK, any worker could set role='director' on their own row.
-- Fix: lock role and organization_id to their current DB values.
-- SECURITY DEFINER RPCs (create_organization, join_organization) bypass RLS
-- and can still legitimately change these fields.

DROP POLICY IF EXISTS "profiles_update" ON profiles;

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = my_role()
    AND organization_id IS NOT DISTINCT FROM my_org_id()
  );


-- ── Finding #3 (MEDIUM): UPDATE policies missing WITH CHECK ────────────────
-- Without WITH CHECK, a director could change organization_id on any record,
-- moving it to a different org. Fix: enforce the new row stays in the same org.

DROP POLICY IF EXISTS "orgs_update" ON organizations;
CREATE POLICY "orgs_update" ON organizations
  FOR UPDATE
  USING (id = my_org_id() AND my_role() = 'director')
  WITH CHECK (id = my_org_id());

DROP POLICY IF EXISTS "inventory_update" ON inventory;
CREATE POLICY "inventory_update" ON inventory
  FOR UPDATE
  USING (organization_id = my_org_id() AND my_role() = 'director')
  WITH CHECK (organization_id = my_org_id());

DROP POLICY IF EXISTS "batches_update" ON batches;
CREATE POLICY "batches_update" ON batches
  FOR UPDATE
  USING (organization_id = my_org_id() AND my_role() = 'director')
  WITH CHECK (organization_id = my_org_id());

DROP POLICY IF EXISTS "sales_update" ON sales;
CREATE POLICY "sales_update" ON sales
  FOR UPDATE
  USING (organization_id = my_org_id() AND my_role() = 'director')
  WITH CHECK (organization_id = my_org_id());

DROP POLICY IF EXISTS "buyers_update" ON buyers;
CREATE POLICY "buyers_update" ON buyers
  FOR UPDATE
  USING (organization_id = my_org_id() AND my_role() = 'director')
  WITH CHECK (organization_id = my_org_id());

DROP POLICY IF EXISTS "settings_update" ON org_settings;
CREATE POLICY "settings_update" ON org_settings
  FOR UPDATE
  USING (organization_id = my_org_id() AND my_role() = 'director')
  WITH CHECK (organization_id = my_org_id());


-- ── Finding #6 (MEDIUM): sales_insert doesn't enforce worker pricing rules ─
-- Workers could bypass the app and insert sales with needsPricing=false and
-- arbitrary prices, corrupting revenue reporting.
-- Fix: split into two policies — directors have full control, workers must
-- set needs_pricing=TRUE and price=0.

DROP POLICY IF EXISTS "sales_insert" ON sales;

CREATE POLICY "sales_insert_director" ON sales
  FOR INSERT WITH CHECK (
    organization_id = my_org_id()
    AND my_role() = 'director'
  );

CREATE POLICY "sales_insert_worker" ON sales
  FOR INSERT WITH CHECK (
    organization_id = my_org_id()
    AND my_role() = 'worker'
    AND needs_pricing = TRUE
    AND price = 0
  );

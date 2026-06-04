-- Drop old policies that may conflict
DROP POLICY IF EXISTS "orgs_insert" ON organizations;
DROP POLICY IF EXISTS "settings_insert" ON org_settings;

-- Re-add them cleanly
CREATE POLICY "orgs_insert" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "settings_insert" ON org_settings
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RPC that creates org + updates profile + creates settings in one transaction
-- SECURITY DEFINER = runs as postgres, bypasses RLS
CREATE OR REPLACE FUNCTION create_organization(org_name TEXT, user_lang TEXT DEFAULT 'en')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Create the organization
  INSERT INTO organizations (name)
  VALUES (org_name)
  RETURNING id INTO new_org_id;

  -- Link the calling user as director
  UPDATE profiles
  SET organization_id = new_org_id, role = 'director'
  WHERE id = auth.uid();

  -- Create default settings
  INSERT INTO org_settings (organization_id, language, low_stock_threshold, exchange_rates)
  VALUES (
    new_org_id,
    user_lang,
    10,
    '{"USD": 1, "EUR": 1.1, "UZS": 0.000079}'::jsonb
  );

  RETURN new_org_id;
END;
$$;

-- RPC that joins an existing org as worker
CREATE OR REPLACE FUNCTION join_organization(org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify org exists
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = org_id) THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  UPDATE profiles
  SET organization_id = org_id, role = 'worker'
  WHERE id = auth.uid();
END;
$$;

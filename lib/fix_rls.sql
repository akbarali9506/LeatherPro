-- Missing INSERT policies that block organization creation

-- Any authenticated user can create an organization (they become the director)
CREATE POLICY "orgs_insert" ON organizations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow inserting org settings right after org creation
CREATE POLICY "settings_insert" ON org_settings
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- LeatherPro Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Organizations (one per tannery/business)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  role TEXT CHECK (role IN ('worker', 'director')) NOT NULL DEFAULT 'worker',
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory items
CREATE TABLE inventory (
  id TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  grade TEXT,
  batch_id TEXT,
  batch_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, organization_id)
);

-- Production batches
CREATE TABLE batches (
  id TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  hides INTEGER NOT NULL DEFAULT 0,
  wet_blue JSONB NOT NULL DEFAULT '[]',
  chemicals JSONB NOT NULL DEFAULT '[]',
  other_costs JSONB NOT NULL DEFAULT '[]',
  output JSONB NOT NULL DEFAULT '{}',
  chem_cost NUMERIC NOT NULL DEFAULT 0,
  raw_cost NUMERIC NOT NULL DEFAULT 0,
  other_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  profit NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, organization_id)
);

-- Sales
CREATE TABLE sales (
  id TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  batch_id TEXT,
  inventory_id TEXT NOT NULL,
  grade TEXT,
  qty NUMERIC NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  buyer TEXT NOT NULL,
  date TEXT NOT NULL,
  sale_type TEXT DEFAULT 'leather',
  payment_status TEXT DEFAULT 'paid',
  paid_amount NUMERIC,
  needs_pricing BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, organization_id)
);

-- Buyers
CREATE TABLE buyers (
  id TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, organization_id)
);

-- Organization settings (one row per org)
CREATE TABLE org_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  language TEXT DEFAULT 'en',
  low_stock_threshold NUMERIC DEFAULT 10,
  exchange_rates JSONB DEFAULT '{"USD": 1, "EUR": 1.1, "UZS": 0.000079}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price reviews
CREATE TABLE price_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  old_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  weighted_avg NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  added_qty NUMERIC NOT NULL,
  existing_qty NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (data isolated per organization)
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_reviews ENABLE ROW LEVEL SECURITY;

-- Helper function: get the calling user's organization_id
CREATE OR REPLACE FUNCTION my_org_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$;

-- Helper function: get the calling user's role
CREATE OR REPLACE FUNCTION my_role()
RETURNS TEXT LANGUAGE SQL STABLE AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Profiles: users can read/update their own profile
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid());

-- Organizations: members can read their own org
CREATE POLICY "orgs_select" ON organizations FOR SELECT USING (id = my_org_id());
-- Directors can update org name
CREATE POLICY "orgs_update" ON organizations FOR UPDATE USING (id = my_org_id() AND my_role() = 'director');

-- Inventory: all members can read; only directors can write
CREATE POLICY "inventory_select" ON inventory FOR SELECT USING (organization_id = my_org_id());
CREATE POLICY "inventory_insert" ON inventory FOR INSERT WITH CHECK (organization_id = my_org_id() AND my_role() = 'director');
CREATE POLICY "inventory_update" ON inventory FOR UPDATE USING (organization_id = my_org_id() AND my_role() = 'director');
CREATE POLICY "inventory_delete" ON inventory FOR DELETE USING (organization_id = my_org_id() AND my_role() = 'director');

-- Batches: all members can read; only directors can write
CREATE POLICY "batches_select" ON batches FOR SELECT USING (organization_id = my_org_id());
CREATE POLICY "batches_insert" ON batches FOR INSERT WITH CHECK (organization_id = my_org_id() AND my_role() = 'director');
CREATE POLICY "batches_update" ON batches FOR UPDATE USING (organization_id = my_org_id() AND my_role() = 'director');
CREATE POLICY "batches_delete" ON batches FOR DELETE USING (organization_id = my_org_id() AND my_role() = 'director');

-- Sales: all members can read and insert; only directors can update/delete
CREATE POLICY "sales_select" ON sales FOR SELECT USING (organization_id = my_org_id());
CREATE POLICY "sales_insert" ON sales FOR INSERT WITH CHECK (organization_id = my_org_id());
CREATE POLICY "sales_update" ON sales FOR UPDATE USING (organization_id = my_org_id() AND my_role() = 'director');
CREATE POLICY "sales_delete" ON sales FOR DELETE USING (organization_id = my_org_id() AND my_role() = 'director');

-- Buyers: all members can read; only directors can write
CREATE POLICY "buyers_select" ON buyers FOR SELECT USING (organization_id = my_org_id());
CREATE POLICY "buyers_insert" ON buyers FOR INSERT WITH CHECK (organization_id = my_org_id() AND my_role() = 'director');
CREATE POLICY "buyers_update" ON buyers FOR UPDATE USING (organization_id = my_org_id() AND my_role() = 'director');
CREATE POLICY "buyers_delete" ON buyers FOR DELETE USING (organization_id = my_org_id() AND my_role() = 'director');

-- Settings: all members can read; only directors can update
CREATE POLICY "settings_select" ON org_settings FOR SELECT USING (organization_id = my_org_id());
CREATE POLICY "settings_update" ON org_settings FOR UPDATE USING (organization_id = my_org_id() AND my_role() = 'director');

-- Price reviews: all members can read; only directors can manage
CREATE POLICY "reviews_select" ON price_reviews FOR SELECT USING (organization_id = my_org_id());
CREATE POLICY "reviews_insert" ON price_reviews FOR INSERT WITH CHECK (organization_id = my_org_id() AND my_role() = 'director');
CREATE POLICY "reviews_delete" ON price_reviews FOR DELETE USING (organization_id = my_org_id() AND my_role() = 'director');

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

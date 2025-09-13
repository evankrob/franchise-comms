-- Fix for persistent RLS policy violation during tenant creation
-- This version uses auth.uid() directly for better reliability

-- 1. Update the current_user_id function to use auth.uid()
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Drop existing problematic policies if they exist
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON tenants;
DROP POLICY IF EXISTS "Users can create their own memberships" ON memberships;

-- 3. Create new policies using auth.uid() directly
CREATE POLICY "Authenticated users can create tenants" ON tenants
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can create their own memberships" ON memberships
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );
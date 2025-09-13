-- Debug and fix RLS tenant creation issues
-- Run each section separately to diagnose the problem

-- 1. First, check what policies currently exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('tenants', 'memberships')
ORDER BY tablename, policyname;

-- 2. Test the current_user_id() function
SELECT 
  current_setting('request.jwt.claims', true) as jwt_claims,
  current_setting('request.jwt.claims', true)::json->>'sub' as user_sub,
  current_user_id() as current_user_function_result;

-- 3. Drop existing problematic function and create a simpler one
DROP FUNCTION IF EXISTS current_user_id();

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. Drop existing policies and recreate them with simpler logic
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON tenants;
DROP POLICY IF EXISTS "Users can create their own memberships" ON memberships;

-- 5. Create new policies with direct auth.uid() checks
CREATE POLICY "Authenticated users can create tenants" ON tenants
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can create their own memberships" ON memberships
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

-- 6. Test the policies by checking if they were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('tenants', 'memberships')
ORDER BY tablename, policyname;
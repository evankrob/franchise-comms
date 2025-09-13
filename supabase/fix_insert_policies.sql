-- Fix INSERT policies - they're missing WITH CHECK conditions
-- The current policies have "qual": null which means no conditions are applied

-- 1. Drop and recreate the tenant INSERT policy with proper WITH CHECK
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON tenants;

CREATE POLICY "Authenticated users can create tenants" ON tenants
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Drop and recreate the membership INSERT policy with proper WITH CHECK  
DROP POLICY IF EXISTS "Users can create their own memberships" ON memberships;

CREATE POLICY "Users can create their own memberships" ON memberships
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- 3. Verify the policies were created correctly
SELECT tablename, policyname, cmd, with_check 
FROM pg_policies 
WHERE tablename IN ('tenants', 'memberships') 
AND cmd = 'INSERT'
ORDER BY tablename, policyname;
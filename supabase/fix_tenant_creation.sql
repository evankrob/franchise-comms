-- Fix for RLS policy violation when creating new organizations/tenants
-- Run this SQL in your Supabase dashboard to allow tenant creation during onboarding

-- Add INSERT policy for tenants table to allow authenticated users to create organizations
CREATE POLICY "Authenticated users can create tenants" ON tenants
  FOR INSERT WITH CHECK (
    current_user_id() IS NOT NULL
  );

-- Add INSERT policy for memberships table to allow users to create their own memberships
-- This is needed because users need to create their initial tenant_admin membership
CREATE POLICY "Users can create their own memberships" ON memberships
  FOR INSERT WITH CHECK (
    user_id = current_user_id()
  );
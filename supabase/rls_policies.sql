-- Row Level Security (RLS) Policies for Multi-tenant Architecture
-- These policies ensure users can only access data for their authorized tenants/locations

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS policies
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', ''),
    (NULLIF(current_setting('request.jwt.claims', true)::json->>'role', '') = 'service_role')::text
  )::uuid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_user_in_tenant(tenant_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships 
    WHERE user_id = current_user_id() 
    AND tenant_id = tenant_uuid 
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION user_location_ids(tenant_uuid UUID)
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT lm.location_id 
    FROM location_memberships lm
    JOIN locations l ON l.id = lm.location_id
    WHERE lm.user_id = current_user_id() 
    AND l.tenant_id = tenant_uuid
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_access_post(post_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  post_tenant_id UUID;
  post_targeting JSONB;
  user_locations UUID[];
  target_locations UUID[];
BEGIN
  -- Get post tenant and targeting info
  SELECT tenant_id, targeting INTO post_tenant_id, post_targeting
  FROM posts WHERE id = post_uuid;
  
  -- Check if user is in the tenant
  IF NOT is_user_in_tenant(post_tenant_id) THEN
    RETURN FALSE;
  END IF;
  
  -- If no location targeting, user has access
  IF post_targeting->'locations' IS NULL OR jsonb_array_length(post_targeting->'locations') = 0 THEN
    RETURN TRUE;
  END IF;
  
  -- Check location-based targeting
  user_locations := user_location_ids(post_tenant_id);
  SELECT ARRAY(SELECT jsonb_array_elements_text(post_targeting->'locations'))::UUID[] INTO target_locations;
  
  -- User has access if they belong to any of the targeted locations
  RETURN user_locations && target_locations;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- TENANTS RLS POLICIES
CREATE POLICY "Users can view tenants they belong to" ON tenants
  FOR SELECT USING (is_user_in_tenant(id));

CREATE POLICY "Tenant admins can update their tenant" ON tenants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE user_id = current_user_id() 
      AND tenant_id = tenants.id 
      AND role = 'tenant_admin' 
      AND status = 'active'
    )
  );

CREATE POLICY "Authenticated users can create tenants" ON tenants
  FOR INSERT WITH CHECK (
    current_user_id() IS NOT NULL
  );

-- USERS RLS POLICIES
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (id = current_user_id());

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (id = current_user_id());

CREATE POLICY "Users can view other users in same tenant" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships m1
      JOIN memberships m2 ON m1.tenant_id = m2.tenant_id
      WHERE m1.user_id = current_user_id() 
      AND m2.user_id = users.id
      AND m1.status = 'active' 
      AND m2.status = 'active'
    )
  );

-- MEMBERSHIPS RLS POLICIES
CREATE POLICY "Users can view memberships in their tenants" ON memberships
  FOR SELECT USING (
    user_id = current_user_id() OR is_user_in_tenant(tenant_id)
  );

CREATE POLICY "Tenant admins can manage memberships" ON memberships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE user_id = current_user_id() 
      AND tenant_id = memberships.tenant_id 
      AND role = 'tenant_admin' 
      AND status = 'active'
    )
  );

CREATE POLICY "Users can create their own memberships" ON memberships
  FOR INSERT WITH CHECK (
    user_id = current_user_id()
  );

-- LOCATIONS RLS POLICIES
CREATE POLICY "Users can view locations in their tenant" ON locations
  FOR SELECT USING (is_user_in_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage locations" ON locations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE user_id = current_user_id() 
      AND tenant_id = locations.tenant_id 
      AND role = 'tenant_admin' 
      AND status = 'active'
    )
  );

-- LOCATION_MEMBERSHIPS RLS POLICIES
CREATE POLICY "Users can view location memberships they're involved in" ON location_memberships
  FOR SELECT USING (
    user_id = current_user_id() OR
    EXISTS (
      SELECT 1 FROM locations l
      WHERE l.id = location_memberships.location_id
      AND is_user_in_tenant(l.tenant_id)
    )
  );

CREATE POLICY "Tenant admins and franchise owners can manage location memberships" ON location_memberships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM locations l
      JOIN memberships m ON m.tenant_id = l.tenant_id
      WHERE l.id = location_memberships.location_id
      AND m.user_id = current_user_id()
      AND m.role IN ('tenant_admin', 'franchise_owner')
      AND m.status = 'active'
    )
  );

-- POSTS RLS POLICIES
CREATE POLICY "Users can view posts they have access to" ON posts
  FOR SELECT USING (can_access_post(id));

CREATE POLICY "Users can create posts in their tenant" ON posts
  FOR INSERT WITH CHECK (
    is_user_in_tenant(tenant_id) AND author_user_id = current_user_id()
  );

CREATE POLICY "Authors and admins can update posts" ON posts
  FOR UPDATE USING (
    author_user_id = current_user_id() OR
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE user_id = current_user_id() 
      AND tenant_id = posts.tenant_id 
      AND role IN ('tenant_admin', 'franchise_owner')
      AND status = 'active'
    )
  );

CREATE POLICY "Authors and admins can delete posts" ON posts
  FOR DELETE USING (
    author_user_id = current_user_id() OR
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE user_id = current_user_id() 
      AND tenant_id = posts.tenant_id 
      AND role IN ('tenant_admin', 'franchise_owner')
      AND status = 'active'
    )
  );

-- POST_REACTIONS RLS POLICIES
CREATE POLICY "Users can view reactions on accessible posts" ON post_reactions
  FOR SELECT USING (can_access_post(post_id));

CREATE POLICY "Users can manage their own reactions" ON post_reactions
  FOR ALL USING (user_id = current_user_id());

-- COMMENTS RLS POLICIES
CREATE POLICY "Users can view comments on accessible posts" ON comments
  FOR SELECT USING (can_access_post(post_id));

CREATE POLICY "Users can create comments on accessible posts" ON comments
  FOR INSERT WITH CHECK (
    can_access_post(post_id) AND author_user_id = current_user_id()
  );

CREATE POLICY "Authors can update their comments" ON comments
  FOR UPDATE USING (author_user_id = current_user_id());

CREATE POLICY "Authors and admins can delete comments" ON comments
  FOR DELETE USING (
    author_user_id = current_user_id() OR
    EXISTS (
      SELECT 1 FROM posts p
      JOIN memberships m ON m.tenant_id = p.tenant_id
      WHERE p.id = comments.post_id
      AND m.user_id = current_user_id()
      AND m.role IN ('tenant_admin', 'franchise_owner')
      AND m.status = 'active'
    )
  );

-- ATTACHMENTS RLS POLICIES
CREATE POLICY "Users can view attachments in their tenant" ON attachments
  FOR SELECT USING (is_user_in_tenant(tenant_id));

CREATE POLICY "Users can upload attachments to their tenant" ON attachments
  FOR INSERT WITH CHECK (
    is_user_in_tenant(tenant_id) AND uploader_user_id = current_user_id()
  );

CREATE POLICY "Uploaders and admins can delete attachments" ON attachments
  FOR DELETE USING (
    uploader_user_id = current_user_id() OR
    EXISTS (
      SELECT 1 FROM memberships 
      WHERE user_id = current_user_id() 
      AND tenant_id = attachments.tenant_id 
      AND role IN ('tenant_admin', 'franchise_owner')
      AND status = 'active'
    )
  );

-- NOTIFICATIONS RLS POLICIES
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = current_user_id());

CREATE POLICY "System can create notifications for users" ON notifications
  FOR INSERT WITH CHECK (
    is_user_in_tenant(tenant_id)
  );
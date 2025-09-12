-- Seed data for development and testing
-- This creates sample tenants, users, and test data

-- Sample tenant
INSERT INTO tenants (id, name, slug, current_plan, status, settings) VALUES 
(
  '00000000-0000-0000-0000-000000000001',
  'Demo Franchise Group',
  'demo-franchise',
  'trial',
  'active',
  '{
    "branding": {
      "primary_color": "#0ea5e9",
      "logo_url": null
    },
    "features": {
      "advanced_targeting": true,
      "file_attachments": true,
      "custom_fields": false
    }
  }'::jsonb
);

-- Sample locations for the demo tenant
INSERT INTO locations (id, tenant_id, name, address, city, state, zip_code, phone, email) VALUES 
(
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Downtown Location',
  '123 Main Street',
  'Anytown',
  'CA',
  '12345',
  '(555) 123-4567',
  'downtown@demofranchise.com'
),
(
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Westside Location',
  '456 Oak Avenue',
  'Anytown',
  'CA',
  '12346',
  '(555) 234-5678',
  'westside@demofranchise.com'
),
(
  '10000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'Eastside Location',
  '789 Pine Road',
  'Anytown',
  'CA',
  '12347',
  '(555) 345-6789',
  'eastside@demofranchise.com'
);

-- Note: Users will be automatically created when they sign up via Supabase Auth
-- The trigger will sync them to our users table

-- Function to create a demo user (for testing)
CREATE OR REPLACE FUNCTION create_demo_user(
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  tenant_slug TEXT DEFAULT 'demo-franchise',
  user_role user_role DEFAULT 'franchise_owner'
)
RETURNS VOID AS $$
DECLARE
  tenant_uuid UUID;
BEGIN
  -- Get tenant ID
  SELECT id INTO tenant_uuid FROM tenants WHERE slug = tenant_slug;
  
  IF tenant_uuid IS NULL THEN
    RAISE EXCEPTION 'Tenant with slug % not found', tenant_slug;
  END IF;
  
  -- Insert user
  INSERT INTO users (id, email, name) VALUES (user_id, user_email, user_name)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    updated_at = NOW();
  
  -- Create membership
  INSERT INTO memberships (user_id, tenant_id, role, status) 
  VALUES (user_id, tenant_uuid, user_role, 'active')
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    updated_at = NOW();
  
  -- If franchise_owner or franchise_staff, add location memberships
  IF user_role IN ('franchise_owner', 'franchise_staff') THEN
    -- Add to all locations for demo purposes
    INSERT INTO location_memberships (user_id, location_id, role)
    SELECT user_id, l.id, user_role
    FROM locations l 
    WHERE l.tenant_id = tenant_uuid
    ON CONFLICT (user_id, location_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- NOTE: Sample posts are commented out because users must be created through Supabase Auth first
-- After you sign up your first user through the application, you can create posts manually
-- or use the create_demo_user() function with a real auth user ID

-- Example of how to create posts after you have real users:
-- First sign up through your app, then run:
-- SELECT create_demo_user('your-real-user-id', 'user@example.com', 'User Name');
-- Then you can insert posts using that real user ID

/*
-- Sample posts (uncomment and update user IDs after creating real users)
INSERT INTO posts (id, tenant_id, author_user_id, title, body, post_type, status, targeting) VALUES
(
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'YOUR-REAL-USER-ID-HERE',
  'Welcome to the Demo Franchise Communications Platform!',
  'This is a sample announcement to demonstrate how posts work in the franchise communications platform. You can create targeted messages, announcements, requests, and performance updates.',
  'announcement',
  'published',
  '{}'::jsonb
);
*/

-- Create trigger to automatically create user profile when auth user is created
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create storage bucket for file attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (drop existing policies first, then recreate)
DROP POLICY IF EXISTS "Users can upload files to their tenant folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view files in their tenant" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

CREATE POLICY "Users can upload files to their tenant folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'attachments' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    (SELECT is_user_in_tenant((storage.foldername(name))[2]::uuid))
  );

CREATE POLICY "Users can view files in their tenant" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'attachments' AND
    (SELECT is_user_in_tenant((storage.foldername(name))[2]::uuid))
  );

CREATE POLICY "Users can delete their own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
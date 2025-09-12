# Supabase Database Setup

This directory contains the SQL files needed to set up the franchise communications platform database.

## Setup Instructions

1. **Create a Supabase project** at https://supabase.com/dashboard
2. **Copy your credentials** to `.env.local` in the project root
3. **Run the SQL files** in the Supabase SQL editor in this order:

### Step 1: Create the schema
Copy and paste the contents of `schema.sql` into the SQL editor and run it. This will:
- Create all tables (tenants, users, memberships, locations, posts, etc.)
- Set up indexes for performance
- Create updated_at triggers

### Step 2: Apply Row Level Security policies
Copy and paste the contents of `rls_policies.sql` into the SQL editor and run it. This will:
- Enable RLS on all tables
- Create helper functions for multi-tenant access control
- Set up policies to ensure users only see data they should have access to

### Step 3: Add seed data (optional)
Copy and paste the contents of `seed.sql` into the SQL editor and run it. This will:
- Create a demo tenant with sample locations
- Add sample posts for testing
- Set up user creation triggers
- Configure storage policies for file attachments

## Database Structure

### Core Tables
- **tenants**: Franchise brands/companies
- **users**: User profiles (synced with Supabase Auth)
- **memberships**: User-tenant relationships with roles
- **locations**: Individual franchise locations
- **location_memberships**: User-location access control
- **posts**: Communications/messages with targeting
- **comments**: Post comments
- **post_reactions**: Like/reaction system
- **attachments**: File uploads
- **notifications**: User notifications

### Multi-tenant Security
The database uses Row Level Security (RLS) to ensure:
- Users only see data for tenants they belong to
- Location-based targeting restricts access appropriately
- Role-based permissions control what users can do
- All queries are automatically filtered by the current user's access

### User Roles
- **tenant_admin**: Full access to tenant data and settings
- **tenant_staff**: Can create posts and manage content
- **franchise_owner**: Manages their specific locations
- **franchise_staff**: Limited access to assigned locations

## Testing the Setup

After running the SQL files, you can:

1. **Sign up a user** through your application's auth flow
2. **Create a membership** for the user in a tenant
3. **Test the RLS policies** by querying data as different users
4. **Upload files** to test storage policies

The seed data includes a demo tenant you can use for testing.
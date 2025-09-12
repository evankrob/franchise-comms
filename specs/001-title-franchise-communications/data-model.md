# Data Model: Franchise Communications Platform

**Phase**: 1 (Design & Contracts) | **Date**: 2025-09-11 | **Based on**: [spec.md](./spec.md) and [research.md](./research.md)

## Database Schema Architecture

### Multi-Tenant Foundation

```sql
-- Core tenant isolation
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    stripe_customer_id VARCHAR(255) UNIQUE,
    current_plan VARCHAR(50) DEFAULT 'starter',
    status VARCHAR(20) DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
```

### User Management & Memberships

```sql
-- Users (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant memberships with roles
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('tenant_admin', 'tenant_staff', 'franchise_owner', 'franchise_staff')),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

-- Location assignments for franchise roles
CREATE TABLE location_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('franchise_owner', 'franchise_staff')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, location_id)
);
```

### Location Management

```sql
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite index for tenant queries
CREATE INDEX idx_locations_tenant_status ON locations(tenant_id, status);
```

### Content & Messaging

```sql
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    body TEXT NOT NULL,
    body_rich JSONB, -- Rich text editor content
    post_type VARCHAR(50) DEFAULT 'message' CHECK (post_type IN ('message', 'announcement', 'request', 'performance_update')),
    targeting JSONB DEFAULT '{"type": "global"}', -- {type: "global"} or {type: "locations", location_ids: []}
    status VARCHAR(20) DEFAULT 'published',
    due_date TIMESTAMPTZ, -- For requests
    search_tsv TSVECTOR, -- Full-text search
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_posts_tenant_created ON posts(tenant_id, created_at DESC);
CREATE INDEX idx_posts_search ON posts USING GIN(search_tsv);
CREATE INDEX idx_posts_type ON posts(tenant_id, post_type);
CREATE INDEX idx_posts_due_date ON posts(due_date) WHERE due_date IS NOT NULL;

-- Comments with threading support
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    body_rich JSONB,
    search_tsv TSVECTOR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_post ON comments(post_id, created_at);
CREATE INDEX idx_comments_search ON comments USING GIN(search_tsv);
```

### File Attachments

```sql
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    uploader_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_path TEXT NOT NULL, -- Supabase storage path
    virus_scan_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (post_id IS NOT NULL OR comment_id IS NOT NULL)
);

CREATE INDEX idx_attachments_post ON attachments(post_id);
CREATE INDEX idx_attachments_comment ON attachments(comment_id);
```

### Request & Report System

```sql
-- Structured requests with custom fields
CREATE TABLE requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    fields JSONB NOT NULL DEFAULT '[]', -- Array of field definitions
    due_date TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report submissions per location
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    submitter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    field_data JSONB NOT NULL DEFAULT '{}', -- Submitted field values
    status VARCHAR(20) DEFAULT 'submitted',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewer_user_id UUID REFERENCES users(id),
    review_notes TEXT,
    UNIQUE(request_id, location_id)
);

CREATE INDEX idx_reports_request ON reports(request_id, status);
CREATE INDEX idx_reports_location ON reports(location_id, submitted_at DESC);
```

### Engagement & Tracking

```sql
-- Read receipts for accountability
CREATE TABLE read_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Reactions (like, acknowledge, needs_attention)
CREATE TABLE reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(50) NOT NULL CHECK (reaction_type IN ('like', 'acknowledge', 'needs_attention')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id, reaction_type),
    UNIQUE(comment_id, user_id, reaction_type),
    CHECK (post_id IS NOT NULL OR comment_id IS NOT NULL)
);
```

### Notifications

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}', -- Additional context data
    read BOOLEAN DEFAULT FALSE,
    delivered_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read, delivered_at DESC);
```

### Audit Logging

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
```

## Row Level Security Policies

### Helper Functions

```sql
-- Performance-optimized RLS helpers
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID
LANGUAGE SQL STABLE
AS $$ SELECT auth.uid(); $$;

CREATE OR REPLACE FUNCTION is_user_in_tenant(tenant_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships 
    WHERE user_id = current_user_id() 
    AND tenant_id = tenant_uuid 
    AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION user_location_ids(tenant_uuid UUID)
RETURNS UUID[]
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(ARRAY_AGG(location_id), ARRAY[]::UUID[])
  FROM location_memberships lm
  WHERE lm.user_id = current_user_id();
$$;

CREATE OR REPLACE FUNCTION can_access_post(post_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM posts p
    WHERE p.id = post_uuid
    AND is_user_in_tenant(p.tenant_id)
    AND (
      p.targeting->>'type' = 'global'
      OR (
        p.targeting->>'type' = 'locations'
        AND (p.targeting->'location_ids')::jsonb ?| 
            ARRAY(SELECT jsonb_array_elements_text(to_jsonb(user_location_ids(p.tenant_id))))
      )
    )
  );
$$;
```

### Core RLS Policies

```sql
-- Tenants: Users can only see their own tenants
CREATE POLICY "Users can view their tenants" ON tenants
  FOR SELECT USING (is_user_in_tenant(id));

-- Posts: Complex targeting-based access
CREATE POLICY "Users can view accessible posts" ON posts
  FOR SELECT USING (can_access_post(id));

CREATE POLICY "Tenant staff can create posts" ON posts
  FOR INSERT WITH CHECK (
    is_user_in_tenant(tenant_id) AND
    EXISTS (
      SELECT 1 FROM memberships
      WHERE user_id = current_user_id()
      AND tenant_id = posts.tenant_id
      AND role IN ('tenant_admin', 'tenant_staff')
    )
  );

-- Comments: Can access if can access the post
CREATE POLICY "Users can view comments on accessible posts" ON comments
  FOR SELECT USING (can_access_post(post_id));

CREATE POLICY "Users can create comments on accessible posts" ON comments
  FOR INSERT WITH CHECK (
    is_user_in_tenant(tenant_id) AND
    can_access_post(post_id)
  );

-- Reports: Franchise users can only see their location's reports
CREATE POLICY "Users can view location reports" ON reports
  FOR SELECT USING (
    is_user_in_tenant(tenant_id) AND (
      -- Corporate staff can see all reports
      EXISTS (
        SELECT 1 FROM memberships
        WHERE user_id = current_user_id()
        AND tenant_id = reports.tenant_id
        AND role IN ('tenant_admin', 'tenant_staff')
      )
      -- Franchise users can see their location's reports
      OR location_id = ANY(user_location_ids(tenant_id))
    )
  );
```

## Entity Relationships

### Core Relationships
- **Tenants** → **Locations** (1:many)
- **Tenants** → **Users** (many:many via memberships)
- **Users** → **Locations** (many:many via location_memberships)
- **Posts** → **Comments** (1:many, with threading)
- **Posts** → **Attachments** (1:many)
- **Posts** → **Requests** (1:1 optional)
- **Requests** → **Reports** (1:many, one per location)

### Targeting Logic
Posts use JSONB targeting field:
- `{"type": "global"}` - Visible to all users in tenant
- `{"type": "locations", "location_ids": ["uuid1", "uuid2"]}` - Visible to users at specified locations

### Data Flow Patterns
1. **Content Creation**: Corporate staff creates posts with targeting rules
2. **Content Consumption**: Franchise users see posts based on location assignments
3. **Engagement**: Users react, comment, and mark as read
4. **Reporting**: Structured data collection with due date tracking
5. **Audit**: All actions logged with full context

## Performance Optimizations

### Key Indexes
- Composite indexes on (tenant_id, created_at DESC) for feed queries
- GIN indexes for full-text search on posts and comments
- Partial indexes on due dates and unread notifications
- Unique constraints for business rules (one report per location per request)

### Caching Strategy
- RLS helper functions marked as STABLE for query plan caching
- Location membership arrays cached per user session
- Tenant settings cached in application layer

This data model supports all functional requirements while maintaining strong multi-tenant isolation and performance at scale.
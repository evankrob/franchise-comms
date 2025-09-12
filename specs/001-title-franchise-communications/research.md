# Phase 0 Research: Franchise Communications Platform

## Overview
Research findings for implementing a multi-tenant franchise communication platform using Next.js 14+ App Router, Supabase PostgreSQL with RLS, Stripe billing, and shadcn/ui components.

## Technical Decision Matrix

### Frontend Architecture

#### Decision: Next.js 14+ App Router + React Server Components
**Rationale**: 
- **Performance**: Server Components reduce client bundle size and improve initial page loads for complex feeds
- **SEO & Social**: Server-side rendering critical for shared links and search indexing
- **Developer Experience**: App Router provides better file-based routing and layout composition
- **Real-time Integration**: Works seamlessly with Supabase real-time subscriptions
- **Multi-tenant Routing**: Built-in middleware support for tenant-aware routing

**Key Patterns**:
- Server Actions for all mutations (posts, comments, file uploads)
- Server Components for data fetching with direct Supabase integration
- Client Components only for interactive UI elements
- Parallel routes for dashboard layouts and modals

**Alternatives Considered**:
- Remix: Excellent DX but smaller ecosystem and less Vercel integration
- Traditional Next.js Pages Router: Lacks modern patterns and performance benefits
- Pure client-side SPA: Poor SEO and initial load performance for enterprise users

### Database & Multi-Tenancy

#### Decision: Supabase PostgreSQL with Row Level Security (RLS)
**Rationale**:
- **Security**: Database-level tenant isolation prevents data leaks
- **Performance**: Native PostgreSQL performance with proper indexing
- **Developer Experience**: Type-safe client generation and real-time subscriptions
- **Compliance**: Built-in audit logging and access controls
- **Scalability**: Proven at enterprise scale with connection pooling

**Schema Architecture**:
```sql
-- Core tenant isolation pattern
tenants (id, name, stripe_customer_id, current_plan, status)

-- Users linked via memberships for flexible role assignment
users (id from auth.users, email, name, avatar_url)
memberships (user_id, tenant_id, role enum)
location_memberships (user_id, location_id, role enum)

-- Content with JSONB targeting for flexible location assignment
posts (tenant_id, author_user_id, targeting jsonb, search_tsv tsvector)
comments (tenant_id, post_id, author_user_id, body_rich, search_tsv)
```

**RLS Helper Functions**:
```sql
-- Performance-optimized helper functions
current_user_id() -> auth.uid()
is_user_in_tenant(tenant_id) -> EXISTS check in memberships
user_location_ids(tenant_id) -> cached location list
can_access_post(post_id) -> visibility check with targeting rules
```

**Alternatives Considered**:
- Separate databases per tenant: Complex backup/migration, higher costs
- Application-level filtering: Security risks, performance bottlenecks
- Single shared schema without RLS: Compliance and security concerns

### UI Component System

#### Decision: shadcn/ui + Tailwind CSS
**Rationale**:
- **Consistency**: Comprehensive design system with enterprise-grade components
- **Accessibility**: Built-in WCAG AA compliance and keyboard navigation
- **Customization**: Full control over component styling and behavior
- **TypeScript**: Excellent TypeScript support with proper prop typing
- **Community**: Large ecosystem and regular updates

**Component Selection**:
- **Forms**: Form, Input, Textarea, Select, Checkbox, RadioGroup
- **Data Display**: Table, Card, Badge, Avatar, Tooltip, Skeleton
- **Navigation**: Sheet, Dialog, DropdownMenu, Tabs, NavigationMenu
- **Feedback**: Toast, Alert, Progress, Spinner
- **Layout**: Container, Separator, AspectRatio, ScrollArea

**Alternatives Considered**:
- Material-UI: Heavier bundle size, less customization flexibility
- Chakra UI: Good DX but less enterprise-focused design
- Custom components: High maintenance overhead, accessibility concerns

### Authentication & Authorization

#### Decision: Supabase Auth with Multi-tenant Memberships
**Rationale**:
- **Security**: Industry-standard JWT tokens with configurable expiration
- **Flexibility**: Email/password + magic links for different user preferences
- **Integration**: Native RLS integration for database-level authorization
- **Enterprise Features**: SSO support available for future enterprise deals
- **Developer Experience**: Excellent TypeScript SDK and documentation

**Multi-tenant Pattern**:
```typescript
// User can belong to multiple tenants with different roles
type UserMembership = {
  user_id: string
  tenant_id: string
  role: 'tenant_admin' | 'tenant_staff' | 'franchise_owner' | 'franchise_staff'
  location_ids?: string[] // For franchise roles
}
```

**Alternatives Considered**:
- Auth0: Higher cost, complex multi-tenant setup
- NextAuth.js: Requires more custom implementation for multi-tenancy
- Custom auth: Security risks, compliance overhead

### File Storage & Management

#### Decision: Supabase Storage with RLS Buckets
**Rationale**:
- **Security**: Row-level security extends to file access
- **Performance**: CDN integration with signed URLs
- **Integration**: Seamless with database and authentication
- **Cost**: Competitive pricing with generous free tier
- **Developer Experience**: Simple API for uploads and downloads

**Storage Architecture**:
```typescript
// Bucket structure
attachments/ (private bucket with RLS)
├── {tenant_id}/
│   ├── posts/
│   │   └── {post_id}/
│   │       └── {file_id}.{ext}
│   └── comments/
│       └── {comment_id}/
│           └── {file_id}.{ext}

// RLS policy ensures users can only access files from their tenant
// and only files attached to posts/comments they can view
```

**Alternatives Considered**:
- AWS S3: Complex setup, requires separate IAM management
- Vercel Blob: Good integration but higher costs at scale
- Cloudinary: Excellent for images but limited for document types

### Billing & Subscription Management

#### Decision: Stripe with Location-Based Pricing
**Rationale**:
- **Flexibility**: Support for complex pricing models and usage-based billing
- **Enterprise Features**: Invoicing, tax handling, compliance support
- **Developer Experience**: Excellent APIs and webhook system
- **Global Support**: Multi-currency and local payment methods
- **Integration**: Well-documented patterns for SaaS applications

**Pricing Model**:
```typescript
type SubscriptionPlan = {
  id: string
  name: string
  base_price: number // Monthly price
  included_locations: number
  price_per_additional_location: number
  features: string[]
}

// Example plans
const PLANS = {
  STARTER: { base_price: 99, included_locations: 5, price_per_additional_location: 15 },
  GROWTH: { base_price: 299, included_locations: 25, price_per_additional_location: 10 },
  ENTERPRISE: { base_price: 799, included_locations: 100, price_per_additional_location: 5 }
}
```

**Alternatives Considered**:
- Paddle: Good for global compliance but less flexible pricing
- Chargebee: Excellent for complex billing but higher complexity
- Custom billing: Significant development overhead and compliance risks

### Search & Performance

#### Decision: PostgreSQL Full-Text Search with GIN Indexes
**Rationale**:
- **Performance**: Native database search avoids external dependencies
- **Cost**: No additional service costs or complexity
- **Integration**: Seamless with existing RLS policies and multi-tenancy
- **Flexibility**: Supports ranking, highlighting, and faceted search
- **Maintenance**: Single system to manage and optimize

**Search Implementation**:
```sql
-- Search index on posts and comments
CREATE INDEX idx_posts_search ON posts USING GIN(search_tsv);
CREATE INDEX idx_comments_search ON comments USING GIN(search_tsv);

-- Trigger to maintain search vectors
CREATE TRIGGER update_posts_search_tsv 
BEFORE INSERT OR UPDATE ON posts
FOR EACH ROW EXECUTE FUNCTION update_search_vector();
```

**Alternatives Considered**:
- Algolia: Excellent UX but high costs and data duplication
- Elasticsearch: Complex setup and maintenance overhead
- Typesense: Good middle ground but additional service dependency

## Performance & Scaling Strategy

### Database Optimization
- **Indexing Strategy**: Composite indexes on (tenant_id, created_at DESC) for feed queries
- **Connection Pooling**: Supabase built-in pooling with pgBouncer
- **Query Optimization**: Use of EXPLAIN ANALYZE for RLS policy performance
- **Caching**: Redis layer for frequently accessed tenant configurations

### Frontend Performance
- **Code Splitting**: Automatic with Next.js App Router and dynamic imports
- **Image Optimization**: Next.js Image component with Supabase Storage CDN
- **Bundle Analysis**: Regular monitoring with @next/bundle-analyzer
- **Critical CSS**: Inline critical styles with Tailwind CSS

### File Upload Strategy
- **Progressive Upload**: Chunked uploads for large files with resume capability
- **Client-side Validation**: Type and size validation before upload
- **Background Processing**: Virus scanning and thumbnail generation
- **CDN Integration**: Automatic CDN distribution via Supabase

## Security & Compliance

### Data Protection
- **Encryption**: TLS in transit, AES-256 at rest via Supabase
- **Access Controls**: Multi-layer security with RLS, application logic, and UI guards
- **Audit Logging**: Complete activity tracking for compliance requirements
- **Backup Strategy**: Automated daily backups with point-in-time recovery

### WCAG AA Compliance
- **Keyboard Navigation**: Full app navigable via keyboard
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **Color Contrast**: Minimum 4.5:1 contrast ratio throughout
- **Focus Management**: Visible focus indicators and logical tab order

## Development & Testing Strategy

### Testing Framework
- **Unit Tests**: Jest for utility functions and business logic
- **Integration Tests**: Supabase local development for RLS policy testing
- **E2E Tests**: Playwright for complete user workflows
- **Visual Testing**: Storybook for component development and testing

### Deployment Strategy
- **Infrastructure**: Vercel for frontend/API, Supabase for database/auth/storage
- **Environments**: Preview branches for each PR, production with blue-green deploys
- **Monitoring**: Vercel Analytics, Supabase logs, optional Sentry for error tracking
- **CI/CD**: GitHub Actions with automated testing and security scanning

## Risk Assessment & Mitigation

### Technical Risks
1. **RLS Performance**: Mitigation via query optimization and strategic indexing
2. **File Storage Costs**: Usage monitoring and automatic cleanup policies
3. **Webhook Reliability**: Idempotent handlers with retry logic
4. **Real-time Scale**: Connection limits monitoring and graceful degradation

### Business Risks
1. **Multi-tenant Complexity**: Comprehensive testing and gradual rollout
2. **Data Migration**: Robust backup and rollback procedures
3. **Compliance Changes**: Regular security audits and legal review
4. **Vendor Dependencies**: Evaluation of alternatives and exit strategies

## Next Steps
All technical decisions finalized and ready for Phase 1 (Design & Contracts):
- Detailed database schema design
- API contract specifications  
- Component architecture
- Integration test scenarios
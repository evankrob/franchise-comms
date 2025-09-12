# franchise-comms Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-09-11

## Active Technologies
- **Language**: TypeScript/JavaScript (Next.js 14+ App Router)
- **Database**: Supabase PostgreSQL with RLS + Supabase Storage
- **Frontend**: React Server Components, shadcn/ui, Tailwind CSS
- **Auth**: Supabase Auth with multi-tenant memberships
- **Billing**: Stripe with location-based pricing
- **Testing**: Jest, Playwright, Supabase test client
- **Deployment**: Vercel with GitHub PR previews

## Project Structure
```
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/
```

## Key Architecture Patterns
- **Multi-Tenant RLS**: Row Level Security with helper functions for tenant isolation
- **Server Components**: Use React Server Components for data fetching
- **Server Actions**: All mutations through Next.js Server Actions
- **Real-time**: Supabase real-time subscriptions for live updates
- **File Storage**: Supabase Storage with RLS policies for secure file access

## Database Schema Highlights
- `tenants` with complete data isolation via RLS
- `memberships` for role-based access control (tenant_admin, tenant_staff, franchise_owner, franchise_staff)
- `posts` with JSONB targeting for flexible location assignment
- `requests`/`reports` for structured data collection workflows
- Full-text search with GIN indexes on `search_tsv` columns

## Commands
```bash
# Development
npm run dev
npm run build
npm run test

# Database
npx supabase start
npx supabase db reset
```

## Code Style
- Use TypeScript strict mode
- Follow shadcn/ui component patterns
- Implement proper RLS policies for all tables
- Use Server Components by default, Client Components only for interactivity

## Recent Changes
- 001-title-franchise-communications: Added Next.js + Supabase multi-tenant platform with social feed messaging, file attachments, request/report workflows

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
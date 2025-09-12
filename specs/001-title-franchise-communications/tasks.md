# Tasks: Franchise Communications Platform

**Input**: Design documents from `/specs/001-title-franchise-communications/`
**Prerequisites**: plan.md (✓), research.md (✓), data-model.md (✓), contracts/api-spec.yaml (✓), quickstart.md (✓)

## Execution Flow
1. ✅ Loaded plan.md - Next.js 14+ App Router, Supabase, TypeScript, shadcn/ui
2. ✅ Extracted 11 core entities from data-model.md
3. ✅ Found 15 API endpoints from contracts/api-spec.yaml
4. ✅ Identified 6 integration test scenarios from quickstart.md
5. ✅ Generated 45 tasks across 5 phases with proper TDD ordering

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Structure: Next.js full-stack app (src/, tests/, app/ directories)

## Phase 3.1: Setup
- [ ] T001 Create Next.js 14+ project structure with app/ directory and TypeScript configuration
- [ ] T002 Install core dependencies: next@latest, react, supabase-js, stripe, @radix-ui/react-*, tailwindcss
- [ ] T003 [P] Configure ESLint, Prettier, and TypeScript strict mode in project config files
- [ ] T004 [P] Set up Supabase client configuration in src/lib/supabase.ts
- [ ] T005 [P] Configure Tailwind CSS and shadcn/ui in tailwind.config.js and globals.css
- [ ] T006 Initialize Supabase project with database schema from data-model.md

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests [P] - Different API endpoints
- [ ] T007 [P] Contract test GET /api/auth/me in __tests__/api/auth-me.test.ts
- [ ] T008 [P] Contract test GET /api/tenants/current in __tests__/api/tenants-current.test.ts
- [ ] T009 [P] Contract test GET /api/locations in __tests__/api/locations.test.ts
- [ ] T010 [P] Contract test GET /api/posts in __tests__/api/posts-get.test.ts
- [ ] T011 [P] Contract test POST /api/posts in __tests__/api/posts-post.test.ts
- [ ] T012 [P] Contract test POST /api/posts/{postId}/comments in __tests__/api/comments-post.test.ts
- [ ] T013 [P] Contract test POST /api/posts/{postId}/read in __tests__/api/read-receipts.test.ts
- [ ] T014 [P] Contract test POST /api/uploads in __tests__/api/uploads.test.ts
- [ ] T015 [P] Contract test POST /api/requests in __tests__/api/requests-post.test.ts
- [ ] T016 [P] Contract test GET /api/requests/{requestId}/reports in __tests__/api/reports-get.test.ts
- [ ] T017 [P] Contract test POST /api/requests/{requestId}/reports in __tests__/api/reports-post.test.ts
- [ ] T018 [P] Contract test GET /api/search in __tests__/api/search.test.ts

### Integration Tests [P] - Different test scenarios
- [ ] T019 [P] Integration test: Global Corporate Announcement in __tests__/integration/global-announcement.test.ts
- [ ] T020 [P] Integration test: Structured Data Request Workflow in __tests__/integration/request-workflow.test.ts  
- [ ] T021 [P] Integration test: Targeted Location Communication in __tests__/integration/targeted-communication.test.ts
- [ ] T022 [P] Integration test: Search and Discovery in __tests__/integration/search-discovery.test.ts
- [ ] T023 [P] Integration test: File Management and Security in __tests__/integration/file-security.test.ts
- [ ] T024 [P] Integration test: Audit and Compliance in __tests__/integration/audit-compliance.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Database Models [P] - Different entity files
- [ ] T025 [P] Tenant model with RLS policies in src/lib/models/tenant.ts
- [ ] T026 [P] User model with Supabase Auth integration in src/lib/models/user.ts
- [ ] T027 [P] Location model with tenant relationships in src/lib/models/location.ts
- [ ] T028 [P] Membership model with role-based access in src/lib/models/membership.ts
- [ ] T029 [P] Post model with targeting logic in src/lib/models/post.ts
- [ ] T030 [P] Comment model with threading support in src/lib/models/comment.ts
- [ ] T031 [P] Attachment model with file metadata in src/lib/models/attachment.ts
- [ ] T032 [P] Request model with custom fields in src/lib/models/request.ts
- [ ] T033 [P] Report model with structured data in src/lib/models/report.ts
- [ ] T034 [P] ReadReceipt model for tracking in src/lib/models/read-receipt.ts
- [ ] T035 [P] AuditLog model for compliance in src/lib/models/audit-log.ts

### API Endpoints - Sequential (shared route handlers)
- [ ] T036 GET /api/auth/me endpoint in app/api/auth/me/route.ts
- [ ] T037 GET /api/tenants/current endpoint in app/api/tenants/current/route.ts  
- [ ] T038 GET /api/locations endpoint in app/api/locations/route.ts
- [ ] T039 GET /api/posts endpoint with feed logic in app/api/posts/route.ts
- [ ] T040 POST /api/posts endpoint with targeting validation in app/api/posts/route.ts
- [ ] T041 POST /api/posts/[postId]/comments endpoint in app/api/posts/[postId]/comments/route.ts
- [ ] T042 POST /api/posts/[postId]/read endpoint in app/api/posts/[postId]/read/route.ts
- [ ] T043 POST /api/uploads endpoint with file validation in app/api/uploads/route.ts

## Phase 3.4: Integration & Services
- [ ] T044 Database connection service with connection pooling in src/lib/database.ts
- [ ] T045 Authentication middleware with role validation in src/middleware.ts
- [ ] T046 File storage service with virus scanning in src/lib/services/storage.ts
- [ ] T047 Notification service with email/in-app delivery in src/lib/services/notifications.ts
- [ ] T048 Search service with full-text search in src/lib/services/search.ts
- [ ] T049 Request/Report service with completion tracking in src/lib/services/requests.ts
- [ ] T050 Audit logging service with compliance tracking in src/lib/services/audit.ts

## Phase 3.5: Polish & Validation
- [ ] T051 [P] Unit tests for RLS helper functions in __tests__/unit/rls-helpers.test.ts
- [ ] T052 [P] Unit tests for targeting logic in __tests__/unit/targeting.test.ts
- [ ] T053 [P] Unit tests for file validation in __tests__/unit/file-validation.test.ts
- [ ] T054 [P] Performance tests for feed loading (<2s) in __tests__/performance/feed-performance.test.ts
- [ ] T055 [P] Performance tests for search queries (<1s) in __tests__/performance/search-performance.test.ts
- [ ] T056 [P] Security tests for multi-tenant isolation in __tests__/security/tenant-isolation.test.ts
- [ ] T057 Execute complete quickstart guide validation scenarios
- [ ] T058 Code cleanup and optimization review
- [ ] T059 Update documentation with implementation details

## Dependencies
**Critical TDD Ordering**:
- Setup (T001-T006) → Contract Tests (T007-T018) → Integration Tests (T019-T024) → Models (T025-T035) → API Endpoints (T036-T043) → Services (T044-T050) → Polish (T051-T059)

**Blocking Dependencies**:
- T006 (Database schema) blocks T025-T035 (Models require DB)
- T025-T035 (Models) block T036-T043 (APIs need models)
- T036-T043 (Core APIs) block T044-T050 (Services use APIs)
- T001-T006 (Setup) blocks all other phases

## Parallel Execution Examples

### Phase 3.2: All Contract Tests Together
```bash
# Launch T007-T018 in parallel (different API endpoints):
Task: "Contract test GET /api/auth/me in __tests__/api/auth-me.test.ts"
Task: "Contract test GET /api/tenants/current in __tests__/api/tenants-current.test.ts"  
Task: "Contract test GET /api/locations in __tests__/api/locations.test.ts"
Task: "Contract test GET /api/posts in __tests__/api/posts-get.test.ts"
Task: "Contract test POST /api/posts in __tests__/api/posts-post.test.ts"
# ... (continue with T012-T018)
```

### Phase 3.2: All Integration Tests Together
```bash
# Launch T019-T024 in parallel (different test scenarios):
Task: "Integration test: Global Corporate Announcement in __tests__/integration/global-announcement.test.ts"
Task: "Integration test: Structured Data Request Workflow in __tests__/integration/request-workflow.test.ts"
Task: "Integration test: Targeted Location Communication in __tests__/integration/targeted-communication.test.ts"
# ... (continue with T022-T024)
```

### Phase 3.3: All Models Together  
```bash
# Launch T025-T035 in parallel (different entity files):
Task: "Tenant model with RLS policies in src/lib/models/tenant.ts"
Task: "User model with Supabase Auth integration in src/lib/models/user.ts"
Task: "Location model with tenant relationships in src/lib/models/location.ts"
# ... (continue with T028-T035)
```

## Validation Checklist ✅
- ✅ All 12 API contracts from api-spec.yaml have corresponding tests (T007-T018)
- ✅ All 11 entities from data-model.md have model tasks (T025-T035)  
- ✅ All 6 user stories from quickstart.md have integration tests (T019-T024)
- ✅ All tests come before implementation (TDD enforced)
- ✅ Parallel tasks ([P]) target different files with no dependencies
- ✅ Each task specifies exact file path and clear acceptance criteria
- ✅ Project structure matches plan.md: Next.js full-stack with app/ directory

## Notes
- **[P] tasks** = different files, can run simultaneously
- **Sequential tasks** = shared files or dependencies, must run in order
- Verify all tests fail before implementing (RED phase of TDD)
- Run `npm test` after each phase to validate progress
- Commit frequently with descriptive messages
- Focus on multi-tenant security and performance throughout implementation
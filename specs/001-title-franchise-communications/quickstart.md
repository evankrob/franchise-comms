# Quickstart Guide: Franchise Communications Platform

**Purpose**: End-to-end integration test scenarios that validate the complete user workflows from the specification.

## Test Environment Setup

### Prerequisites
- Supabase project with test database
- Next.js development environment
- Test user accounts with different roles
- Sample tenant and location data

### Test Data Setup
```sql
-- Test tenant
INSERT INTO tenants (id, name, slug, current_plan, status) 
VALUES ('test-tenant-uuid', 'Test Franchise Corp', 'test-corp', 'growth', 'active');

-- Test locations
INSERT INTO locations (id, tenant_id, name, address, status) VALUES
  ('loc-1-uuid', 'test-tenant-uuid', 'Downtown Location', '123 Main St', 'active'),
  ('loc-2-uuid', 'test-tenant-uuid', 'Uptown Location', '456 Oak Ave', 'active'),
  ('loc-3-uuid', 'test-tenant-uuid', 'Mall Location', '789 Shopping Blvd', 'active');

-- Test users with memberships
INSERT INTO users (id, email, name) VALUES
  ('corp-admin-uuid', 'admin@testcorp.com', 'Corporate Admin'),
  ('corp-staff-uuid', 'staff@testcorp.com', 'Corporate Staff'),
  ('franchise1-owner-uuid', 'owner1@testcorp.com', 'Franchise Owner 1'),
  ('franchise1-staff-uuid', 'staff1@testcorp.com', 'Franchise Staff 1'),
  ('franchise2-owner-uuid', 'owner2@testcorp.com', 'Franchise Owner 2');

-- Memberships
INSERT INTO memberships (user_id, tenant_id, role) VALUES
  ('corp-admin-uuid', 'test-tenant-uuid', 'tenant_admin'),
  ('corp-staff-uuid', 'test-tenant-uuid', 'tenant_staff'),
  ('franchise1-owner-uuid', 'test-tenant-uuid', 'franchise_owner'),
  ('franchise1-staff-uuid', 'test-tenant-uuid', 'franchise_staff'),
  ('franchise2-owner-uuid', 'test-tenant-uuid', 'franchise_owner');

-- Location assignments
INSERT INTO location_memberships (user_id, location_id, role) VALUES
  ('franchise1-owner-uuid', 'loc-1-uuid', 'franchise_owner'),
  ('franchise1-staff-uuid', 'loc-1-uuid', 'franchise_staff'),
  ('franchise2-owner-uuid', 'loc-2-uuid', 'franchise_owner');
```

## Integration Test Scenarios

### Scenario 1: Global Corporate Announcement
**Story**: Corporate Staff broadcasts an important advertising update to all locations

**Test Steps**:
1. **Login as Corporate Staff** (`staff@testcorp.com`)
   - Verify access to dashboard and post creation interface
   - Confirm user role permissions display correctly

2. **Create Global Post**
   ```javascript
   POST /api/posts
   {
     "title": "Q4 Holiday Marketing Campaign Launch",
     "body": "New holiday promotions start December 1st. All materials attached.",
     "post_type": "announcement",
     "targeting": {"type": "global"}
   }
   ```
   - Verify post appears in corporate feed immediately
   - Confirm targeting is set to "global"

3. **Upload Marketing Materials**
   ```javascript
   POST /api/uploads
   FormData: {
     "file": marketing_materials.pdf,
     "post_id": "created-post-uuid"
   }
   ```
   - Verify file upload success and virus scan status
   - Confirm attachment links to post correctly

4. **Verify Franchise Visibility**
   - Login as Franchise Owner 1 (`owner1@testcorp.com`)
   - Confirm post appears in their feed
   - Verify attachment is downloadable
   - Login as Franchise Owner 2 (`owner2@testcorp.com`)
   - Confirm same visibility

5. **Track Read Receipts**
   ```javascript
   POST /api/posts/{postId}/read
   ```
   - Mark post as read from franchise accounts
   - Verify Corporate Staff can see read receipt status
   - Confirm timestamps are recorded correctly

**Expected Results**:
- Post visible to all franchise locations
- File attachments accessible by authorized users only
- Read receipts tracked per user with timestamps
- Corporate Staff can monitor engagement analytics

### Scenario 2: Structured Data Request Workflow
**Story**: Corporate needs Q3 financial reports from all locations with due date tracking

**Test Steps**:
1. **Create Request Post** (as Corporate Staff)
   ```javascript
   POST /api/posts
   {
     "title": "Q3 Financial Report Submission",
     "body": "Please submit your Q3 financial data by October 15th",
     "post_type": "request",
     "targeting": {"type": "global"},
     "due_date": "2025-10-15T17:00:00Z"
   }
   
   POST /api/requests
   {
     "post_id": "created-post-uuid",
     "title": "Q3 Financial Report",
     "description": "Quarterly financial performance data",
     "fields": [
       {"name": "total_revenue", "type": "number", "required": true},
       {"name": "total_expenses", "type": "number", "required": true},
       {"name": "customer_count", "type": "number", "required": true},
       {"name": "notes", "type": "text", "required": false},
       {"name": "supporting_docs", "type": "file", "required": false}
     ],
     "due_date": "2025-10-15T17:00:00Z"
   }
   ```

2. **Franchise Submission Process**
   - Login as Franchise Owner 1
   - Navigate to request from feed
   - Verify structured form displays with required fields
   ```javascript
   POST /api/requests/{requestId}/reports
   {
     "location_id": "loc-1-uuid",
     "field_data": {
       "total_revenue": 45000,
       "total_expenses": 38000,
       "customer_count": 1250,
       "notes": "Strong performance this quarter"
     },
     "status": "submitted"
   }
   ```

3. **File Attachment to Report**
   ```javascript
   POST /api/uploads
   FormData: {
     "file": financial_report.xlsx,
     "comment_id": "report-comment-uuid"
   }
   ```

4. **Track Completion Status**
   - Verify Corporate Staff sees completion dashboard
   - Confirm status shows: 1 submitted, 2 pending
   - Test due date notifications for pending locations

5. **Corporate Review Process**
   ```javascript
   PATCH /api/requests/{requestId}/reports/{reportId}
   {
     "status": "reviewed",
     "review_notes": "Report approved. Great numbers!",
     "reviewer_user_id": "corp-staff-uuid"
   }
   ```

**Expected Results**:
- Structured form creates properly from field definitions
- Data validation enforces required fields
- File attachments link to report submissions correctly
- Completion tracking shows accurate status per location
- Due date notifications trigger appropriately
- Corporate review workflow functions end-to-end

### Scenario 3: Targeted Location Communication
**Story**: Corporate provides specific feedback to one franchise location

**Test Steps**:
1. **Create Targeted Post** (as Corporate Staff)
   ```javascript
   POST /api/posts
   {
     "title": "Downtown Location: Performance Review",
     "body": "Excellent customer satisfaction scores this month!",
     "post_type": "performance_update",
     "targeting": {
       "type": "locations",
       "location_ids": ["loc-1-uuid"]
     }
   }
   ```

2. **Verify Access Control**
   - Login as Franchise Owner 1 (Downtown location)
   - Confirm post appears in feed
   - Login as Franchise Owner 2 (Uptown location)  
   - Verify post does NOT appear in their feed
   - Confirm RLS policies enforce proper isolation

3. **Franchise Response**
   ```javascript
   POST /api/posts/{postId}/comments
   {
     "body": "Thank you! Our team has been working hard on customer service training."
   }
   ```

4. **Corporate Acknowledgment**
   ```javascript
   POST /api/posts/{postId}/reactions
   {
     "type": "acknowledge",
     "action": "add"
   }
   ```

**Expected Results**:
- Targeting rules enforce proper visibility
- Only intended location users can see targeted content
- Comment threading works correctly
- Reaction system functions properly

### Scenario 4: Search and Discovery
**Story**: Users need to find previous communications and reports

**Test Steps**:
1. **Create Searchable Content**
   - Create multiple posts with different keywords
   - Add comments with searchable terms
   - Upload files with descriptive metadata

2. **Test Search Functionality**
   ```javascript
   GET /api/search?q=marketing&type=posts
   GET /api/search?q=financial&type=all&date_from=2025-01-01
   GET /api/search?q=customer%20service&location_ids=loc-1-uuid
   ```

3. **Verify Search Results**
   - Confirm full-text search finds relevant posts
   - Verify location filtering respects user permissions
   - Test date range filtering accuracy
   - Confirm search ranking by relevance and recency

**Expected Results**:
- Search finds relevant content across posts and comments
- Results respect user access permissions
- Filtering options work correctly
- Performance remains acceptable with larger datasets

### Scenario 5: File Management and Security
**Story**: Validate file upload security and access controls

**Test Steps**:
1. **Test File Upload Validation**
   ```javascript
   // Test valid file types
   POST /api/uploads (PDF, DOC, XLS, JPG, PNG)
   
   // Test file size limits
   POST /api/uploads (file > 25MB should fail)
   
   // Test invalid file types
   POST /api/uploads (EXE, SCR should fail)
   ```

2. **Test Access Controls**
   - Upload file attached to targeted post
   - Verify only authorized users can download
   - Test direct URL access without authentication (should fail)
   - Confirm audit logging captures file access

3. **Test Virus Scanning Placeholder**
   - Verify virus_scan_status field updates appropriately
   - Test file availability during scan process

**Expected Results**:
- File validation rejects oversized and invalid types
- Access controls prevent unauthorized downloads
- Audit logs capture all file operations
- Virus scanning workflow functions properly

### Scenario 6: Audit and Compliance
**Story**: Corporate Admin needs complete audit trail for compliance

**Test Steps**:
1. **Generate Audit Events**
   - Perform various user actions (posts, comments, file uploads, reads)
   - Complete request/report workflow
   - Make edits and deletions

2. **Review Audit Logs**
   ```javascript
   GET /api/audit-logs?date_from=2025-01-01&user_id=franchise1-owner-uuid
   GET /api/audit-logs?resource_type=post&action=create
   ```

3. **Verify Audit Completeness**
   - Confirm all user actions are logged with timestamps
   - Verify IP addresses and user agents are captured
   - Test old/new value tracking for updates
   - Confirm audit log access restrictions (admin only)

**Expected Results**:
- All user actions logged with complete context
- Audit queries perform efficiently with proper filtering
- Data retention policies honored
- Access restricted to authorized administrators

## Performance Validation

### Feed Loading Performance
- **Target**: <2 seconds for initial feed load
- **Test**: Load feed with 100+ posts across multiple locations
- **Measure**: Time to first contentful paint and full render

### Search Performance  
- **Target**: <1 second for search results
- **Test**: Search across 1000+ posts and comments
- **Measure**: Database query time and full response time

### Concurrent User Load
- **Target**: Handle 1000+ concurrent users per tenant
- **Test**: Simulate concurrent reads/writes across user roles
- **Measure**: Response times and error rates under load

## Security Validation

### Multi-Tenant Isolation
- Verify users cannot access other tenant data through any API endpoint
- Test for SQL injection vulnerabilities in search and filters
- Confirm RLS policies block unauthorized access attempts

### Authentication & Authorization
- Test JWT token validation and expiration handling
- Verify role-based access controls at API level
- Confirm file download authorization checks

### Data Validation
- Test input sanitization for rich text content
- Verify file upload security measures
- Confirm proper error handling without data leakage

This quickstart guide provides comprehensive integration tests that validate all functional requirements end-to-end, ensuring the platform works correctly for real-world franchise communication scenarios.
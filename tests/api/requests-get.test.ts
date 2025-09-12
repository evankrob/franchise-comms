/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

/**
 * Contract Test: GET /api/requests
 * 
 * This test validates the API contract for listing requests.
 * It must FAIL initially (TDD RED phase) since the endpoint doesn't exist yet.
 * 
 * API Contract from api-spec.yaml lines 664-691:
 * - Path: GET /requests
 * - Security: Bearer Auth required
 * - Query Parameters:
 *   - status: [active, closed] (optional)
 *   - role: [created, assigned] (optional) - Filter by user role context
 * - Response 200: Array of Request objects with id, title, fields, due_date, completion_stats
 * - Response 401: Unauthorized when no valid token
 * 
 * Business Logic:
 * - Returns requests based on user's context (corporate staff vs franchise location)
 * - Corporate staff see requests they created
 * - Franchise locations see requests assigned to them
 * - Filters by status (active/closed) and role context
 * - Must respect multi-tenant RLS policies
 */

// Mock Supabase for testing
jest.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: jest.fn(),
  getCurrentUser: jest.fn(),
}));

describe('Contract Test: GET /api/requests', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Required', () => {
    it('should return 401 when no authorization header provided', async () => {
      // Arrange: Create request without auth header
      const request = new NextRequest('http://localhost:3000/api/requests');

      // Act: Import and call the route handler
      // This will FAIL initially since the route doesn't exist yet (TDD RED phase)
      const { GET } = await import('@/app/api/requests/route');
      const response = await GET(request);

      // Assert: Should return 401 Unauthorized
      expect(response.status).toBe(401);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Unauthorized',
        message: expect.any(String),
      });
    });

    it('should return 401 when invalid Bearer token provided', async () => {
      // Arrange: Create request with invalid token
      const request = new NextRequest('http://localhost:3000/api/requests', {
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });

      // Mock Supabase to return auth error
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid JWT' },
      });

      // Act: Call the route handler
      const { GET } = await import('@/app/api/requests/route');
      const response = await GET(request);

      // Assert: Should return 401 Unauthorized
      expect(response.status).toBe(401);
    });
  });

  describe('Query Parameter Validation', () => {
    it('should return 400 for invalid status parameter', async () => {
      // Arrange: Create request with invalid status value
      const request = new NextRequest('http://localhost:3000/api/requests?status=invalid_status');

      // Mock successful authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Act
      const { GET } = await import('@/app/api/requests/route');
      const response = await GET(request);

      // Assert: Should return 400 Bad Request for invalid status enum
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('status'),
      });
    });

    it('should return 400 for invalid role parameter', async () => {
      // Arrange: Create request with invalid role value
      const request = new NextRequest('http://localhost:3000/api/requests?role=invalid_role');

      // Mock successful authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Act
      const { GET } = await import('@/app/api/requests/route');
      const response = await GET(request);

      // Assert: Should return 400 Bad Request for invalid role enum
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('role'),
      });
    });

    it('should accept valid status parameter values', async () => {
      // Arrange: Test both valid status values
      const validStatusValues = ['active', 'closed'];

      for (const status of validStatusValues) {
        const request = new NextRequest(`http://localhost:3000/api/requests?status=${status}`);

        // Mock successful authentication
        const { createSupabaseServerClient } = await import('@/lib/supabase-server');
        (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        // Mock empty requests response
        mockSupabaseClient.from.mockImplementation((table) => {
          if (table === 'requests') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnThis(),
                filter: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            };
          }
          return mockSupabaseClient;
        });

        // Act
        const { GET } = await import('@/app/api/requests/route');
        const response = await GET(request);

        // Assert: Should accept valid status values
        expect(response.status).toBe(200);
      }
    });

    it('should accept valid role parameter values', async () => {
      // Arrange: Test both valid role values
      const validRoleValues = ['created', 'assigned'];

      for (const role of validRoleValues) {
        const request = new NextRequest(`http://localhost:3000/api/requests?role=${role}`);

        // Mock successful authentication
        const { createSupabaseServerClient } = await import('@/lib/supabase-server');
        (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        // Mock empty requests response
        mockSupabaseClient.from.mockImplementation((table) => {
          if (table === 'requests') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnThis(),
                filter: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            };
          }
          return mockSupabaseClient;
        });

        // Act
        const { GET } = await import('@/app/api/requests/route');
        const response = await GET(request);

        // Assert: Should accept valid role values
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Successful Request Retrieval', () => {
    it('should return all requests without filters', async () => {
      // Arrange: Request without query parameters
      const request = new NextRequest('http://localhost:3000/api/requests');

      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'corporate@example.com',
        name: 'Corporate User',
      };

      const mockRequests = [
        {
          id: '789e0123-e89b-12d3-a456-426614174000',
          tenant_id: '456e7890-e89b-12d3-a456-426614174000',
          post_id: '987e6543-e89b-12d3-a456-426614174000',
          title: 'Monthly Sales Report',
          description: 'Please submit your monthly sales figures',
          fields: [
            {
              name: 'sales_amount',
              type: 'number',
              required: true,
            },
            {
              name: 'notes',
              type: 'text',
              required: false,
            },
          ],
          due_date: '2024-02-01T00:00:00.000Z',
          status: 'active',
          completion_stats: {
            total_locations: 10,
            submitted: 3,
            pending: 7,
            overdue: 0,
          },
        },
        {
          id: '111e2222-e89b-12d3-a456-426614174000',
          tenant_id: '456e7890-e89b-12d3-a456-426614174000',
          post_id: '333e4444-e89b-12d3-a456-426614174000',
          title: 'Inventory Audit',
          description: 'Annual inventory count required',
          fields: [
            {
              name: 'item_count',
              type: 'number',
              required: true,
            },
            {
              name: 'discrepancies',
              type: 'text',
              required: false,
            },
          ],
          due_date: '2024-01-15T00:00:00.000Z',
          status: 'closed',
          completion_stats: {
            total_locations: 10,
            submitted: 10,
            pending: 0,
            overdue: 0,
          },
        },
      ];

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'requests') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              filter: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: mockRequests,
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/requests/route');
      const response = await GET(request);

      // Assert: Should return all requests
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');
      
      const body = await response.json();
      expect(body).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
            tenant_id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
            post_id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
            title: expect.any(String),
            description: expect.any(String),
            fields: expect.any(Array),
            due_date: expect.any(String),
            status: expect.stringMatching(/^(active|closed)$/),
            completion_stats: expect.objectContaining({
              total_locations: expect.any(Number),
              submitted: expect.any(Number),
              pending: expect.any(Number),
              overdue: expect.any(Number),
            }),
          }),
        ]),
      });
      
      expect(body.data).toHaveLength(2);
    });

    it('should filter requests by active status', async () => {
      // Arrange: Request with status=active filter
      const request = new NextRequest('http://localhost:3000/api/requests?status=active');

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'corporate@example.com',
      };

      const mockActiveRequests = [
        {
          id: 'request-active-123',
          tenant_id: 'tenant-123',
          post_id: 'post-456',
          title: 'Active Request',
          description: 'This is an active request',
          fields: [],
          due_date: '2024-02-01T00:00:00.000Z',
          status: 'active',
          completion_stats: {
            total_locations: 5,
            submitted: 2,
            pending: 3,
            overdue: 0,
          },
        },
      ];

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      let filterCalled = false;
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'requests') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              filter: jest.fn().mockImplementation((filterStr) => {
                if (filterStr.includes('status.eq.active')) {
                  filterCalled = true;
                }
                return {
                  order: jest.fn().mockResolvedValue({
                    data: mockActiveRequests,
                    error: null,
                  }),
                };
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/requests/route');
      const response = await GET(request);

      // Assert: Should return only active requests
      expect(response.status).toBe(200);
      expect(filterCalled).toBe(true);
      
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe('active');
    });

    it('should filter requests by closed status', async () => {
      // Arrange: Request with status=closed filter
      const request = new NextRequest('http://localhost:3000/api/requests?status=closed');

      const mockUser = { id: 'user-123', email: 'corporate@example.com' };

      const mockClosedRequests = [
        {
          id: 'request-closed-123',
          tenant_id: 'tenant-123',
          post_id: 'post-456',
          title: 'Closed Request',
          status: 'closed',
          completion_stats: {
            total_locations: 5,
            submitted: 5,
            pending: 0,
            overdue: 0,
          },
        },
      ];

      // Mock successful operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      let closedFilterCalled = false;
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'requests') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              filter: jest.fn().mockImplementation((filterStr) => {
                if (filterStr.includes('status.eq.closed')) {
                  closedFilterCalled = true;
                }
                return {
                  order: jest.fn().mockResolvedValue({
                    data: mockClosedRequests,
                    error: null,
                  }),
                };
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/requests/route');
      const response = await GET(request);

      // Assert: Should return only closed requests
      expect(response.status).toBe(200);
      expect(closedFilterCalled).toBe(true);
      
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe('closed');
    });
  });

  describe('Role-based Request Filtering', () => {
    it('should filter requests by created role (corporate staff)', async () => {
      // Arrange: Corporate staff viewing requests they created
      const request = new NextRequest('http://localhost:3000/api/requests?role=created');

      const mockCorporateUser = {
        id: 'corporate-user-123',
        email: 'manager@corporate.com',
      };

      const mockCreatedRequests = [
        {
          id: 'request-created-by-user',
          tenant_id: 'tenant-123',
          post_id: 'post-456',
          title: 'Request Created by Corporate',
          fields: [],
          status: 'active',
          completion_stats: {
            total_locations: 8,
            submitted: 2,
            pending: 6,
            overdue: 0,
          },
        },
      ];

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockCorporateUser },
        error: null,
      });

      let createdRoleFilterCalled = false;
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'requests') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockImplementation((column, value) => {
                // For role=created, should filter by posts authored by user
                if (column === 'posts.author_user_id' && value === mockCorporateUser.id) {
                  createdRoleFilterCalled = true;
                }
                return {
                  filter: jest.fn().mockReturnThis(),
                  order: jest.fn().mockResolvedValue({
                    data: mockCreatedRequests,
                    error: null,
                  }),
                };
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/requests/route');
      const response = await GET(request);

      // Assert: Should return requests created by the user
      expect(response.status).toBe(200);
      expect(createdRoleFilterCalled).toBe(true);
      
      const body = await response.json();
      expect(body.data).toHaveLength(1);
    });

    it('should filter requests by assigned role (franchise locations)', async () => {
      // Arrange: Franchise location viewing requests assigned to them
      const request = new NextRequest('http://localhost:3000/api/requests?role=assigned');

      const mockFranchiseUser = {
        id: 'franchise-user-123',
        email: 'manager@franchise.com',
      };

      const mockAssignedRequests = [
        {
          id: 'request-assigned-to-location',
          tenant_id: 'tenant-123',
          post_id: 'post-789',
          title: 'Request Assigned to Location',
          fields: [],
          status: 'active',
          completion_stats: {
            total_locations: 3,
            submitted: 1,
            pending: 2,
            overdue: 0,
          },
        },
      ];

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockFranchiseUser },
        error: null,
      });

      let assignedRoleFilterCalled = false;
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'requests') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              filter: jest.fn().mockImplementation((filterStr) => {
                // For role=assigned, should filter by user's location memberships
                if (filterStr.includes('targeting') || filterStr.includes('location')) {
                  assignedRoleFilterCalled = true;
                }
                return {
                  order: jest.fn().mockResolvedValue({
                    data: mockAssignedRequests,
                    error: null,
                  }),
                };
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/requests/route');
      const response = await GET(request);

      // Assert: Should return requests assigned to user's location
      expect(response.status).toBe(200);
      expect(assignedRoleFilterCalled).toBe(true);
      
      const body = await response.json();
      expect(body.data).toHaveLength(1);
    });
  });

  describe('Request Fields and Completion Stats Validation', () => {
    it('should return requests with properly structured fields', async () => {
      // Arrange: Test various field types and structures
      const request = new NextRequest('http://localhost:3000/api/requests');

      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const mockRequestsWithComplexFields = [
        {
          id: 'request-complex-fields',
          tenant_id: 'tenant-123',
          post_id: 'post-456',
          title: 'Complex Fields Request',
          description: 'Request with various field types',
          fields: [
            {
              name: 'sales_number',
              type: 'number',
              required: true,
            },
            {
              name: 'completion_date',
              type: 'date',
              required: true,
            },
            {
              name: 'document_upload',
              type: 'file',
              required: false,
            },
            {
              name: 'priority_level',
              type: 'select',
              required: true,
              options: ['low', 'medium', 'high'],
            },
            {
              name: 'additional_notes',
              type: 'text',
              required: false,
            },
          ],
          due_date: '2024-03-01T00:00:00.000Z',
          status: 'active',
          completion_stats: {
            total_locations: 15,
            submitted: 8,
            pending: 5,
            overdue: 2,
          },
        },
      ];

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'requests') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              filter: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: mockRequestsWithComplexFields,
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/requests/route');
      const response = await GET(request);

      // Assert: Should return requests with properly structured fields
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      
      const request0 = body.data[0];
      expect(request0.fields).toHaveLength(5);
      
      // Validate field structures
      request0.fields.forEach((field: any) => {
        expect(field).toHaveProperty('name');
        expect(field).toHaveProperty('type');
        expect(field).toHaveProperty('required');
        expect(['text', 'number', 'date', 'file', 'select']).toContain(field.type);
        expect(typeof field.required).toBe('boolean');
        
        // Select fields should have options
        if (field.type === 'select') {
          expect(field).toHaveProperty('options');
          expect(Array.isArray(field.options)).toBe(true);
        }
      });
    });

    it('should return accurate completion statistics', async () => {
      // Arrange: Test completion statistics calculation
      const request = new NextRequest('http://localhost:3000/api/requests');

      const mockUser = { id: 'user-123', email: 'test@example.com' };

      const mockRequestsWithStats = [
        {
          id: 'request-with-stats',
          tenant_id: 'tenant-123',
          post_id: 'post-456',
          title: 'Stats Tracking Request',
          fields: [],
          status: 'active',
          completion_stats: {
            total_locations: 20,
            submitted: 12,
            pending: 6,
            overdue: 2,
          },
        },
      ];

      // Mock successful operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'requests') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              filter: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: mockRequestsWithStats,
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/requests/route');
      const response = await GET(request);

      // Assert: Should return accurate completion statistics
      expect(response.status).toBe(200);
      
      const body = await response.json();
      const stats = body.data[0].completion_stats;
      
      expect(stats.total_locations).toBe(20);
      expect(stats.submitted).toBe(12);
      expect(stats.pending).toBe(6);
      expect(stats.overdue).toBe(2);
      
      // Verify math adds up (submitted + pending + overdue should equal or be less than total)
      expect(stats.submitted + stats.pending + stats.overdue).toBeLessThanOrEqual(stats.total_locations);
    });
  });

  describe('Multi-tenant Security', () => {
    it('should only return requests from user\'s tenant', async () => {
      // Arrange: User should only see requests from their tenant
      const request = new NextRequest('http://localhost:3000/api/requests');

      const mockUser = {
        id: 'user-tenant-a',
        email: 'user@tenant-a.com',
      };

      const mockTenantRequests = [
        {
          id: 'request-tenant-a',
          tenant_id: 'tenant-a-123',
          post_id: 'post-456',
          title: 'Tenant A Request',
          fields: [],
          status: 'active',
        },
      ];

      // Mock authentication and RLS enforcement
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      let tenantFilterCalled = false;
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'requests') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockImplementation((column, value) => {
                if (column === 'tenant_id') {
                  tenantFilterCalled = true;
                }
                return {
                  filter: jest.fn().mockReturnThis(),
                  order: jest.fn().mockResolvedValue({
                    data: mockTenantRequests,
                    error: null,
                  }),
                };
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/requests/route');
      const response = await GET(request);

      // Assert: Should enforce tenant isolation
      expect(response.status).toBe(200);
      expect(tenantFilterCalled).toBe(true);
      
      const body = await response.json();
      body.data.forEach((req: any) => {
        expect(req.tenant_id).toBe('tenant-a-123');
      });
    });

    it('should respect RLS policies for request access', async () => {
      // Arrange: Test RLS policy enforcement
      const request = new NextRequest('http://localhost:3000/api/requests');

      const mockUser = {
        id: 'restricted-user-123',
        email: 'restricted@example.com',
      };

      // Mock authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock RLS allowing only specific requests
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'requests') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              filter: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: [], // RLS returns empty due to user restrictions
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/requests/route');
      const response = await GET(request);

      // Assert: RLS should be enforced
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body.data).toHaveLength(0); // No access due to RLS
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database query errors gracefully', async () => {
      // Arrange: Mock database error
      const request = new NextRequest('http://localhost:3000/api/requests');

      const mockUser = { id: 'user-123', email: 'test@example.com' };

      // Mock authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock database error
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'requests') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              filter: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database connection failed' },
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/requests/route');
      const response = await GET(request);

      // Assert: Should return 500 Internal Server Error
      expect(response.status).toBe(500);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Internal Server Error',
        message: expect.any(String),
      });
    });

    it('should return empty array when no requests exist', async () => {
      // Arrange: No requests in database
      const request = new NextRequest('http://localhost:3000/api/requests');

      const mockUser = { id: 'user-123', email: 'test@example.com' };

      // Mock authentication and empty response
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'requests') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              filter: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/requests/route');
      const response = await GET(request);

      // Assert: Should return empty array
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body).toMatchObject({
        data: [],
      });
    });
  });

  describe('API Contract Validation', () => {
    it('should return response matching OpenAPI schema exactly', async () => {
      // This test ensures the response exactly matches the API contract
      const request = new NextRequest('http://localhost:3000/api/requests');

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'contract@example.com',
        name: 'Contract User',
      };

      const mockRequests = [
        {
          id: '789e0123-e89b-12d3-a456-426614174000',
          tenant_id: '456e7890-e89b-12d3-a456-426614174000',
          post_id: '987e6543-e89b-12d3-a456-426614174000',
          title: 'Contract Validation Request',
          description: 'Test request for API contract validation',
          fields: [
            {
              name: 'test_field',
              type: 'text',
              required: true,
            },
          ],
          due_date: '2024-02-15T00:00:00.000Z',
          status: 'active',
          completion_stats: {
            total_locations: 5,
            submitted: 2,
            pending: 3,
            overdue: 0,
          },
        },
      ];

      // Mock successful response
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'requests') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              filter: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: mockRequests,
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/requests/route');
      const response = await GET(request);

      // Assert: Response structure matches OpenAPI schema exactly
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');
      
      const body = await response.json();
      
      // Should have data array
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
      
      if (body.data.length > 0) {
        const request0 = body.data[0];
        
        // Required fields from API spec (lines 222-272)
        expect(request0).toHaveProperty('id');
        expect(request0).toHaveProperty('tenant_id');
        expect(request0).toHaveProperty('post_id');
        expect(request0).toHaveProperty('title');
        expect(request0).toHaveProperty('fields');
        
        // Optional fields from API spec
        expect(request0).toHaveProperty('description');
        expect(request0).toHaveProperty('due_date');
        expect(request0).toHaveProperty('status');
        expect(request0).toHaveProperty('completion_stats');
        
        // Validate data types and formats
        expect(typeof request0.id).toBe('string');
        expect(request0.id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
        expect(typeof request0.tenant_id).toBe('string');
        expect(request0.tenant_id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
        expect(typeof request0.post_id).toBe('string');
        expect(request0.post_id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
        expect(typeof request0.title).toBe('string');
        expect(Array.isArray(request0.fields)).toBe(true);
        
        // Validate status enum
        expect(['active', 'closed']).toContain(request0.status);
        
        // Validate completion_stats structure
        expect(request0.completion_stats).toMatchObject({
          total_locations: expect.any(Number),
          submitted: expect.any(Number),
          pending: expect.any(Number),
          overdue: expect.any(Number),
        });
        
        // Validate fields array structure
        request0.fields.forEach((field: any) => {
          expect(field).toMatchObject({
            name: expect.any(String),
            type: expect.any(String),
            required: expect.any(Boolean),
          });
          expect(['text', 'number', 'date', 'file', 'select']).toContain(field.type);
        });
      }
      
      // No unexpected top-level fields should be present
      const expectedKeys = ['data'];
      const actualKeys = Object.keys(body);
      actualKeys.forEach(key => {
        expect(expectedKeys).toContain(key);
      });
    });
  });
});
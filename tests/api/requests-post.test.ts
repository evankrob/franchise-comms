/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

/**
 * Contract Test: POST /api/requests
 * 
 * This test validates the API contract for creating new requests.
 * It must FAIL initially (TDD RED phase) since the endpoint doesn't exist yet.
 * 
 * API Contract from api-spec.yaml lines 693-724:
 * - Path: POST /requests
 * - Security: Bearer Auth required
 * - Note: Corporate staff only (business logic restriction)
 * - Required Request Fields: post_id, title, fields
 * - Optional Fields: description, due_date
 * - Response 201: Request object with id, title, fields, completion_stats, etc.
 * - Response 400: Invalid request (missing fields, invalid UUIDs, malformed fields)
 * - Response 401: Unauthorized when no valid token
 * - Response 403: Forbidden when user is not corporate staff
 * - Response 404: Post not found or user cannot access post
 * 
 * Business Logic:
 * - Only corporate staff can create requests
 * - Request must be linked to an existing post
 * - Fields must be properly structured with valid types
 * - Automatically sets tenant_id from user membership
 * - Initializes completion_stats based on targeting
 * - Must respect multi-tenant RLS policies
 */

// Mock Supabase for testing
jest.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: jest.fn(),
  getCurrentUser: jest.fn(),
}));

describe('Contract Test: POST /api/requests', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    rpc: jest.fn(),
  };

  const validPostId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Required', () => {
    it('should return 401 when no authorization header provided', async () => {
      // Arrange: Create request without auth header
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: validPostId,
          title: 'Test Request',
          fields: [],
        }),
      });

      // Act: Import and call the route handler
      // This will FAIL initially since the route doesn't exist yet (TDD RED phase)
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

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
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: validPostId,
          title: 'Test Request',
          fields: [],
        }),
      });

      // Mock Supabase to return auth error
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid JWT' },
      });

      // Act: Call the route handler
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should return 401 Unauthorized
      expect(response.status).toBe(401);
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when required post_id field is missing', async () => {
      // Arrange: Create request without required post_id field
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing required 'post_id' field
          title: 'Test Request',
          fields: [],
        }),
      });

      // Mock successful authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'corporate-user-123' } },
        error: null,
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should return 400 Bad Request
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('post_id'),
      });
    });

    it('should return 400 when required title field is missing', async () => {
      // Arrange: Create request without required title field
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: validPostId,
          // Missing required 'title' field
          fields: [],
        }),
      });

      // Mock successful authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'corporate-user-123' } },
        error: null,
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should return 400 Bad Request
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('title'),
      });
    });

    it('should return 400 when required fields array is missing', async () => {
      // Arrange: Create request without required fields array
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: validPostId,
          title: 'Test Request',
          // Missing required 'fields' array
        }),
      });

      // Mock successful authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'corporate-user-123' } },
        error: null,
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should return 400 Bad Request
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('fields'),
      });
    });

    it('should return 400 for invalid post_id UUID format', async () => {
      // Arrange: Create request with invalid post_id format
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: 'invalid-uuid-format', // Invalid UUID
          title: 'Test Request',
          fields: [],
        }),
      });

      // Mock successful authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'corporate-user-123' } },
        error: null,
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should return 400 Bad Request for invalid UUID format
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('post_id'),
      });
    });

    it('should return 400 for malformed fields array', async () => {
      // Arrange: Create request with malformed fields
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: validPostId,
          title: 'Test Request',
          fields: [
            {
              // Missing required 'name' field
              type: 'text',
              required: true,
            },
            {
              name: 'valid_field',
              type: 'invalid_type', // Invalid field type
              required: true,
            },
            {
              name: 'another_field',
              type: 'text',
              // Missing required 'required' field
            },
          ],
        }),
      });

      // Mock successful authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'corporate-user-123' } },
        error: null,
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should return 400 Bad Request for malformed fields
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('field'),
      });
    });

    it('should return 400 for invalid due_date format', async () => {
      // Arrange: Create request with invalid due_date format
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: validPostId,
          title: 'Test Request',
          fields: [],
          due_date: 'invalid-date-format', // Invalid date
        }),
      });

      // Mock successful authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'corporate-user-123' } },
        error: null,
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should return 400 Bad Request for invalid date format
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('due_date'),
      });
    });
  });

  describe('Corporate Staff Authorization', () => {
    it('should return 403 when user is not corporate staff', async () => {
      // Arrange: Mock franchise location user (non-corporate staff)
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: validPostId,
          title: 'Franchise Request Attempt',
          fields: [],
        }),
      });

      const mockFranchiseUser = {
        id: 'franchise-user-123',
        email: 'manager@franchise-location.com',
      };

      // Mock authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockFranchiseUser },
        error: null,
      });

      // Mock user role check - franchise staff (not corporate)
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { 
                      role: 'location_manager', // Non-corporate role
                      tenant: { id: 'tenant-123' }
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should return 403 Forbidden
      expect(response.status).toBe(403);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Forbidden',
        message: expect.stringContaining('corporate'),
      });
    });

    it('should allow corporate staff to create requests', async () => {
      // This test validates corporate staff can proceed past authorization
      // It may fail on post validation or other steps, but should pass auth check
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: validPostId,
          title: 'Corporate Request',
          fields: [],
        }),
      });

      const mockCorporateUser = {
        id: 'corporate-user-123',
        email: 'manager@corporate.com',
      };

      // Mock authentication and corporate role check
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockCorporateUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { 
                      role: 'corporate_admin', // Corporate role
                      tenant: { id: 'tenant-123' }
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should NOT return 403 (may fail on other validation, but not auth)
      expect(response.status).not.toBe(403);
    });
  });

  describe('Post Access Validation', () => {
    it('should return 404 when post does not exist', async () => {
      // Arrange: Mock post not found
      const nonExistentPostId = '550e8400-e29b-41d4-a716-446655440099';
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: nonExistentPostId,
          title: 'Request for Non-existent Post',
          fields: [],
        }),
      });

      const mockCorporateUser = {
        id: 'corporate-user-123',
        email: 'corporate@example.com',
      };

      // Mock authentication and corporate role
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockCorporateUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { 
                      role: 'corporate_admin',
                      tenant: { id: 'tenant-123' }
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'posts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116', message: 'Row not found' },
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should return 404 Not Found
      expect(response.status).toBe(404);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Not Found',
        message: expect.stringContaining('post'),
      });
    });

    it('should return 403 when user cannot access post due to RLS', async () => {
      // Arrange: Mock post exists but user has no access due to RLS
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: validPostId,
          title: 'Request for Restricted Post',
          fields: [],
        }),
      });

      const mockCorporateUser = {
        id: 'corporate-user-different-tenant',
        email: 'corporate@different-tenant.com',
      };

      // Mock authentication and corporate role
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockCorporateUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { 
                      role: 'corporate_admin',
                      tenant: { id: 'different-tenant-123' }
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'posts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null, // RLS blocked access
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should return 403 Forbidden (or 404 to not leak existence)
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Successful Request Creation', () => {
    it('should create request with minimal required fields', async () => {
      // Arrange: Valid request with only required fields
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: validPostId,
          title: 'Minimal Sales Report Request',
          fields: [
            {
              name: 'monthly_sales',
              type: 'number',
              required: true,
            },
          ],
        }),
      });

      const mockCorporateUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'corporate@example.com',
        name: 'Corporate Manager',
      };

      const mockPost = {
        id: validPostId,
        tenant_id: '456e7890-e89b-12d3-a456-426614174000',
        author_user_id: mockCorporateUser.id,
        title: 'Sales Report Request Post',
        body: 'Please complete the monthly sales report',
        targeting: {
          type: 'locations',
          location_ids: ['loc1', 'loc2', 'loc3'],
        },
      };

      const mockRequest = {
        id: '789e0123-e89b-12d3-a456-426614174000',
        tenant_id: '456e7890-e89b-12d3-a456-426614174000',
        post_id: validPostId,
        title: 'Minimal Sales Report Request',
        description: null,
        fields: [
          {
            name: 'monthly_sales',
            type: 'number',
            required: true,
          },
        ],
        due_date: null,
        status: 'active',
        completion_stats: {
          total_locations: 3,
          submitted: 0,
          pending: 3,
          overdue: 0,
        },
      };

      // Mock authentication, role, and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockCorporateUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { 
                      role: 'corporate_admin',
                      tenant: { id: '456e7890-e89b-12d3-a456-426614174000' }
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'posts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockPost,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'requests') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [mockRequest],
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should return 201 with request data
      expect(response.status).toBe(201);
      expect(response.headers.get('content-type')).toBe('application/json');
      
      const body = await response.json();
      expect(body).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        tenant_id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        post_id: validPostId,
        title: 'Minimal Sales Report Request',
        description: null,
        fields: [
          {
            name: 'monthly_sales',
            type: 'number',
            required: true,
          },
        ],
        due_date: null,
        status: 'active',
        completion_stats: expect.objectContaining({
          total_locations: expect.any(Number),
          submitted: 0,
          pending: expect.any(Number),
          overdue: 0,
        }),
      });
    });

    it('should create request with all optional fields', async () => {
      // Arrange: Valid request with all fields
      const dueDate = '2024-03-01T00:00:00.000Z';
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: validPostId,
          title: 'Comprehensive Inventory Audit',
          description: 'Complete inventory audit with detailed reporting requirements',
          fields: [
            {
              name: 'item_count',
              type: 'number',
              required: true,
            },
            {
              name: 'audit_date',
              type: 'date',
              required: true,
            },
            {
              name: 'discrepancy_report',
              type: 'file',
              required: false,
            },
            {
              name: 'priority',
              type: 'select',
              required: true,
              options: ['low', 'medium', 'high'],
            },
            {
              name: 'notes',
              type: 'text',
              required: false,
            },
          ],
          due_date: dueDate,
        }),
      });

      const mockCorporateUser = {
        id: 'corporate-user-456',
        email: 'operations@corporate.com',
      };

      const mockPost = {
        id: validPostId,
        tenant_id: 'tenant-456',
        author_user_id: mockCorporateUser.id,
        targeting: { type: 'global' },
      };

      const mockComprehensiveRequest = {
        id: 'request-comprehensive',
        tenant_id: 'tenant-456',
        post_id: validPostId,
        title: 'Comprehensive Inventory Audit',
        description: 'Complete inventory audit with detailed reporting requirements',
        fields: [
          { name: 'item_count', type: 'number', required: true },
          { name: 'audit_date', type: 'date', required: true },
          { name: 'discrepancy_report', type: 'file', required: false },
          { name: 'priority', type: 'select', required: true, options: ['low', 'medium', 'high'] },
          { name: 'notes', type: 'text', required: false },
        ],
        due_date: dueDate,
        status: 'active',
        completion_stats: {
          total_locations: 15, // Global targeting
          submitted: 0,
          pending: 15,
          overdue: 0,
        },
      };

      // Mock successful operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockCorporateUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { role: 'corporate_admin', tenant: { id: 'tenant-456' } },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'posts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockPost,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'requests') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [mockComprehensiveRequest],
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should return 201 with comprehensive request data
      expect(response.status).toBe(201);
      
      const body = await response.json();
      expect(body).toMatchObject({
        id: expect.any(String),
        tenant_id: 'tenant-456',
        post_id: validPostId,
        title: 'Comprehensive Inventory Audit',
        description: 'Complete inventory audit with detailed reporting requirements',
        fields: expect.arrayContaining([
          expect.objectContaining({ name: 'item_count', type: 'number', required: true }),
          expect.objectContaining({ name: 'audit_date', type: 'date', required: true }),
          expect.objectContaining({ name: 'discrepancy_report', type: 'file', required: false }),
          expect.objectContaining({ name: 'priority', type: 'select', required: true, options: ['low', 'medium', 'high'] }),
          expect.objectContaining({ name: 'notes', type: 'text', required: false }),
        ]),
        due_date: dueDate,
        status: 'active',
        completion_stats: expect.objectContaining({
          total_locations: 15,
          submitted: 0,
          pending: 15,
          overdue: 0,
        }),
      });
    });

    it('should support all valid field types', async () => {
      // Arrange: Test all supported field types
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: validPostId,
          title: 'Field Types Test Request',
          fields: [
            { name: 'text_field', type: 'text', required: true },
            { name: 'number_field', type: 'number', required: true },
            { name: 'date_field', type: 'date', required: false },
            { name: 'file_field', type: 'file', required: false },
            { name: 'select_field', type: 'select', required: true, options: ['option1', 'option2'] },
          ],
        }),
      });

      const mockUser = { id: 'corporate-user', email: 'test@corporate.com' };
      const mockPost = { id: validPostId, tenant_id: 'tenant-123', targeting: { type: 'global' } };

      // Mock successful operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { role: 'corporate_admin', tenant: { id: 'tenant-123' } },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'posts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockPost,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'requests') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [{
                  id: 'field-types-request',
                  title: 'Field Types Test Request',
                  fields: [
                    { name: 'text_field', type: 'text', required: true },
                    { name: 'number_field', type: 'number', required: true },
                    { name: 'date_field', type: 'date', required: false },
                    { name: 'file_field', type: 'file', required: false },
                    { name: 'select_field', type: 'select', required: true, options: ['option1', 'option2'] },
                  ],
                  status: 'active',
                }],
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should accept all valid field types
      expect(response.status).toBe(201);
      
      const body = await response.json();
      body.fields.forEach((field: any) => {
        expect(['text', 'number', 'date', 'file', 'select']).toContain(field.type);
        if (field.type === 'select') {
          expect(Array.isArray(field.options)).toBe(true);
          expect(field.options.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Multi-tenant Security and Completion Stats', () => {
    it('should automatically set tenant_id from user membership', async () => {
      // Arrange: Create request and verify tenant_id is set correctly
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: validPostId,
          title: 'Tenant ID Test Request',
          fields: [],
        }),
      });

      const mockUser = { id: 'corporate-user', email: 'test@corporate.com' };
      const expectedTenantId = 'tenant-123e4567-e89b-12d3-a456-426614174000';
      
      const mockPost = {
        id: validPostId,
        tenant_id: expectedTenantId,
        author_user_id: mockUser.id,
        targeting: { type: 'global' },
      };

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      let insertedData: any = null;
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { role: 'corporate_admin', tenant: { id: expectedTenantId } },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'posts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockPost,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'requests') {
          return {
            insert: jest.fn().mockImplementation((data) => {
              insertedData = data;
              return {
                select: jest.fn().mockResolvedValue({
                  data: [{ ...data, id: 'request-123' }],
                  error: null,
                }),
              };
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should set correct tenant_id
      expect(response.status).toBe(201);
      expect(insertedData).toMatchObject({
        tenant_id: expectedTenantId,
        post_id: validPostId,
        title: 'Tenant ID Test Request',
      });
    });

    it('should initialize completion stats based on post targeting', async () => {
      // Arrange: Test completion stats calculation for location targeting
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: validPostId,
          title: 'Location Targeting Test',
          fields: [],
        }),
      });

      const mockUser = { id: 'corporate-user', email: 'test@corporate.com' };
      
      const mockPost = {
        id: validPostId,
        tenant_id: 'tenant-123',
        author_user_id: mockUser.id,
        targeting: {
          type: 'locations',
          location_ids: ['loc1', 'loc2', 'loc3', 'loc4', 'loc5'],
        },
      };

      // Mock successful operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { role: 'corporate_admin', tenant: { id: 'tenant-123' } },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'posts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockPost,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'requests') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [{
                  id: 'request-stats-test',
                  title: 'Location Targeting Test',
                  completion_stats: {
                    total_locations: 5, // Based on targeting location_ids length
                    submitted: 0,
                    pending: 5,
                    overdue: 0,
                  },
                }],
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should initialize stats based on targeting
      expect(response.status).toBe(201);
      
      const body = await response.json();
      expect(body.completion_stats).toMatchObject({
        total_locations: 5,
        submitted: 0,
        pending: 5,
        overdue: 0,
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database insertion errors gracefully', async () => {
      // Arrange: Mock database error during request creation
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: validPostId,
          title: 'Database Error Test',
          fields: [],
        }),
      });

      const mockUser = { id: 'corporate-user', email: 'test@corporate.com' };
      const mockPost = { id: validPostId, tenant_id: 'tenant-123' };

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { role: 'corporate_admin', tenant: { id: 'tenant-123' } },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'posts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockPost,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'requests') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database constraint violation' },
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should return 500 Internal Server Error
      expect(response.status).toBe(500);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Internal Server Error',
        message: expect.any(String),
      });
    });

    it('should handle malformed JSON request body', async () => {
      // Arrange: Request with malformed JSON
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: '{ invalid json syntax',
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Should return 400 Bad Request for malformed JSON
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('JSON'),
      });
    });
  });

  describe('API Contract Validation', () => {
    it('should return response matching OpenAPI Request schema exactly', async () => {
      // This test ensures the response exactly matches the API contract
      const request = new NextRequest('http://localhost:3000/api/requests', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: validPostId,
          title: 'Contract Validation Request',
          description: 'Test request for API contract validation',
          fields: [
            {
              name: 'contract_field',
              type: 'text',
              required: true,
            },
          ],
          due_date: '2024-04-01T00:00:00.000Z',
        }),
      });

      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'contract@corporate.com',
      };

      const mockPost = {
        id: validPostId,
        tenant_id: '456e7890-e89b-12d3-a456-426614174000',
        author_user_id: mockUser.id,
        targeting: { type: 'global' },
      };

      const mockRequest = {
        id: '789e0123-e89b-12d3-a456-426614174000',
        tenant_id: '456e7890-e89b-12d3-a456-426614174000',
        post_id: validPostId,
        title: 'Contract Validation Request',
        description: 'Test request for API contract validation',
        fields: [
          {
            name: 'contract_field',
            type: 'text',
            required: true,
          },
        ],
        due_date: '2024-04-01T00:00:00.000Z',
        status: 'active',
        completion_stats: {
          total_locations: 10,
          submitted: 0,
          pending: 10,
          overdue: 0,
        },
      };

      // Mock successful response
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { role: 'corporate_admin', tenant: { id: '456e7890-e89b-12d3-a456-426614174000' } },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'posts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockPost,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'requests') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [mockRequest],
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/requests/route');
      const response = await POST(request);

      // Assert: Response structure matches OpenAPI Request schema exactly
      expect(response.status).toBe(201);
      expect(response.headers.get('content-type')).toBe('application/json');
      
      const body = await response.json();
      
      // Required fields from API spec (lines 222-272)
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('tenant_id');
      expect(body).toHaveProperty('post_id');
      expect(body).toHaveProperty('title');
      expect(body).toHaveProperty('fields');
      
      // Optional fields from API spec
      expect(body).toHaveProperty('description');
      expect(body).toHaveProperty('due_date');
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('completion_stats');
      
      // Validate data types and formats
      expect(typeof body.id).toBe('string');
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
      expect(typeof body.tenant_id).toBe('string');
      expect(body.tenant_id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
      expect(typeof body.post_id).toBe('string');
      expect(body.post_id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
      expect(typeof body.title).toBe('string');
      expect(Array.isArray(body.fields)).toBe(true);
      
      // Validate status enum
      expect(['active', 'closed']).toContain(body.status);
      
      // Validate completion_stats structure
      expect(body.completion_stats).toMatchObject({
        total_locations: expect.any(Number),
        submitted: expect.any(Number),
        pending: expect.any(Number),
        overdue: expect.any(Number),
      });
      
      // Validate fields array structure
      body.fields.forEach((field: any) => {
        expect(field).toMatchObject({
          name: expect.any(String),
          type: expect.any(String),
          required: expect.any(Boolean),
        });
        expect(['text', 'number', 'date', 'file', 'select']).toContain(field.type);
        
        if (field.type === 'select') {
          expect(field).toHaveProperty('options');
          expect(Array.isArray(field.options)).toBe(true);
        }
      });
      
      // Validate date format if present
      if (body.due_date) {
        expect(body.due_date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
      
      // No unexpected fields should be present
      const expectedKeys = [
        'id', 'tenant_id', 'post_id', 'title', 'description', 
        'fields', 'due_date', 'status', 'completion_stats'
      ];
      const actualKeys = Object.keys(body);
      actualKeys.forEach(key => {
        expect(expectedKeys).toContain(key);
      });
    });
  });
});
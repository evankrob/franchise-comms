/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

/**
 * Contract Test: POST /api/posts/{postId}/read
 * 
 * This test validates the API contract for marking posts as read.
 * It must FAIL initially (TDD RED phase) since the endpoint doesn't exist yet.
 * 
 * API Contract from api-spec.yaml lines 572-585:
 * - Path: POST /posts/{postId}/read
 * - Security: Bearer Auth required
 * - Path Parameter: postId (UUID format)
 * - No request body required
 * - Response 200: Post marked as read (no specific response body defined)
 * - Response 401: Unauthorized when no valid token
 * - Response 404: Post not found or user cannot access post
 * 
 * Business Logic:
 * - Creates or updates read receipt for user+post combination
 * - Tracks timestamp when post was marked as read
 * - Idempotent operation (multiple calls should not error)
 * - Must respect multi-tenant RLS policies
 */

// Mock Supabase for testing
jest.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: jest.fn(),
  getCurrentUser: jest.fn(),
}));

describe('Contract Test: POST /api/posts/{postId}/read', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    rpc: jest.fn(),
  };

  const validPostId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Required', () => {
    it('should return 401 when no authorization header provided', async () => {
      // Arrange: Create request without auth header
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/read`,
        {
          method: 'POST',
        }
      );

      // Act: Import and call the route handler
      // This will FAIL initially since the route doesn't exist yet (TDD RED phase)
      const { POST } = await import(`@/app/api/posts/[postId]/read/route`);
      const response = await POST(request, { params: { postId: validPostId } });

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
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer invalid-token',
          },
        }
      );

      // Mock Supabase to return auth error
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid JWT' },
      });

      // Act: Call the route handler
      const { POST } = await import(`@/app/api/posts/[postId]/read/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 401 Unauthorized
      expect(response.status).toBe(401);
    });
  });

  describe('Path Parameter Validation', () => {
    it('should return 400 for invalid postId UUID format', async () => {
      // Arrange: Create request with invalid post ID in path
      const invalidPostId = 'invalid-uuid';
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${invalidPostId}/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      // Mock successful authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Act
      const { POST } = await import(`@/app/api/posts/[postId]/read/route`);
      const response = await POST(request, { params: { postId: invalidPostId } });

      // Assert: Should return 400 Bad Request for invalid post ID format
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('postId'),
      });
    });
  });

  describe('Post Access Validation', () => {
    it('should return 404 when post does not exist', async () => {
      // Arrange: Mock post not found
      const nonExistentPostId = '550e8400-e29b-41d4-a716-446655440099';
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${nonExistentPostId}/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      // Mock authentication and post lookup
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock post not found
      mockSupabaseClient.from.mockImplementation((table) => {
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
      const { POST } = await import(`@/app/api/posts/[postId]/read/route`);
      const response = await POST(request, { params: { postId: nonExistentPostId } });

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
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = {
        id: 'unauthorized-user-123',
        email: 'unauthorized@example.com',
      };

      // Mock authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock RLS blocking access (returns null due to permissions)
      mockSupabaseClient.from.mockImplementation((table) => {
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
      const { POST } = await import(`@/app/api/posts/[postId]/read/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 403 Forbidden (or 404 to not leak existence)
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Successful Read Receipt Creation', () => {
    it('should mark post as read for first-time read', async () => {
      // Arrange: Valid request for marking post as read
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
      };

      const mockPost = {
        id: validPostId,
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
        author_user_id: 'author-456',
        title: 'Test Post',
        body: 'Test post content',
      };

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock post access check and read receipt creation
      let upsertedData: any = null;
      mockSupabaseClient.from.mockImplementation((table) => {
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
        if (table === 'read_receipts') {
          return {
            upsert: jest.fn().mockImplementation((data) => {
              upsertedData = data;
              return {
                eq: jest.fn().mockReturnThis(),
                select: jest.fn().mockResolvedValue({
                  data: [{ 
                    ...data, 
                    id: 'receipt-123',
                    read_at: '2024-01-01T10:00:00.000Z' 
                  }],
                  error: null,
                }),
              };
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import(`@/app/api/posts/[postId]/read/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 200 and create read receipt
      expect(response.status).toBe(200);
      expect(upsertedData).toMatchObject({
        tenant_id: mockPost.tenant_id,
        post_id: validPostId,
        user_id: mockUser.id,
        read_at: expect.any(String),
      });
    });

    it('should handle idempotent read operations', async () => {
      // Arrange: Mark same post as read multiple times
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const mockPost = {
        id: validPostId,
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
        author_user_id: 'author-456',
      };

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
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
        if (table === 'read_receipts') {
          return {
            upsert: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              select: jest.fn().mockResolvedValue({
                data: [{ 
                  id: 'receipt-123',
                  tenant_id: mockPost.tenant_id,
                  post_id: validPostId,
                  user_id: mockUser.id,
                  read_at: '2024-01-01T10:00:00.000Z' 
                }],
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act: Mark as read multiple times
      const { POST } = await import(`@/app/api/posts/[postId]/read/route`);
      const response1 = await POST(request, { params: { postId: validPostId } });
      const response2 = await POST(request, { params: { postId: validPostId } });

      // Assert: Both requests should succeed
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });

    it('should update read timestamp on subsequent reads', async () => {
      // Arrange: Post already marked as read, mark again
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const mockPost = {
        id: validPostId,
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
        author_user_id: 'author-456',
      };

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      let upsertCallCount = 0;
      mockSupabaseClient.from.mockImplementation((table) => {
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
        if (table === 'read_receipts') {
          return {
            upsert: jest.fn().mockImplementation((data) => {
              upsertCallCount++;
              const timestamp = new Date().toISOString();
              return {
                eq: jest.fn().mockReturnThis(),
                select: jest.fn().mockResolvedValue({
                  data: [{ 
                    ...data, 
                    id: 'receipt-123',
                    read_at: timestamp
                  }],
                  error: null,
                }),
              };
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import(`@/app/api/posts/[postId]/read/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should succeed and call upsert (which handles both insert and update)
      expect(response.status).toBe(200);
      expect(upsertCallCount).toBe(1);
    });
  });

  describe('Multi-tenant Security', () => {
    it('should automatically set tenant_id from post', async () => {
      // Arrange: Create read receipt and verify tenant_id is set correctly
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const expectedTenantId = 'tenant-123e4567-e89b-12d3-a456-426614174000';
      
      const mockPost = {
        id: validPostId,
        tenant_id: expectedTenantId,
        author_user_id: 'author-456',
      };

      // Mock authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock database operations - verify tenant_id is inherited from post
      let upsertedData: any = null;
      mockSupabaseClient.from.mockImplementation((table) => {
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
        if (table === 'read_receipts') {
          return {
            upsert: jest.fn().mockImplementation((data) => {
              upsertedData = data;
              return {
                eq: jest.fn().mockReturnThis(),
                select: jest.fn().mockResolvedValue({
                  data: [{ 
                    ...data, 
                    id: 'receipt-123',
                    read_at: '2024-01-01T10:00:00.000Z' 
                  }],
                  error: null,
                }),
              };
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import(`@/app/api/posts/[postId]/read/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should set correct tenant_id
      expect(response.status).toBe(200);
      expect(upsertedData).toMatchObject({
        tenant_id: expectedTenantId,
        post_id: validPostId,
        user_id: mockUser.id,
      });
    });

    it('should respect RLS policies on read_receipts table', async () => {
      // Arrange: User tries to mark post as read but RLS prevents it
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = {
        id: 'restricted-user-123',
        email: 'restricted@example.com',
      };

      const mockPost = {
        id: validPostId,
        tenant_id: 'tenant-123',
        author_user_id: 'author-456',
      };

      // Mock authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
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
        if (table === 'read_receipts') {
          return {
            upsert: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              select: jest.fn().mockResolvedValue({
                data: null, // RLS prevented insert/update
                error: { message: 'Row level security policy violated' },
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import(`@/app/api/posts/[postId]/read/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return error due to RLS restriction
      expect([403, 500]).toContain(response.status);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database insertion errors gracefully', async () => {
      // Arrange: Mock database error during read receipt creation
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockPost = { id: validPostId, tenant_id: 'tenant-123' };

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
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
        if (table === 'read_receipts') {
          return {
            upsert: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
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
      const { POST } = await import(`@/app/api/posts/[postId]/read/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 500 Internal Server Error
      expect(response.status).toBe(500);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Internal Server Error',
        message: expect.any(String),
      });
    });

    it('should handle missing request body gracefully', async () => {
      // Arrange: POST request typically has no body, but test edge case handling
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          // No body is actually required for this endpoint
        }
      );

      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockPost = { id: validPostId, tenant_id: 'tenant-123' };

      // Mock successful authentication and operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
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
        if (table === 'read_receipts') {
          return {
            upsert: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              select: jest.fn().mockResolvedValue({
                data: [{ 
                  id: 'receipt-123',
                  tenant_id: 'tenant-123',
                  post_id: validPostId,
                  user_id: 'user-123',
                  read_at: '2024-01-01T10:00:00.000Z' 
                }],
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import(`@/app/api/posts/[postId]/read/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should succeed even without request body
      expect(response.status).toBe(200);
    });
  });

  describe('API Contract Validation', () => {
    it('should return 200 status matching OpenAPI specification exactly', async () => {
      // This test ensures the response exactly matches the API contract
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'contract@example.com',
        name: 'Contract User',
      };

      const mockPost = {
        id: validPostId,
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
        author_user_id: 'author-456',
        title: 'Contract Test Post',
        body: 'Test post for contract validation',
      };

      // Mock successful response
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
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
        if (table === 'read_receipts') {
          return {
            upsert: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              select: jest.fn().mockResolvedValue({
                data: [{ 
                  id: 'receipt-123e4567-e89b-12d3-a456-426614174000',
                  tenant_id: mockPost.tenant_id,
                  post_id: validPostId,
                  user_id: mockUser.id,
                  read_at: '2024-01-01T10:00:00.000Z' 
                }],
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import(`@/app/api/posts/[postId]/read/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Response matches OpenAPI specification exactly
      expect(response.status).toBe(200);
      
      // The API spec doesn't specify a response body schema for this endpoint
      // It simply states "Post marked as read", so we verify successful status
      // and that the response can be parsed (even if empty/minimal)
      const body = await response.json();
      
      // Response should be valid JSON (could be empty object, success message, etc.)
      expect(body).toBeDefined();
      
      // If response includes data, it should be properly structured
      if (body && typeof body === 'object' && body.message) {
        expect(typeof body.message).toBe('string');
      }
      
      // Verify the operation was successful (read receipt was created/updated)
      // This is implicitly tested by the successful 200 response
    });

    it('should handle read receipt tracking correctly for analytics', async () => {
      // Test that read receipts can be used for engagement analytics
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/read`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = {
        id: 'analytics-user-123',
        email: 'analytics@example.com',
      };

      const mockPost = {
        id: validPostId,
        tenant_id: 'tenant-123',
        author_user_id: 'author-456',
      };

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      let readReceiptData: any = null;
      mockSupabaseClient.from.mockImplementation((table) => {
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
        if (table === 'read_receipts') {
          return {
            upsert: jest.fn().mockImplementation((data) => {
              readReceiptData = data;
              return {
                eq: jest.fn().mockReturnThis(),
                select: jest.fn().mockResolvedValue({
                  data: [{ 
                    ...data, 
                    id: 'receipt-analytics-123',
                    read_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
                  }],
                  error: null,
                }),
              };
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import(`@/app/api/posts/[postId]/read/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should create analytics-trackable read receipt
      expect(response.status).toBe(200);
      expect(readReceiptData).toMatchObject({
        tenant_id: mockPost.tenant_id,
        post_id: validPostId,
        user_id: mockUser.id,
        read_at: expect.any(String),
      });
      
      // Verify timestamp is recent (within last minute)
      const readAtTime = new Date(readReceiptData.read_at).getTime();
      const now = new Date().getTime();
      expect(now - readAtTime).toBeLessThan(60000); // Within 1 minute
    });
  });
});
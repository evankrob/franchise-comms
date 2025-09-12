/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

/**
 * Contract Test: POST /api/posts/{postId}/comments
 * 
 * This test validates the API contract for creating comments on posts.
 * It must FAIL initially (TDD RED phase) since the endpoint doesn't exist yet.
 * 
 * API Contract from api-spec.yaml lines 539-570:
 * - Path: POST /posts/{postId}/comments
 * - Security: Bearer Auth required
 * - Path Parameter: postId (UUID format)
 * - Required Request Fields: body
 * - Optional Fields: body_rich, parent_comment_id
 * - Response 201: Comment object with id, tenant_id, post_id, author, body, created_at
 * - Response 400: Invalid request (missing body, invalid parent_comment_id)
 * - Response 401: Unauthorized when no valid token
 * - Response 404: Post not found or user cannot access post
 */

// Mock Supabase for testing
jest.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: jest.fn(),
  getCurrentUser: jest.fn(),
}));

describe('Contract Test: POST /api/posts/{postId}/comments', () => {
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
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'This is a test comment',
          }),
        }
      );

      // Act: Import and call the route handler
      // This will FAIL initially since the route doesn't exist yet (TDD RED phase)
      const { POST } = await import(`@/app/api/posts/[postId]/comments/route`);
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
        `http://localhost:3000/api/posts/${validPostId}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer invalid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'This is a test comment',
          }),
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
      const { POST } = await import(`@/app/api/posts/[postId]/comments/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 401 Unauthorized
      expect(response.status).toBe(401);
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when required body field is missing', async () => {
      // Arrange: Create request without required body field
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // Missing required 'body' field
            body_rich: { type: 'doc', content: [] },
          }),
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
      const { POST } = await import(`@/app/api/posts/[postId]/comments/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 400 Bad Request
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('body'),
      });
    });

    it('should return 400 when body is empty string', async () => {
      // Arrange: Create request with empty body string
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: '', // Empty string should be invalid
          }),
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
      const { POST } = await import(`@/app/api/posts/[postId]/comments/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 400 Bad Request
      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid parent_comment_id UUID format', async () => {
      // Arrange: Create request with invalid parent comment ID
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'This is a reply comment',
            parent_comment_id: 'invalid-uuid-format', // Invalid UUID
          }),
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
      const { POST } = await import(`@/app/api/posts/[postId]/comments/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 400 Bad Request for invalid UUID format
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('parent_comment_id'),
      });
    });

    it('should return 400 for invalid postId UUID format', async () => {
      // Arrange: Create request with invalid post ID in path
      const invalidPostId = 'invalid-uuid';
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${invalidPostId}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'This is a test comment',
          }),
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
      const { POST } = await import(`@/app/api/posts/[postId]/comments/route`);
      const response = await POST(request, { params: { postId: invalidPostId } });

      // Assert: Should return 400 Bad Request for invalid post ID format
      expect(response.status).toBe(400);
    });
  });

  describe('Post Access Validation', () => {
    it('should return 404 when post does not exist', async () => {
      // Arrange: Mock post not found
      const nonExistentPostId = '550e8400-e29b-41d4-a716-446655440099';
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${nonExistentPostId}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'This is a test comment',
          }),
        }
      );

      // Mock authentication and post lookup
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
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
      const { POST } = await import(`@/app/api/posts/[postId]/comments/route`);
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
        `http://localhost:3000/api/posts/${validPostId}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'This should be forbidden',
          }),
        }
      );

      // Mock authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'unauthorized-user' } },
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
      const { POST } = await import(`@/app/api/posts/[postId]/comments/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 403 Forbidden
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Successful Comment Creation', () => {
    it('should create comment with minimal required fields', async () => {
      // Arrange: Valid request with only required fields
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'This is a minimal test comment',
          }),
        }
      );

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
      };

      const mockPost = {
        id: validPostId,
        tenant_id: 'tenant-123',
        author_user_id: 'author-456',
        title: 'Test Post',
        body: 'Test post content',
      };

      const mockComment = {
        id: 'comment-123e4567-e89b-12d3-a456-426614174000',
        tenant_id: 'tenant-123',
        post_id: validPostId,
        parent_comment_id: null,
        author_user_id: mockUser.id,
        author: mockUser,
        body: 'This is a minimal test comment',
        body_rich: null,
        attachments: [],
        created_at: '2024-01-01T10:00:00.000Z',
      };

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock post access check
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
        if (table === 'comments') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [mockComment],
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import(`@/app/api/posts/[postId]/comments/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 201 with comment data
      expect(response.status).toBe(201);
      expect(response.headers.get('content-type')).toBe('application/json');
      
      const body = await response.json();
      expect(body).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        tenant_id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        post_id: validPostId,
        parent_comment_id: null,
        author_user_id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        author: expect.objectContaining({
          id: expect.any(String),
          email: expect.any(String),
          name: expect.any(String),
        }),
        body: 'This is a minimal test comment',
        body_rich: null,
        attachments: expect.any(Array),
        created_at: expect.any(String),
      });
    });

    it('should create comment with all optional fields', async () => {
      // Arrange: Valid request with all optional fields
      const parentCommentId = 'parent-123e4567-e89b-12d3-a456-426614174000';
      const bodyRich = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'This is a rich text comment' }],
          },
        ],
      };

      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'This is a comprehensive test comment',
            body_rich: bodyRich,
            parent_comment_id: parentCommentId,
          }),
        }
      );

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
      };

      const mockPost = {
        id: validPostId,
        tenant_id: 'tenant-123',
        author_user_id: 'author-456',
      };

      const mockComment = {
        id: 'comment-789e4567-e89b-12d3-a456-426614174000',
        tenant_id: 'tenant-123',
        post_id: validPostId,
        parent_comment_id: parentCommentId,
        author_user_id: mockUser.id,
        author: mockUser,
        body: 'This is a comprehensive test comment',
        body_rich: bodyRich,
        attachments: [],
        created_at: '2024-01-01T10:00:00.000Z',
      };

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock post and parent comment access checks
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
        if (table === 'comments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: parentCommentId, post_id: validPostId },
                    error: null,
                  }),
                }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [mockComment],
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import(`@/app/api/posts/[postId]/comments/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 201 with full comment data
      expect(response.status).toBe(201);
      
      const body = await response.json();
      expect(body).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        tenant_id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        post_id: validPostId,
        parent_comment_id: parentCommentId,
        author_user_id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        author: expect.objectContaining({
          id: expect.any(String),
          email: expect.any(String),
          name: expect.any(String),
        }),
        body: 'This is a comprehensive test comment',
        body_rich: bodyRich,
        attachments: expect.any(Array),
        created_at: expect.any(String),
      });
    });

    it('should validate parent comment belongs to same post', async () => {
      // Arrange: Request with parent comment from different post
      const parentCommentId = 'parent-123e4567-e89b-12d3-a456-426614174000';
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'This is a reply to comment from different post',
            parent_comment_id: parentCommentId,
          }),
        }
      );

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const mockPost = {
        id: validPostId,
        tenant_id: 'tenant-123',
      };

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock post exists but parent comment belongs to different post
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
        if (table === 'comments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { 
                      id: parentCommentId, 
                      post_id: 'different-post-id' // Parent belongs to different post
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
      const { POST } = await import(`@/app/api/posts/[postId]/comments/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 400 Bad Request
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('parent'),
      });
    });
  });

  describe('Multi-tenant Security', () => {
    it('should automatically set tenant_id from user membership', async () => {
      // Arrange: Create comment and verify tenant_id is set correctly
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'Test comment for tenant validation',
          }),
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
      let insertedData: any = null;
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
        if (table === 'comments') {
          return {
            insert: jest.fn().mockImplementation((data) => {
              insertedData = data;
              return {
                select: jest.fn().mockResolvedValue({
                  data: [{ 
                    ...data, 
                    id: 'comment-123',
                    created_at: '2024-01-01T10:00:00.000Z' 
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
      const { POST } = await import(`@/app/api/posts/[postId]/comments/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should set correct tenant_id
      expect(response.status).toBe(201);
      expect(insertedData).toMatchObject({
        tenant_id: expectedTenantId,
        post_id: validPostId,
        author_user_id: mockUser.id,
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database insertion errors gracefully', async () => {
      // Arrange: Mock database error during comment insertion
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'This comment will cause database error',
          }),
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
        if (table === 'comments') {
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
      const { POST } = await import(`@/app/api/posts/[postId]/comments/route`);
      const response = await POST(request, { params: { postId: validPostId } });

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
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: '{ invalid json syntax',
        }
      );

      // Act
      const { POST } = await import(`@/app/api/posts/[postId]/comments/route`);
      const response = await POST(request, { params: { postId: validPostId } });

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
    it('should return response matching OpenAPI Comment schema exactly', async () => {
      // This test ensures the response exactly matches the API contract
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: 'Contract validation comment',
          }),
        }
      );

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'contract@example.com',
        name: 'Contract User',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2024-01-01T00:00:00.000Z',
      };

      const mockPost = {
        id: validPostId,
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
        author_user_id: 'author-456',
      };

      const mockComment = {
        id: 'comment-123e4567-e89b-12d3-a456-426614174000',
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
        post_id: validPostId,
        parent_comment_id: null,
        author_user_id: mockUser.id,
        author: mockUser,
        body: 'Contract validation comment',
        body_rich: null,
        attachments: [],
        created_at: '2024-01-01T10:00:00.000Z',
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
        if (table === 'comments') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [mockComment],
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import(`@/app/api/posts/[postId]/comments/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Response structure matches OpenAPI Comment schema exactly
      expect(response.status).toBe(201);
      expect(response.headers.get('content-type')).toBe('application/json');
      
      const body = await response.json();
      
      // Required fields from API spec (lines 154-185)
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('tenant_id');
      expect(body).toHaveProperty('post_id');
      expect(body).toHaveProperty('author_user_id');
      expect(body).toHaveProperty('author');
      expect(body).toHaveProperty('body');
      
      // Optional fields from API spec
      expect(body).toHaveProperty('parent_comment_id');
      expect(body).toHaveProperty('body_rich');
      expect(body).toHaveProperty('attachments');
      expect(body).toHaveProperty('created_at');
      
      // Validate data types and formats
      expect(typeof body.id).toBe('string');
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
      expect(typeof body.tenant_id).toBe('string');
      expect(body.tenant_id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
      expect(typeof body.post_id).toBe('string');
      expect(body.post_id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
      expect(typeof body.author_user_id).toBe('string');
      expect(body.author_user_id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
      expect(typeof body.body).toBe('string');
      expect(typeof body.created_at).toBe('string');
      expect(body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO date format
      
      // Validate author object matches User schema
      expect(body.author).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        email: expect.stringMatching(/^[^@]+@[^@]+\.[^@]+$/),
        name: expect.any(String),
      });
      
      // Validate attachments is array (even if empty)
      expect(Array.isArray(body.attachments)).toBe(true);
      
      // No unexpected fields should be present in the top level
      const expectedKeys = [
        'id', 'tenant_id', 'post_id', 'parent_comment_id', 
        'author_user_id', 'author', 'body', 'body_rich', 
        'attachments', 'created_at'
      ];
      const actualKeys = Object.keys(body);
      actualKeys.forEach(key => {
        expect(expectedKeys).toContain(key);
      });
    });
  });
});
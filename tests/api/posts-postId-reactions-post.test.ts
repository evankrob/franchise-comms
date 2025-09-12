/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

/**
 * Contract Test: POST /api/posts/{postId}/reactions
 * 
 * This test validates the API contract for adding/removing reactions to posts.
 * It must FAIL initially (TDD RED phase) since the endpoint doesn't exist yet.
 * 
 * API Contract from api-spec.yaml lines 587-614:
 * - Path: POST /posts/{postId}/reactions
 * - Security: Bearer Auth required
 * - Path Parameter: postId (UUID format)
 * - Required Request Fields: type, action
 * - type enum: [like, acknowledge, needs_attention]
 * - action enum: [add, remove]
 * - Response 200: Reaction updated (no specific response body defined)
 * - Response 400: Invalid request (missing fields, invalid enums)
 * - Response 401: Unauthorized when no valid token
 * - Response 404: Post not found or user cannot access post
 * 
 * Business Logic:
 * - Creates reaction when action=add, removes when action=remove
 * - Each user can have only one reaction per post (upsert behavior)
 * - Idempotent operations (add existing or remove non-existing should not error)
 * - Must respect multi-tenant RLS policies
 */

// Mock Supabase for testing
jest.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: jest.fn(),
  getCurrentUser: jest.fn(),
}));

describe('Contract Test: POST /api/posts/{postId}/reactions', () => {
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
    delete: jest.fn().mockReturnThis(),
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
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'like',
            action: 'add',
          }),
        }
      );

      // Act: Import and call the route handler
      // This will FAIL initially since the route doesn't exist yet (TDD RED phase)
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
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
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer invalid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'acknowledge',
            action: 'add',
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
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 401 Unauthorized
      expect(response.status).toBe(401);
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when required type field is missing', async () => {
      // Arrange: Create request without required type field
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // Missing required 'type' field
            action: 'add',
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
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 400 Bad Request
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('type'),
      });
    });

    it('should return 400 when required action field is missing', async () => {
      // Arrange: Create request without required action field
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'like',
            // Missing required 'action' field
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
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 400 Bad Request
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('action'),
      });
    });

    it('should return 400 for invalid type enum value', async () => {
      // Arrange: Create request with invalid reaction type
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'invalid_reaction_type', // Not in [like, acknowledge, needs_attention]
            action: 'add',
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
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 400 Bad Request for invalid enum
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('type'),
      });
    });

    it('should return 400 for invalid action enum value', async () => {
      // Arrange: Create request with invalid action
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'like',
            action: 'invalid_action', // Not in [add, remove]
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
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 400 Bad Request for invalid enum
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('action'),
      });
    });

    it('should return 400 for invalid postId UUID format', async () => {
      // Arrange: Create request with invalid post ID in path
      const invalidPostId = 'invalid-uuid';
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${invalidPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'like',
            action: 'add',
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
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
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
        `http://localhost:3000/api/posts/${nonExistentPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'like',
            action: 'add',
          }),
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
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
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
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'acknowledge',
            action: 'add',
          }),
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
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 403 Forbidden (or 404 to not leak existence)
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Successful Reaction Management - Add Reactions', () => {
    it('should add like reaction successfully', async () => {
      // Arrange: Valid request to add like reaction
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'like',
            action: 'add',
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

      // Mock post access check and reaction creation
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
        if (table === 'reactions') {
          return {
            upsert: jest.fn().mockImplementation((data) => {
              upsertedData = data;
              return {
                eq: jest.fn().mockReturnThis(),
                select: jest.fn().mockResolvedValue({
                  data: [{ 
                    ...data, 
                    id: 'reaction-123',
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
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return 200 and create reaction
      expect(response.status).toBe(200);
      expect(upsertedData).toMatchObject({
        tenant_id: mockPost.tenant_id,
        post_id: validPostId,
        user_id: mockUser.id,
        type: 'like',
      });
    });

    it('should add acknowledge reaction successfully', async () => {
      // Arrange: Valid request to add acknowledge reaction
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'acknowledge',
            action: 'add',
          }),
        }
      );

      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockPost = { id: validPostId, tenant_id: 'tenant-123' };

      // Mock successful operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      let reactionType: string | null = null;
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
        if (table === 'reactions') {
          return {
            upsert: jest.fn().mockImplementation((data) => {
              reactionType = data.type;
              return {
                eq: jest.fn().mockReturnThis(),
                select: jest.fn().mockResolvedValue({
                  data: [{ ...data, id: 'reaction-123' }],
                  error: null,
                }),
              };
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert
      expect(response.status).toBe(200);
      expect(reactionType).toBe('acknowledge');
    });

    it('should add needs_attention reaction successfully', async () => {
      // Arrange: Valid request to add needs_attention reaction
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'needs_attention',
            action: 'add',
          }),
        }
      );

      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockPost = { id: validPostId, tenant_id: 'tenant-123' };

      // Mock successful operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      let reactionType: string | null = null;
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
        if (table === 'reactions') {
          return {
            upsert: jest.fn().mockImplementation((data) => {
              reactionType = data.type;
              return {
                eq: jest.fn().mockReturnThis(),
                select: jest.fn().mockResolvedValue({
                  data: [{ ...data, id: 'reaction-123' }],
                  error: null,
                }),
              };
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert
      expect(response.status).toBe(200);
      expect(reactionType).toBe('needs_attention');
    });
  });

  describe('Successful Reaction Management - Remove Reactions', () => {
    it('should remove existing reaction successfully', async () => {
      // Arrange: Valid request to remove reaction
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'like',
            action: 'remove',
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

      let deletedFromTable: string | null = null;
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
        if (table === 'reactions') {
          deletedFromTable = table;
          return {
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: null, // Successful deletion
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
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should successfully remove reaction
      expect(response.status).toBe(200);
      expect(deletedFromTable).toBe('reactions');
    });

    it('should handle idempotent remove operations gracefully', async () => {
      // Arrange: Try to remove non-existent reaction
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'like',
            action: 'remove',
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
        if (table === 'reactions') {
          return {
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: null, // No rows affected (reaction didn't exist)
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
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should succeed even if reaction didn't exist
      expect(response.status).toBe(200);
    });
  });

  describe('Reaction Replacement Logic', () => {
    it('should replace existing reaction when adding different type', async () => {
      // Arrange: User already has 'like', now adding 'acknowledge'
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'acknowledge',
            action: 'add',
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

      let upsertedReaction: any = null;
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
        if (table === 'reactions') {
          return {
            upsert: jest.fn().mockImplementation((data) => {
              upsertedReaction = data;
              return {
                eq: jest.fn().mockReturnThis(),
                select: jest.fn().mockResolvedValue({
                  data: [{ 
                    ...data, 
                    id: 'reaction-123',
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
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should replace with new reaction type
      expect(response.status).toBe(200);
      expect(upsertedReaction).toMatchObject({
        tenant_id: mockPost.tenant_id,
        post_id: validPostId,
        user_id: mockUser.id,
        type: 'acknowledge', // New reaction type
      });
    });
  });

  describe('Multi-tenant Security', () => {
    it('should automatically set tenant_id from post', async () => {
      // Arrange: Create reaction and verify tenant_id is set correctly
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'like',
            action: 'add',
          }),
        }
      );

      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const expectedTenantId = 'tenant-123e4567-e89b-12d3-a456-426614174000';
      const mockPost = { id: validPostId, tenant_id: expectedTenantId };

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
        if (table === 'reactions') {
          return {
            upsert: jest.fn().mockImplementation((data) => {
              upsertedData = data;
              return {
                eq: jest.fn().mockReturnThis(),
                select: jest.fn().mockResolvedValue({
                  data: [{ ...data, id: 'reaction-123' }],
                  error: null,
                }),
              };
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should set correct tenant_id
      expect(response.status).toBe(200);
      expect(upsertedData).toMatchObject({
        tenant_id: expectedTenantId,
        post_id: validPostId,
        user_id: mockUser.id,
        type: 'like',
      });
    });

    it('should respect RLS policies on reactions table', async () => {
      // Arrange: User tries to add reaction but RLS prevents it
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'like',
            action: 'add',
          }),
        }
      );

      const mockUser = { id: 'restricted-user-123', email: 'restricted@example.com' };
      const mockPost = { id: validPostId, tenant_id: 'tenant-123' };

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
        if (table === 'reactions') {
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
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Should return error due to RLS restriction
      expect([403, 500]).toContain(response.status);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange: Mock database error during reaction operation
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'like',
            action: 'add',
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
        if (table === 'reactions') {
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
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
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
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
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
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
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
    it('should return 200 status matching OpenAPI specification exactly', async () => {
      // This test ensures the response exactly matches the API contract
      const request = new NextRequest(
        `http://localhost:3000/api/posts/${validPostId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'like',
            action: 'add',
          }),
        }
      );

      const mockUser = { id: 'user-123', email: 'contract@example.com' };
      const mockPost = { id: validPostId, tenant_id: 'tenant-123' };

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
        if (table === 'reactions') {
          return {
            upsert: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              select: jest.fn().mockResolvedValue({
                data: [{ 
                  id: 'reaction-123',
                  tenant_id: 'tenant-123',
                  post_id: validPostId,
                  user_id: 'user-123',
                  type: 'like',
                  created_at: '2024-01-01T10:00:00.000Z' 
                }],
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
      const response = await POST(request, { params: { postId: validPostId } });

      // Assert: Response matches OpenAPI specification exactly
      expect(response.status).toBe(200);
      
      // The API spec doesn't specify a response body schema for this endpoint
      // It simply states "Reaction updated", so we verify successful status
      // and that the response can be parsed (even if empty/minimal)
      const body = await response.json();
      
      // Response should be valid JSON (could be empty object, success message, etc.)
      expect(body).toBeDefined();
      
      // If response includes data, it should be properly structured
      if (body && typeof body === 'object' && body.message) {
        expect(typeof body.message).toBe('string');
      }
      
      // Verify the operation was successful (reaction was created/updated)
      // This is implicitly tested by the successful 200 response
    });

    it('should validate all reaction types from OpenAPI enum', async () => {
      // Test all valid reaction types defined in the API spec
      const reactionTypes = ['like', 'acknowledge', 'needs_attention'];
      
      for (const reactionType of reactionTypes) {
        const request = new NextRequest(
          `http://localhost:3000/api/posts/${validPostId}/reactions`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer valid-token',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: reactionType,
              action: 'add',
            }),
          }
        );

        const mockUser = { id: 'user-123', email: 'test@example.com' };
        const mockPost = { id: validPostId, tenant_id: 'tenant-123' };

        // Mock successful response for each reaction type
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
          if (table === 'reactions') {
            return {
              upsert: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnThis(),
                select: jest.fn().mockResolvedValue({
                  data: [{ 
                    id: `reaction-${reactionType}`,
                    type: reactionType 
                  }],
                  error: null,
                }),
              }),
            };
          }
          return mockSupabaseClient;
        });

        // Act
        const { POST } = await import(`@/app/api/posts/[postId]/reactions/route`);
        const response = await POST(request, { params: { postId: validPostId } });

        // Assert: Each reaction type should be accepted
        expect(response.status).toBe(200);
      }
    });
  });
});
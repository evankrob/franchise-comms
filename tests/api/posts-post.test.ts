/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

/**
 * Contract Test: POST /api/posts
 * 
 * This test validates the API contract for creating posts.
 * It must FAIL initially (TDD RED phase) since the endpoint doesn't exist yet.
 * 
 * API Contract from api-spec.yaml:
 * - Path: POST /posts
 * - Security: Bearer Auth required
 * - Request body: { body, post_type, targeting } (required), title, body_rich, due_date (optional)
 * - post_type enum: [message, announcement, request, performance_update]
 * - Response 201: Created Post object
 * - Response 400: Bad Request for validation errors
 * - Response 401: Unauthorized when no valid token
 * - Response 403: Forbidden when insufficient permissions
 */

// Mock Supabase for testing
jest.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: jest.fn(),
  getCurrentUser: jest.fn(),
}));

describe('Contract Test: POST /api/posts', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Required', () => {
    it('should return 401 when no authorization header provided', async () => {
      // Arrange: Create request without auth header
      const requestBody = {
        body: 'Test post body',
        post_type: 'message',
        targeting: { type: 'all_locations' },
      };

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // Act: Import and call the route handler
      // This will FAIL initially since the route doesn't exist yet (TDD RED phase)
      const { POST } = await import('@/app/api/posts/route');
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
      const requestBody = {
        body: 'Test post body',
        post_type: 'message',
        targeting: { type: 'all_locations' },
      };

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Mock Supabase to return auth error
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid JWT' },
      });

      // Act: Call the route handler
      const { POST } = await import('@/app/api/posts/route');
      const response = await POST(request);

      // Assert: Should return 401 Unauthorized
      expect(response.status).toBe(401);
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when required fields are missing', async () => {
      // Arrange: Request with missing required fields
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const incompleteBody = {
        title: 'Missing required fields',
        // Missing: body, post_type, targeting
      };

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(incompleteBody),
      });

      // Mock Supabase auth
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Act
      const { POST } = await import('@/app/api/posts/route');
      const response = await POST(request);

      // Assert: Should return 400 Bad Request
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('required'),
      });
    });

    it('should return 400 for invalid post_type enum value', async () => {
      // Arrange: Request with invalid post_type
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const invalidBody = {
        body: 'Test post body',
        post_type: 'invalid_type', // Not in enum
        targeting: { type: 'all_locations' },
      };

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidBody),
      });

      // Mock Supabase auth
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Act
      const { POST } = await import('@/app/api/posts/route');
      const response = await POST(request);

      // Assert: Should return 400 Bad Request for invalid enum
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('post_type'),
      });
    });

    it('should return 400 for title longer than 500 characters', async () => {
      // Arrange: Request with title exceeding maxLength
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const longTitle = 'A'.repeat(501); // Exceeds 500 char limit
      const invalidBody = {
        title: longTitle,
        body: 'Test post body',
        post_type: 'message',
        targeting: { type: 'all_locations' },
      };

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidBody),
      });

      // Mock Supabase auth
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Act
      const { POST } = await import('@/app/api/posts/route');
      const response = await POST(request);

      // Assert: Should return 400 Bad Request for title length
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('title'),
      });
    });

    it('should return 400 for invalid due_date format', async () => {
      // Arrange: Request with invalid date format
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const invalidBody = {
        body: 'Test post body',
        post_type: 'request',
        targeting: { type: 'all_locations' },
        due_date: 'invalid-date-format', // Not ISO 8601
      };

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidBody),
      });

      // Mock Supabase auth
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Act
      const { POST } = await import('@/app/api/posts/route');
      const response = await POST(request);

      // Assert: Should return 400 Bad Request for invalid date
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('due_date'),
      });
    });
  });

  describe('Successful Post Creation', () => {
    it('should create post with minimal required fields', async () => {
      // Arrange: Valid request with only required fields
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
      };

      const validBody = {
        body: 'This is a test message post',
        post_type: 'message',
        targeting: { type: 'all_locations' },
      };

      const mockCreatedPost = {
        id: '789e0123-e89b-12d3-a456-426614174000',
        tenant_id: '456e7890-e89b-12d3-a456-426614174000',
        author_user_id: '123e4567-e89b-12d3-a456-426614174000',
        author: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test User',
          email: 'test@example.com',
        },
        title: null,
        body: 'This is a test message post',
        body_rich: null,
        post_type: 'message',
        targeting: { type: 'all_locations' },
        due_date: null,
        status: 'active',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validBody),
      });

      // Mock Supabase auth and insert
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock successful insert
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'posts') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockCreatedPost,
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act: Call the route handler
      const { POST } = await import('@/app/api/posts/route');
      const response = await POST(request);

      // Assert: Should return 201 with created post
      expect(response.status).toBe(201);
      
      const body = await response.json();
      expect(body).toMatchObject({
        id: expect.any(String),
        tenant_id: expect.any(String),
        author_user_id: '123e4567-e89b-12d3-a456-426614174000',
        author: expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          email: expect.stringMatching(/^.+@.+\..+$/),
        }),
        title: null,
        body: 'This is a test message post',
        body_rich: null,
        post_type: 'message',
        targeting: { type: 'all_locations' },
        due_date: null,
        status: 'active',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });

      // Validate UUID formats
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(body.tenant_id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(body.author_user_id).toMatch(/^[0-9a-f-]{36}$/i);

      // Verify insert was called with correct data
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('posts');
    });

    it('should create post with all optional fields', async () => {
      // Arrange: Request with all fields including optional ones
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'manager@example.com',
        name: 'Manager User',
      };

      const fullBody = {
        title: 'Q4 Performance Review Required',
        body: 'Please complete your Q4 performance reviews by the due date.',
        body_rich: {
          version: '2.24.3',
          blocks: [
            {
              type: 'header',
              data: { text: 'Q4 Performance Review Required', level: 2 },
            },
            {
              type: 'paragraph',
              data: { text: 'Please complete your Q4 performance reviews by the due date.' },
            },
          ],
        },
        post_type: 'request',
        targeting: {
          type: 'specific_locations',
          location_ids: ['loc-1', 'loc-2', 'loc-3'],
        },
        due_date: '2024-02-15T23:59:59.000Z',
      };

      const mockCreatedPost = {
        id: 'post-full-456',
        tenant_id: 'tenant-123',
        author_user_id: '123e4567-e89b-12d3-a456-426614174000',
        author: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Manager User',
          email: 'manager@example.com',
        },
        ...fullBody,
        status: 'active',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fullBody),
      });

      // Mock Supabase
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'posts') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockCreatedPost,
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/posts/route');
      const response = await POST(request);

      // Assert: Should return 201 with full post data
      expect(response.status).toBe(201);
      const body = await response.json();
      
      expect(body).toMatchObject({
        title: 'Q4 Performance Review Required',
        body: 'Please complete your Q4 performance reviews by the due date.',
        body_rich: expect.objectContaining({
          version: expect.any(String),
          blocks: expect.any(Array),
        }),
        post_type: 'request',
        targeting: {
          type: 'specific_locations',
          location_ids: ['loc-1', 'loc-2', 'loc-3'],
        },
        due_date: '2024-02-15T23:59:59.000Z',
      });
    });

    it('should create different post types successfully', async () => {
      // Test all valid post_type enum values
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
      };

      const postTypes = ['message', 'announcement', 'request', 'performance_update'];
      
      for (const postType of postTypes) {
        const requestBody = {
          title: `Test ${postType} post`,
          body: `This is a ${postType} post body`,
          post_type: postType,
          targeting: { type: 'all_locations' },
        };

        const mockCreatedPost = {
          id: `post-${postType}-123`,
          tenant_id: 'tenant-123',
          author_user_id: '123e4567-e89b-12d3-a456-426614174000',
          author: mockUser,
          ...requestBody,
          status: 'active',
          created_at: '2024-01-01T00:00:00.000Z',
        };

        const request = new NextRequest('http://localhost:3000/api/posts', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        // Mock Supabase
        const { createSupabaseServerClient } = await import('@/lib/supabase-server');
        (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
        
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        mockSupabaseClient.from.mockImplementation((table) => {
          if (table === 'posts') {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockCreatedPost,
                    error: null,
                  }),
                }),
              }),
            };
          }
          return mockSupabaseClient;
        });

        // Act
        const { POST } = await import('@/app/api/posts/route');
        const response = await POST(request);

        // Assert: Should create each post type successfully
        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.post_type).toBe(postType);
      }
    });
  });

  describe('Multi-tenant Security and Permissions', () => {
    it('should automatically set tenant_id based on user membership', async () => {
      // Test that posts are automatically assigned to user's current tenant
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@tenant123.com',
        name: 'Tenant User',
      };

      const requestBody = {
        body: 'Test tenant isolation',
        post_type: 'message',
        targeting: { type: 'all_locations' },
      };

      const mockCreatedPost = {
        id: 'post-tenant-isolation',
        tenant_id: 'tenant-123', // Should be automatically set
        author_user_id: '123e4567-e89b-12d3-a456-426614174000',
        author: mockUser,
        ...requestBody,
        status: 'active',
        created_at: '2024-01-01T00:00:00.000Z',
      };

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Mock Supabase
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'posts') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockCreatedPost,
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/posts/route');
      const response = await POST(request);

      // Assert: Should set correct tenant_id
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.tenant_id).toBe('tenant-123'); // Auto-assigned based on user
      expect(body.author_user_id).toBe(mockUser.id);
    });

    it('should validate targeting permissions for location-specific posts', async () => {
      // Test that users can only target locations they have access to
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'limited@example.com',
        name: 'Limited User',
      };

      const requestBody = {
        body: 'Post targeted to specific locations',
        post_type: 'message',
        targeting: {
          type: 'specific_locations',
          location_ids: ['loc-unauthorized'], // User doesn't have access
        },
      };

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Mock Supabase - user doesn't have access to targeted location
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock location access check failure
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'locations') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                data: [], // No access to targeted locations
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/posts/route');
      const response = await POST(request);

      // Assert: Should return 403 Forbidden for unauthorized targeting
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Forbidden',
        message: expect.stringContaining('location'),
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database insertion errors gracefully', async () => {
      // Test database error handling
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
      };

      const requestBody = {
        body: 'Test database error',
        post_type: 'message',
        targeting: { type: 'all_locations' },
      };

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Mock database error
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'posts') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database constraint violation', code: '23505' },
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/posts/route');
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
      // Test malformed request body handling
      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: '{ invalid json }',
      });

      // Act
      const { POST } = await import('@/app/api/posts/route');
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
    it('should return response matching OpenAPI schema exactly', async () => {
      // This test ensures the response exactly matches the API contract
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'contract@example.com',
        name: 'Contract User',
      };

      const requestBody = {
        title: 'Contract Validation Post',
        body: 'This validates the API contract response',
        body_rich: {
          version: '2.24.3',
          blocks: [{ type: 'paragraph', data: { text: 'Rich content' } }],
        },
        post_type: 'announcement',
        targeting: { type: 'all_locations' },
        due_date: '2024-03-01T00:00:00.000Z',
      };

      const mockCreatedPost = {
        id: '789e0123-e89b-12d3-a456-426614174000',
        tenant_id: '456e7890-e89b-12d3-a456-426614174000',
        author_user_id: '123e4567-e89b-12d3-a456-426614174000',
        author: mockUser,
        ...requestBody,
        status: 'active',
        created_at: '2024-01-01T12:00:00.000Z',
        updated_at: '2024-01-01T12:00:00.000Z',
      };

      const request = new NextRequest('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

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
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockCreatedPost,
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/posts/route');
      const response = await POST(request);

      // Assert: Response structure matches OpenAPI Post schema exactly
      expect(response.status).toBe(201);
      expect(response.headers.get('content-type')).toBe('application/json');
      
      const body = await response.json();
      
      // Required fields from API spec
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('tenant_id');
      expect(body).toHaveProperty('author_user_id');
      expect(body).toHaveProperty('body');
      expect(body).toHaveProperty('post_type');
      expect(body).toHaveProperty('targeting');
      
      // Optional fields from API spec
      expect(body).toHaveProperty('author');
      expect(body).toHaveProperty('title');
      expect(body).toHaveProperty('body_rich');
      expect(body).toHaveProperty('due_date');
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('created_at');
      expect(body).toHaveProperty('updated_at');
      
      // Validate data types
      expect(typeof body.id).toBe('string');
      expect(typeof body.tenant_id).toBe('string');
      expect(typeof body.author_user_id).toBe('string');
      expect(typeof body.body).toBe('string');
      expect(typeof body.post_type).toBe('string');
      expect(typeof body.targeting).toBe('object');
      expect(typeof body.title).toBe('string');
      expect(typeof body.body_rich).toBe('object');
      expect(typeof body.due_date).toBe('string');
      
      // Validate enum values
      expect(['message', 'announcement', 'request', 'performance_update']).toContain(body.post_type);
      
      // Validate formats
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
      expect(body.tenant_id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
      expect(body.author_user_id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
      expect(body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/); // ISO date
      expect(body.due_date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/); // ISO date
      
      // Author sub-object validation
      expect(body.author).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        email: expect.stringMatching(/^.+@.+\..+$/),
      });
    });
  });
});
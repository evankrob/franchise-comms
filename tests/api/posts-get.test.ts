/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

/**
 * Contract Test: GET /api/posts
 * 
 * This test validates the API contract for the posts feed endpoint.
 * It must FAIL initially (TDD RED phase) since the endpoint doesn't exist yet.
 * 
 * API Contract from api-spec.yaml:
 * - Path: GET /posts
 * - Security: Bearer Auth required
 * - Query params: limit (max 100, default 20), offset (default 0), type (enum), search (string)
 * - Response 200: { data: Post[], pagination: { total, limit, offset, has_more } }
 * - Post schema: id, tenant_id, author_user_id, author, title, body, body_rich, post_type, targeting, due_date, status
 * - Response 401: Unauthorized when no valid token
 */

// Mock Supabase for testing
jest.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: jest.fn(),
  getCurrentUser: jest.fn(),
}));

describe('Contract Test: GET /api/posts', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Required', () => {
    it('should return 401 when no authorization header provided', async () => {
      // Arrange: Create request without auth header
      const request = new NextRequest('http://localhost:3000/api/posts');

      // Act: Import and call the route handler
      // This will FAIL initially since the route doesn't exist yet (TDD RED phase)
      const { GET } = await import('@/app/api/posts/route');
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
      const request = new NextRequest('http://localhost:3000/api/posts', {
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
      const { GET } = await import('@/app/api/posts/route');
      const response = await GET(request);

      // Assert: Should return 401 Unauthorized
      expect(response.status).toBe(401);
    });
  });

  describe('Successful Posts Feed Retrieval', () => {
    it('should return 200 with posts feed when valid token provided', async () => {
      // Arrange: Mock successful authentication and posts lookup
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
      };

      const mockPosts = [
        {
          id: '789e0123-e89b-12d3-a456-426614174000',
          tenant_id: '456e7890-e89b-12d3-a456-426614174000',
          author_user_id: '123e4567-e89b-12d3-a456-426614174000',
          author: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Test User',
            email: 'test@example.com',
          },
          title: 'Important Announcement',
          body: 'This is an important message for all locations.',
          body_rich: {
            blocks: [{ type: 'paragraph', data: { text: 'This is an important message for all locations.' } }],
          },
          post_type: 'announcement',
          targeting: {
            type: 'all_locations',
          },
          due_date: null,
          status: 'active',
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: '111e2222-e89b-12d3-a456-426614174000',
          tenant_id: '456e7890-e89b-12d3-a456-426614174000',
          author_user_id: '123e4567-e89b-12d3-a456-426614174000',
          author: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Test User',
            email: 'test@example.com',
          },
          title: 'Monthly Report Request',
          body: 'Please submit your monthly sales reports by EOD Friday.',
          body_rich: null,
          post_type: 'request',
          targeting: {
            type: 'specific_locations',
            location_ids: ['loc-1', 'loc-2'],
          },
          due_date: '2024-02-01T23:59:59.000Z',
          status: 'active',
          created_at: '2024-01-02T00:00:00.000Z',
        },
      ];

      const request = new NextRequest('http://localhost:3000/api/posts', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      // Mock Supabase authentication and posts query
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock posts feed query with RLS filtering
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'posts') {
          return {
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({
                  data: mockPosts,
                  error: null,
                  count: 2,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act: Call the route handler
      const { GET } = await import('@/app/api/posts/route');
      const response = await GET(request);

      // Assert: Should return 200 with posts feed matching API contract
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(2);

      // Validate pagination structure
      expect(body.pagination).toMatchObject({
        total: expect.any(Number),
        limit: expect.any(Number),
        offset: expect.any(Number),
        has_more: expect.any(Boolean),
      });

      // Validate each post matches API contract
      body.data.forEach((post: any) => {
        expect(post).toMatchObject({
          id: expect.any(String),
          tenant_id: expect.any(String),
          author_user_id: expect.any(String),
          author: expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            email: expect.stringMatching(/^.+@.+\..+$/),
          }),
          title: expect.any(String),
          body: expect.any(String),
          post_type: expect.stringMatching(/^(message|announcement|request|performance_update)$/),
          targeting: expect.any(Object),
          status: expect.any(String),
          created_at: expect.any(String),
        });

        // Validate UUID formats
        expect(post.id).toMatch(/^[0-9a-f-]{36}$/i);
        expect(post.tenant_id).toMatch(/^[0-9a-f-]{36}$/i);
        expect(post.author_user_id).toMatch(/^[0-9a-f-]{36}$/i);
      });
    });

    it('should handle pagination with limit and offset parameters', async () => {
      // Arrange: Request with pagination parameters
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const mockPaginatedPosts = [
        {
          id: 'post-page-2-1',
          tenant_id: 'tenant-123',
          author_user_id: '123e4567-e89b-12d3-a456-426614174000',
          author: { id: '123e4567-e89b-12d3-a456-426614174000', name: 'User', email: 'user@test.com' },
          title: 'Page 2 Post 1',
          body: 'Second page content',
          post_type: 'message',
          targeting: {},
          status: 'active',
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ];

      const request = new NextRequest('http://localhost:3000/api/posts?limit=10&offset=20', {
        headers: { 'Authorization': 'Bearer valid-token' },
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
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({
                  data: mockPaginatedPosts,
                  error: null,
                  count: 45, // Total count
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/posts/route');
      const response = await GET(request);

      // Assert: Should return correct pagination
      expect(response.status).toBe(200);
      const body = await response.json();
      
      expect(body.pagination).toMatchObject({
        total: 45,
        limit: 10,
        offset: 20,
        has_more: true, // 20 + 10 < 45
      });

      // Verify range was called with correct parameters
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('posts');
    });

    it('should filter posts by type parameter', async () => {
      // Arrange: Request with type filter
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const mockAnnouncementPosts = [
        {
          id: 'post-announcement',
          tenant_id: 'tenant-123',
          author_user_id: '123e4567-e89b-12d3-a456-426614174000',
          author: { id: '123e4567-e89b-12d3-a456-426614174000', name: 'User', email: 'user@test.com' },
          title: 'Company Announcement',
          body: 'Important company update',
          post_type: 'announcement',
          targeting: {},
          status: 'active',
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ];

      const request = new NextRequest('http://localhost:3000/api/posts?type=announcement', {
        headers: { 'Authorization': 'Bearer valid-token' },
      });

      // Mock Supabase with type filter
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
                order: jest.fn().mockReturnValue({
                  range: jest.fn().mockResolvedValue({
                    data: mockAnnouncementPosts,
                    error: null,
                    count: 1,
                  }),
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/posts/route');
      const response = await GET(request);

      // Assert: Should return filtered results
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].post_type).toBe('announcement');
    });

    it('should search posts by text content', async () => {
      // Arrange: Request with search parameter
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const mockSearchResults = [
        {
          id: 'post-search-result',
          tenant_id: 'tenant-123',
          author_user_id: '123e4567-e89b-12d3-a456-426614174000',
          author: { id: '123e4567-e89b-12d3-a456-426614174000', name: 'User', email: 'user@test.com' },
          title: 'Sales Report Due',
          body: 'Please submit your sales reports by Friday',
          post_type: 'request',
          targeting: {},
          status: 'active',
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ];

      const request = new NextRequest('http://localhost:3000/api/posts?search=sales%20report', {
        headers: { 'Authorization': 'Bearer valid-token' },
      });

      // Mock Supabase with search filter
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
              or: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  range: jest.fn().mockResolvedValue({
                    data: mockSearchResults,
                    error: null,
                    count: 1,
                  }),
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/posts/route');
      const response = await GET(request);

      // Assert: Should return search results
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].title.toLowerCase()).toContain('sales');
    });
  });

  describe('Multi-tenant Security and RLS', () => {
    it('should only return posts visible to the user via RLS', async () => {
      // Test that RLS automatically filters posts based on user's tenant/location access
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'limited-user@example.com',
      };

      const mockVisiblePosts = [
        {
          id: 'post-visible',
          tenant_id: 'tenant-123',
          author_user_id: '456e4567-e89b-12d3-a456-426614174000',
          author: { id: '456e4567-e89b-12d3-a456-426614174000', name: 'Other User', email: 'other@test.com' },
          title: 'Visible Post',
          body: 'This post is visible to the user',
          post_type: 'message',
          targeting: { type: 'all_locations' },
          status: 'active',
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ];

      const request = new NextRequest('http://localhost:3000/api/posts', {
        headers: { 'Authorization': 'Bearer valid-token' },
      });

      // Mock Supabase with RLS filtering
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
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({
                  data: mockVisiblePosts, // RLS automatically filters
                  error: null,
                  count: 1,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/posts/route');
      const response = await GET(request);

      // Assert: Should return only RLS-filtered posts
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe('post-visible');
    });

    it('should handle users with no post access gracefully', async () => {
      // User with no tenant/location access
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'no-access@example.com',
      };

      const request = new NextRequest('http://localhost:3000/api/posts', {
        headers: { 'Authorization': 'Bearer valid-token' },
      });

      // Mock Supabase - user authenticated but no post access
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
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({
                  data: [], // RLS returns empty array
                  error: null,
                  count: 0,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/posts/route');
      const response = await GET(request);

      // Assert: Should return 200 with empty feed
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should return 400 for invalid limit parameter', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const request = new NextRequest('http://localhost:3000/api/posts?limit=150', {
        headers: { 'Authorization': 'Bearer valid-token' },
      });

      // Mock Supabase
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Act
      const { GET } = await import('@/app/api/posts/route');
      const response = await GET(request);

      // Assert: Should return 400 for limit > 100
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining('limit'),
      });
    });

    it('should return 400 for invalid post type parameter', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const request = new NextRequest('http://localhost:3000/api/posts?type=invalid_type', {
        headers: { 'Authorization': 'Bearer valid-token' },
      });

      // Mock Supabase
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Act
      const { GET } = await import('@/app/api/posts/route');
      const response = await GET(request);

      // Assert: Should return 400 for invalid enum value
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining('type'),
      });
    });

    it('should handle database errors gracefully', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const request = new NextRequest('http://localhost:3000/api/posts', {
        headers: { 'Authorization': 'Bearer valid-token' },
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
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database connection failed', code: '08000' },
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/posts/route');
      const response = await GET(request);

      // Assert: Should return 500 Internal Server Error
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Internal Server Error',
        message: expect.any(String),
      });
    });
  });

  describe('API Contract Validation', () => {
    it('should return response matching OpenAPI schema exactly', async () => {
      // This test ensures the response exactly matches the API contract
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
      };

      const mockPosts = [
        {
          id: '789e0123-e89b-12d3-a456-426614174000',
          tenant_id: '456e7890-e89b-12d3-a456-426614174000',
          author_user_id: '123e4567-e89b-12d3-a456-426614174000',
          author: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Test User',
            email: 'test@example.com',
          },
          title: 'Contract Validation Post',
          body: 'This post validates the API contract',
          body_rich: {
            version: '2.24.3',
            blocks: [{ type: 'paragraph', data: { text: 'Rich content' } }],
          },
          post_type: 'message',
          targeting: {
            type: 'specific_locations',
            location_ids: ['loc-1', 'loc-2'],
          },
          due_date: null,
          status: 'active',
          created_at: '2024-01-01T12:00:00.000Z',
          updated_at: '2024-01-01T12:00:00.000Z',
        },
      ];

      const request = new NextRequest('http://localhost:3000/api/posts', {
        headers: { 'Authorization': 'Bearer valid-token' },
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
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({
                  data: mockPosts,
                  error: null,
                  count: 1,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/posts/route');
      const response = await GET(request);

      // Assert: Response structure matches OpenAPI schema exactly
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');
      
      const body = await response.json();
      
      // Root response structure
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
      expect(Array.isArray(body.data)).toBe(true);
      
      // Pagination schema validation
      expect(body.pagination).toMatchObject({
        total: expect.any(Number),
        limit: expect.any(Number),
        offset: expect.any(Number),
        has_more: expect.any(Boolean),
      });
      
      // Post schema validation
      body.data.forEach((post: any) => {
        // Required fields from API spec
        expect(post).toHaveProperty('id');
        expect(post).toHaveProperty('tenant_id');
        expect(post).toHaveProperty('author_user_id');
        expect(post).toHaveProperty('body');
        expect(post).toHaveProperty('post_type');
        expect(post).toHaveProperty('targeting');
        
        // Optional fields from API spec
        expect(post).toHaveProperty('author');
        expect(post).toHaveProperty('title');
        expect(post).toHaveProperty('body_rich');
        expect(post).toHaveProperty('due_date');
        expect(post).toHaveProperty('status');
        expect(post).toHaveProperty('created_at');
        
        // Validate data types
        expect(typeof post.id).toBe('string');
        expect(typeof post.tenant_id).toBe('string');
        expect(typeof post.author_user_id).toBe('string');
        expect(typeof post.body).toBe('string');
        expect(typeof post.post_type).toBe('string');
        expect(typeof post.targeting).toBe('object');
        
        // Validate enum values
        expect(['message', 'announcement', 'request', 'performance_update']).toContain(post.post_type);
        
        // Validate formats
        expect(post.id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
        expect(post.tenant_id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
        expect(post.author_user_id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
        expect(post.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/); // ISO date
        
        // Author sub-object validation
        if (post.author) {
          expect(post.author).toMatchObject({
            id: expect.any(String),
            name: expect.any(String),
            email: expect.stringMatching(/^.+@.+\..+$/),
          });
        }
      });
    });
  });
});
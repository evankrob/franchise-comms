/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

/**
 * Contract Test: GET /api/auth/me
 * 
 * This test validates the API contract for the current user endpoint.
 * It must FAIL initially (TDD RED phase) since the endpoint doesn't exist yet.
 * 
 * API Contract from api-spec.yaml:
 * - Path: GET /auth/me
 * - Security: Bearer Auth required
 * - Response 200: User object with id, email, name, avatar_url, created_at
 * - Response 401: Unauthorized when no valid token
 */

// Mock Supabase for testing
jest.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: jest.fn(),
  getCurrentUser: jest.fn(),
}));

describe('Contract Test: GET /api/auth/me', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Required', () => {
    it('should return 401 when no authorization header provided', async () => {
      // Arrange: Create request without auth header
      const request = new NextRequest('http://localhost:3000/api/auth/me');

      // Act: Import and call the route handler
      // This will FAIL initially since the route doesn't exist yet (TDD RED phase)
      const { GET } = await import('@/app/api/auth/me/route');
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
      const request = new NextRequest('http://localhost:3000/api/auth/me', {
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
      const { GET } = await import('@/app/api/auth/me/route');
      const response = await GET(request);

      // Assert: Should return 401 Unauthorized
      expect(response.status).toBe(401);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Unauthorized',
        message: expect.any(String),
      });
    });
  });

  describe('Successful Authentication', () => {
    it('should return 200 with user profile when valid token provided', async () => {
      // Arrange: Mock successful authentication
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00.000Z',
        user_metadata: {
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.jpg',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      // Mock Supabase to return user
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Act: Call the route handler
      const { GET } = await import('@/app/api/auth/me/route');
      const response = await GET(request);

      // Assert: Should return 200 with user data matching API contract
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body).toMatchObject({
        id: expect.any(String),
        email: expect.stringMatching(/^.+@.+\..+$/), // Email format
        name: expect.any(String),
        avatar_url: expect.any(String),
        created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/), // ISO date
      });

      // Validate UUID format for id
      expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should return user data from database, not just auth payload', async () => {
      // Arrange: Mock user with additional database fields
      const mockAuthUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const mockDbUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User Updated',
        avatar_url: 'https://example.com/avatar-updated.jpg',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-15T12:30:00.000Z',
      };

      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      // Mock Supabase auth and database query
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      const mockClient = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockAuthUser },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockDbUser,
                error: null,
              }),
            }),
          }),
        }),
      };
      
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockClient);

      // Act: Call the route handler
      const { GET } = await import('@/app/api/auth/me/route');
      const response = await GET(request);

      // Assert: Should return database user data, not just auth payload
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body).toEqual(mockDbUser);

      // Verify database was queried
      expect(mockClient.from).toHaveBeenCalledWith('users');
    });
  });

  describe('API Contract Validation', () => {
    it('should return response matching OpenAPI schema structure', async () => {
      // This test ensures the response exactly matches the API contract
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2024-01-01T00:00:00.000Z',
      };

      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: { 'Authorization': 'Bearer valid-token' },
      });

      // Mock successful response
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUser,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const { GET } = await import('@/app/api/auth/me/route');
      const response = await GET(request);

      // Assert: Response structure matches OpenAPI User schema exactly
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');
      
      const body = await response.json();
      
      // Required fields from API spec
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('email');
      expect(body).toHaveProperty('name');
      
      // Optional fields from API spec
      expect(body).toHaveProperty('avatar_url');
      expect(body).toHaveProperty('created_at');
      
      // No unexpected fields should be present
      const expectedKeys = ['id', 'email', 'name', 'avatar_url', 'created_at', 'updated_at'];
      const actualKeys = Object.keys(body);
      actualKeys.forEach(key => {
        expect(expectedKeys).toContain(key);
      });
    });

    it('should handle database user not found gracefully', async () => {
      // Edge case: auth user exists but not in database
      const mockAuthUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: { 'Authorization': 'Bearer valid-token' },
      });

      // Mock auth success but database user not found
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockAuthUser },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'Row not found' },
              }),
            }),
          }),
        }),
      });

      // Act
      const { GET } = await import('@/app/api/auth/me/route');
      const response = await GET(request);

      // Assert: Should return 404 or auto-create user profile
      // (Implementation detail to be decided during implementation)
      expect([404, 200]).toContain(response.status);
    });
  });
});
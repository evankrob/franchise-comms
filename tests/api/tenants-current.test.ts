/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

/**
 * Contract Test: GET /api/tenants/current
 * 
 * This test validates the API contract for the current tenant endpoint.
 * It must FAIL initially (TDD RED phase) since the endpoint doesn't exist yet.
 * 
 * API Contract from api-spec.yaml:
 * - Path: GET /tenants/current
 * - Security: Bearer Auth required
 * - Response 200: Tenant object with id, name, slug, current_plan, status, settings
 * - Response 401: Unauthorized when no valid token
 */

// Mock Supabase for testing
jest.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: jest.fn(),
  getCurrentUser: jest.fn(),
}));

describe('Contract Test: GET /api/tenants/current', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Required', () => {
    it('should return 401 when no authorization header provided', async () => {
      // Arrange: Create request without auth header
      const request = new NextRequest('http://localhost:3000/api/tenants/current');

      // Act: Import and call the route handler
      // This will FAIL initially since the route doesn't exist yet (TDD RED phase)
      const { GET } = await import('@/app/api/tenants/current/route');
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
      const request = new NextRequest('http://localhost:3000/api/tenants/current', {
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
      const { GET } = await import('@/app/api/tenants/current/route');
      const response = await GET(request);

      // Assert: Should return 401 Unauthorized
      expect(response.status).toBe(401);
    });
  });

  describe('Successful Tenant Retrieval', () => {
    it('should return 200 with current tenant when valid token provided', async () => {
      // Arrange: Mock successful authentication and tenant lookup
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const mockTenant = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Acme Restaurant Group',
        slug: 'acme-restaurants',
        current_plan: 'growth',
        status: 'active',
        settings: {
          branding: { primaryColor: '#0066cc' },
          features: { advancedReporting: true },
        },
      };

      const request = new NextRequest('http://localhost:3000/api/tenants/current', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      // Mock Supabase authentication and tenant query
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock tenant lookup through membership
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { tenant: mockTenant },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act: Call the route handler
      const { GET } = await import('@/app/api/tenants/current/route');
      const response = await GET(request);

      // Assert: Should return 200 with tenant data matching API contract
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        slug: expect.any(String),
        current_plan: expect.stringMatching(/^(starter|growth|enterprise)$/),
        status: expect.stringMatching(/^(active|suspended|cancelled)$/),
        settings: expect.any(Object),
      });

      // Validate UUID format for id
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('should determine current tenant based on user membership', async () => {
      // Arrange: User with active membership
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const mockTenant = {
        id: 'tenant-789',
        name: 'Pizza Palace Franchise',
        slug: 'pizza-palace',
        current_plan: 'enterprise',
        status: 'active',
        settings: {},
      };

      const request = new NextRequest('http://localhost:3000/api/tenants/current', {
        headers: { 'Authorization': 'Bearer valid-token' },
      });

      // Mock Supabase
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock membership lookup with tenant join
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { tenant: mockTenant },
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
      const { GET } = await import('@/app/api/tenants/current/route');
      const response = await GET(request);

      // Assert: Should query memberships to find user's tenant
      expect(response.status).toBe(200);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('memberships');
      
      const body = await response.json();
      expect(body).toEqual(mockTenant);
    });

    it('should handle multi-tenant user with tenant selection logic', async () => {
      // Test case: User belongs to multiple tenants
      // Should return the "current" tenant based on some selection criteria
      // (e.g., most recent activity, primary tenant, etc.)
      
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'multi-tenant@example.com',
      };

      const request = new NextRequest('http://localhost:3000/api/tenants/current', {
        headers: { 'Authorization': 'Bearer valid-token' },
      });

      // Mock multiple tenant scenario
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock returning first/primary tenant
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { 
                      tenant: {
                        id: 'primary-tenant-id',
                        name: 'Primary Tenant',
                        slug: 'primary-tenant',
                        current_plan: 'growth',
                        status: 'active',
                        settings: {},
                      }
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
      const { GET } = await import('@/app/api/tenants/current/route');
      const response = await GET(request);

      // Assert: Should return primary tenant
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe('primary-tenant-id');
    });
  });

  describe('Edge Cases', () => {
    it('should return 404 when user has no tenant memberships', async () => {
      // Arrange: Authenticated user with no tenant access
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'orphan@example.com',
      };

      const request = new NextRequest('http://localhost:3000/api/tenants/current', {
        headers: { 'Authorization': 'Bearer valid-token' },
      });

      // Mock Supabase - user exists but no memberships
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
                    data: null,
                    error: { code: 'PGRST116', message: 'Row not found' },
                  }),
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/tenants/current/route');
      const response = await GET(request);

      // Assert: Should return 404 or appropriate error
      expect([404, 403]).toContain(response.status);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String),
      });
    });

    it('should return 403 when user membership is suspended', async () => {
      // Arrange: User with suspended membership
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'suspended@example.com',
      };

      const request = new NextRequest('http://localhost:3000/api/tenants/current', {
        headers: { 'Authorization': 'Bearer valid-token' },
      });

      // Mock suspended membership
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
                    data: null, // No active membership found
                    error: { code: 'PGRST116', message: 'Row not found' },
                  }),
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/tenants/current/route');
      const response = await GET(request);

      // Assert: Should return 403 Forbidden
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('API Contract Validation', () => {
    it('should return response matching OpenAPI Tenant schema exactly', async () => {
      // This test ensures the response exactly matches the API contract
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const mockTenant = {
        id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
        name: 'Contract Test Tenant',
        slug: 'contract-test',
        current_plan: 'starter',
        status: 'active',
        settings: {
          branding: { theme: 'light' },
          notifications: { email: true },
        },
      };

      const request = new NextRequest('http://localhost:3000/api/tenants/current', {
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
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { tenant: mockTenant },
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
      const { GET } = await import('@/app/api/tenants/current/route');
      const response = await GET(request);

      // Assert: Response structure matches OpenAPI Tenant schema exactly
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');
      
      const body = await response.json();
      
      // Required fields from API spec
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('slug');
      
      // Optional fields from API spec
      expect(body).toHaveProperty('current_plan');
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('settings');
      
      // Validate enum values
      expect(['starter', 'growth', 'enterprise']).toContain(body.current_plan);
      expect(['active', 'suspended', 'cancelled']).toContain(body.status);
      
      // Validate data types
      expect(typeof body.id).toBe('string');
      expect(typeof body.name).toBe('string');
      expect(typeof body.slug).toBe('string');
      expect(typeof body.settings).toBe('object');
      
      // No unexpected fields should be present
      const expectedKeys = ['id', 'name', 'slug', 'current_plan', 'status', 'settings'];
      const actualKeys = Object.keys(body);
      actualKeys.forEach(key => {
        expect(expectedKeys).toContain(key);
      });
    });
  });
});
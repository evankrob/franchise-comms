/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

/**
 * Contract Test: GET /api/locations
 * 
 * This test validates the API contract for the locations endpoint.
 * It must FAIL initially (TDD RED phase) since the endpoint doesn't exist yet.
 * 
 * API Contract from api-spec.yaml:
 * - Path: GET /locations
 * - Security: Bearer Auth required
 * - Query params: status (optional) - enum: [active, inactive]
 * - Response 200: { data: Location[] } with id, tenant_id, name, address, phone, email, status
 * - Response 401: Unauthorized when no valid token
 */

// Mock Supabase for testing
jest.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: jest.fn(),
  getCurrentUser: jest.fn(),
}));

describe('Contract Test: GET /api/locations', () => {
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
      const request = new NextRequest('http://localhost:3000/api/locations');

      // Act: Import and call the route handler
      // This will FAIL initially since the route doesn't exist yet (TDD RED phase)
      const { GET } = await import('@/app/api/locations/route');
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
      const request = new NextRequest('http://localhost:3000/api/locations', {
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
      const { GET } = await import('@/app/api/locations/route');
      const response = await GET(request);

      // Assert: Should return 401 Unauthorized
      expect(response.status).toBe(401);
    });
  });

  describe('Successful Location Retrieval', () => {
    it('should return 200 with locations array when valid token provided', async () => {
      // Arrange: Mock successful authentication and locations lookup
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const mockLocations = [
        {
          id: '789e0123-e89b-12d3-a456-426614174000',
          tenant_id: '456e7890-e89b-12d3-a456-426614174000',
          name: 'Downtown Location',
          address: '123 Main St, City, State 12345',
          phone: '(555) 123-4567',
          email: 'downtown@example.com',
          status: 'active',
        },
        {
          id: '111e2222-e89b-12d3-a456-426614174000',
          tenant_id: '456e7890-e89b-12d3-a456-426614174000',
          name: 'Uptown Location',
          address: '456 Oak Ave, City, State 12345',
          phone: '(555) 987-6543',
          email: 'uptown@example.com',
          status: 'active',
        },
      ];

      const request = new NextRequest('http://localhost:3000/api/locations', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      // Mock Supabase authentication and locations query
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock locations query - user can see locations through their tenant/location memberships
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'locations') {
          return {
            select: jest.fn().mockResolvedValue({
              data: mockLocations,
              error: null,
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act: Call the route handler
      const { GET } = await import('@/app/api/locations/route');
      const response = await GET(request);

      // Assert: Should return 200 with locations data matching API contract
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(2);

      // Validate each location matches API contract
      body.data.forEach((location: any) => {
        expect(location).toMatchObject({
          id: expect.any(String),
          tenant_id: expect.any(String),
          name: expect.any(String),
          address: expect.any(String),
          phone: expect.any(String),
          email: expect.stringMatching(/^.+@.+\..+$/), // Email format
          status: expect.stringMatching(/^(active|inactive)$/),
        });

        // Validate UUID format for ids
        expect(location.id).toMatch(/^[0-9a-f-]{36}$/i);
        expect(location.tenant_id).toMatch(/^[0-9a-f-]{36}$/i);
      });
    });

    it('should filter locations by status query parameter', async () => {
      // Arrange: Request with status filter
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const mockActiveLocations = [
        {
          id: 'loc-active-1',
          tenant_id: 'tenant-123',
          name: 'Active Location 1',
          address: '123 Active St',
          phone: '(555) 111-1111',
          email: 'active1@example.com',
          status: 'active',
        },
      ];

      const request = new NextRequest('http://localhost:3000/api/locations?status=active', {
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      });

      // Mock Supabase
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock filtered query
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'locations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: mockActiveLocations,
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/locations/route');
      const response = await GET(request);

      // Assert: Should return filtered results
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe('active');

      // Verify query was filtered
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('locations');
    });

    it('should return locations based on user access permissions (RLS)', async () => {
      // Test that users only see locations they have access to via RLS
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'franchisee@example.com',
      };

      const mockUserLocations = [
        {
          id: 'loc-user-can-see',
          tenant_id: 'tenant-123',
          name: 'Accessible Location',
          address: '999 Access St',
          phone: '(555) 999-9999',
          email: 'accessible@example.com',
          status: 'active',
        },
      ];

      const request = new NextRequest('http://localhost:3000/api/locations', {
        headers: { 'Authorization': 'Bearer valid-token' },
      });

      // Mock Supabase with RLS filtering
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock RLS-filtered query - user only sees their accessible locations
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'locations') {
          return {
            select: jest.fn().mockResolvedValue({
              data: mockUserLocations, // RLS automatically filters
              error: null,
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/locations/route');
      const response = await GET(request);

      // Assert: Should return only user-accessible locations
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe('loc-user-can-see');
    });
  });

  describe('Edge Cases', () => {
    it('should return empty array when user has no location access', async () => {
      // Arrange: User with no location memberships
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'no-access@example.com',
      };

      const request = new NextRequest('http://localhost:3000/api/locations', {
        headers: { 'Authorization': 'Bearer valid-token' },
      });

      // Mock Supabase - user authenticated but no location access
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'locations') {
          return {
            select: jest.fn().mockResolvedValue({
              data: [], // RLS returns empty array for no access
              error: null,
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/locations/route');
      const response = await GET(request);

      // Assert: Should return 200 with empty array
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body).toEqual({ data: [] });
    });

    it('should handle invalid status query parameter', async () => {
      // Arrange: Request with invalid status value
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const request = new NextRequest('http://localhost:3000/api/locations?status=invalid', {
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
      const { GET } = await import('@/app/api/locations/route');
      const response = await GET(request);

      // Assert: Should return 400 Bad Request for invalid enum value
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining('status'),
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange: Database error scenario
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const request = new NextRequest('http://localhost:3000/api/locations', {
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
        if (table === 'locations') {
          return {
            select: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed', code: '08000' },
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/locations/route');
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
      };

      const mockLocations = [
        {
          id: '789e0123-e89b-12d3-a456-426614174000',
          tenant_id: '456e7890-e89b-12d3-a456-426614174000',
          name: 'Contract Test Location',
          address: '123 Contract St, Test City, TS 12345',
          phone: '(555) 123-4567',
          email: 'contract@example.com',
          status: 'active',
        },
      ];

      const request = new NextRequest('http://localhost:3000/api/locations', {
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
        if (table === 'locations') {
          return {
            select: jest.fn().mockResolvedValue({
              data: mockLocations,
              error: null,
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/locations/route');
      const response = await GET(request);

      // Assert: Response structure matches OpenAPI schema exactly
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');
      
      const body = await response.json();
      
      // Root response structure
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
      
      // Location schema validation
      body.data.forEach((location: any) => {
        // Required fields from API spec
        expect(location).toHaveProperty('id');
        expect(location).toHaveProperty('tenant_id');
        expect(location).toHaveProperty('name');
        
        // Optional fields from API spec
        expect(location).toHaveProperty('address');
        expect(location).toHaveProperty('phone');
        expect(location).toHaveProperty('email');
        expect(location).toHaveProperty('status');
        
        // Validate data types
        expect(typeof location.id).toBe('string');
        expect(typeof location.tenant_id).toBe('string');
        expect(typeof location.name).toBe('string');
        expect(typeof location.address).toBe('string');
        expect(typeof location.phone).toBe('string');
        expect(typeof location.email).toBe('string');
        expect(typeof location.status).toBe('string');
        
        // Validate enum values
        expect(['active', 'inactive']).toContain(location.status);
        
        // Validate formats
        expect(location.email).toMatch(/^.+@.+\..+$/); // Email format
        expect(location.id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
        expect(location.tenant_id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
        
        // No unexpected fields should be present
        const expectedKeys = ['id', 'tenant_id', 'name', 'address', 'phone', 'email', 'status'];
        const actualKeys = Object.keys(location);
        actualKeys.forEach(key => {
          expect(expectedKeys).toContain(key);
        });
      });
    });

    it('should handle both status filter values correctly', async () => {
      // Test both active and inactive status filters
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const inactiveLocations = [
        {
          id: 'loc-inactive',
          tenant_id: 'tenant-123',
          name: 'Inactive Location',
          address: '456 Closed St',
          phone: '(555) 999-9999',
          email: 'inactive@example.com',
          status: 'inactive',
        },
      ];

      const request = new NextRequest('http://localhost:3000/api/locations?status=inactive', {
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
        if (table === 'locations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: inactiveLocations,
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import('@/app/api/locations/route');
      const response = await GET(request);

      // Assert: Should return inactive locations
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe('inactive');
    });
  });
});
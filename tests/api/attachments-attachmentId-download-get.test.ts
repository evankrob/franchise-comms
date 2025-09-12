/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

/**
 * Contract Test: GET /api/attachments/{attachmentId}/download
 * 
 * This test validates the API contract for downloading attachment files.
 * It must FAIL initially (TDD RED phase) since the endpoint doesn't exist yet.
 * 
 * API Contract from api-spec.yaml lines 647-662:
 * - Path: GET /attachments/{attachmentId}/download
 * - Security: Bearer Auth required
 * - Path Parameter: attachmentId (UUID format)
 * - Response 302: Redirect to download URL
 * - Response 401: Unauthorized when no valid token
 * - Response 404: Attachment not found or user cannot access attachment
 * 
 * Business Logic:
 * - Validates user has access to attachment (via post/comment permissions)
 * - Checks virus scan status (should only allow clean files)
 * - Generates temporary signed URL for secure download
 * - Returns 302 redirect to actual file location
 * - Must respect multi-tenant RLS policies
 */

// Mock Supabase for testing
jest.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: jest.fn(),
  getCurrentUser: jest.fn(),
}));

describe('Contract Test: GET /api/attachments/{attachmentId}/download', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    storage: {
      from: jest.fn().mockReturnThis(),
      createSignedUrl: jest.fn(),
      getPublicUrl: jest.fn(),
    },
  };

  const validAttachmentId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Required', () => {
    it('should return 401 when no authorization header provided', async () => {
      // Arrange: Create request without auth header
      const request = new NextRequest(
        `http://localhost:3000/api/attachments/${validAttachmentId}/download`
      );

      // Act: Import and call the route handler
      // This will FAIL initially since the route doesn't exist yet (TDD RED phase)
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: validAttachmentId } });

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
        `http://localhost:3000/api/attachments/${validAttachmentId}/download`,
        {
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
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: validAttachmentId } });

      // Assert: Should return 401 Unauthorized
      expect(response.status).toBe(401);
    });
  });

  describe('Path Parameter Validation', () => {
    it('should return 400 for invalid attachmentId UUID format', async () => {
      // Arrange: Create request with invalid attachment ID in path
      const invalidAttachmentId = 'invalid-uuid';
      const request = new NextRequest(
        `http://localhost:3000/api/attachments/${invalidAttachmentId}/download`,
        {
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
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: invalidAttachmentId } });

      // Assert: Should return 400 Bad Request for invalid attachment ID format
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('attachmentId'),
      });
    });
  });

  describe('Attachment Access Validation', () => {
    it('should return 404 when attachment does not exist', async () => {
      // Arrange: Mock attachment not found
      const nonExistentAttachmentId = '550e8400-e29b-41d4-a716-446655440099';
      const request = new NextRequest(
        `http://localhost:3000/api/attachments/${nonExistentAttachmentId}/download`,
        {
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      // Mock authentication and attachment lookup
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock attachment not found
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'attachments') {
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
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: nonExistentAttachmentId } });

      // Assert: Should return 404 Not Found
      expect(response.status).toBe(404);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Not Found',
        message: expect.stringContaining('attachment'),
      });
    });

    it('should return 403 when user cannot access attachment due to RLS', async () => {
      // Arrange: Mock attachment exists but user has no access due to RLS
      const request = new NextRequest(
        `http://localhost:3000/api/attachments/${validAttachmentId}/download`,
        {
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
        if (table === 'attachments') {
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
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: validAttachmentId } });

      // Assert: Should return 403 Forbidden (or 404 to not leak existence)
      expect([403, 404]).toContain(response.status);
    });

    it('should return 403 when user cannot access post containing attachment', async () => {
      // Arrange: Attachment belongs to post user cannot access
      const request = new NextRequest(
        `http://localhost:3000/api/attachments/${validAttachmentId}/download`,
        {
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = {
        id: 'restricted-user-123',
        email: 'restricted@example.com',
      };

      const mockAttachment = {
        id: validAttachmentId,
        tenant_id: 'tenant-123',
        post_id: 'restricted-post-456',
        comment_id: null,
        filename: 'restricted-file.pdf',
        virus_scan_status: 'clean',
      };

      // Mock authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock attachment exists but post is restricted
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'attachments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAttachment,
                  error: null,
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
                  data: null, // RLS blocked access to post
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: validAttachmentId } });

      // Assert: Should return 403 Forbidden
      expect([403, 404]).toContain(response.status);
    });

    it('should return 403 when user cannot access comment containing attachment', async () => {
      // Arrange: Attachment belongs to comment user cannot access
      const request = new NextRequest(
        `http://localhost:3000/api/attachments/${validAttachmentId}/download`,
        {
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = {
        id: 'restricted-user-123',
        email: 'restricted@example.com',
      };

      const mockAttachment = {
        id: validAttachmentId,
        tenant_id: 'tenant-123',
        post_id: null,
        comment_id: 'restricted-comment-456',
        filename: 'restricted-file.pdf',
        virus_scan_status: 'clean',
      };

      // Mock authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock attachment exists but comment is restricted
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'attachments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAttachment,
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
                single: jest.fn().mockResolvedValue({
                  data: null, // RLS blocked access to comment
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: validAttachmentId } });

      // Assert: Should return 403 Forbidden
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Virus Scan Status Validation', () => {
    it('should return 403 when attachment has infected virus scan status', async () => {
      // Arrange: Mock infected attachment
      const request = new NextRequest(
        `http://localhost:3000/api/attachments/${validAttachmentId}/download`,
        {
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const mockAttachment = {
        id: validAttachmentId,
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
        post_id: 'post-456',
        comment_id: null,
        filename: 'infected-file.exe',
        virus_scan_status: 'infected', // Infected file
      };

      const mockPost = {
        id: 'post-456',
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
      };

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'attachments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAttachment,
                  error: null,
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
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: validAttachmentId } });

      // Assert: Should return 403 Forbidden for infected file
      expect(response.status).toBe(403);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Forbidden',
        message: expect.stringContaining('virus'),
      });
    });

    it('should return 423 when attachment is still being scanned', async () => {
      // Arrange: Mock attachment with pending virus scan
      const request = new NextRequest(
        `http://localhost:3000/api/attachments/${validAttachmentId}/download`,
        {
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const mockAttachment = {
        id: validAttachmentId,
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
        post_id: 'post-456',
        comment_id: null,
        filename: 'pending-scan.pdf',
        virus_scan_status: 'pending', // Still being scanned
      };

      const mockPost = {
        id: 'post-456',
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
      };

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'attachments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAttachment,
                  error: null,
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
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: validAttachmentId } });

      // Assert: Should return 423 Locked for pending scan
      expect([423, 202]).toContain(response.status); // 423 Locked or 202 Processing
      
      const body = await response.json();
      expect(body).toMatchObject({
        message: expect.stringContaining('scan'),
      });
    });
  });

  describe('Successful Download Redirect', () => {
    it('should return 302 redirect for post attachment with clean virus scan', async () => {
      // Arrange: Valid request for clean post attachment
      const request = new NextRequest(
        `http://localhost:3000/api/attachments/${validAttachmentId}/download`,
        {
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

      const mockAttachment = {
        id: validAttachmentId,
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
        post_id: 'post-456e4567-e89b-12d3-a456-426614174000',
        comment_id: null,
        filename: 'document.pdf',
        original_filename: 'Important Document.pdf',
        file_size: 2048,
        mime_type: 'application/pdf',
        virus_scan_status: 'clean',
      };

      const mockPost = {
        id: 'post-456e4567-e89b-12d3-a456-426614174000',
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
        author_user_id: 'author-789',
      };

      const signedUrl = 'https://storage.example.com/attachments/document.pdf?signature=abc123&expires=1234567890';

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'attachments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAttachment,
                  error: null,
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
        return mockSupabaseClient;
      });

      // Mock storage signed URL generation
      mockSupabaseClient.storage.from.mockReturnValue({
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl },
          error: null,
        }),
      });

      // Act
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: validAttachmentId } });

      // Assert: Should return 302 redirect
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(signedUrl);
    });

    it('should return 302 redirect for comment attachment with clean virus scan', async () => {
      // Arrange: Valid request for clean comment attachment
      const request = new NextRequest(
        `http://localhost:3000/api/attachments/${validAttachmentId}/download`,
        {
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const mockAttachment = {
        id: validAttachmentId,
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
        post_id: null,
        comment_id: 'comment-456e4567-e89b-12d3-a456-426614174000',
        filename: 'spreadsheet.xlsx',
        virus_scan_status: 'clean',
      };

      const mockComment = {
        id: 'comment-456e4567-e89b-12d3-a456-426614174000',
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
        post_id: 'post-789',
        author_user_id: 'author-123',
      };

      const mockPost = {
        id: 'post-789',
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
      };

      const signedUrl = 'https://storage.example.com/attachments/spreadsheet.xlsx?signature=def456&expires=1234567890';

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'attachments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAttachment,
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
                single: jest.fn().mockResolvedValue({
                  data: mockComment,
                  error: null,
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
        return mockSupabaseClient;
      });

      // Mock storage signed URL generation
      mockSupabaseClient.storage.from.mockReturnValue({
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl },
          error: null,
        }),
      });

      // Act
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: validAttachmentId } });

      // Assert: Should return 302 redirect
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(signedUrl);
    });

    it('should return 302 redirect for standalone attachment with clean virus scan', async () => {
      // Arrange: Valid request for clean standalone attachment (no post_id or comment_id)
      const request = new NextRequest(
        `http://localhost:3000/api/attachments/${validAttachmentId}/download`,
        {
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
      };

      const mockAttachment = {
        id: validAttachmentId,
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
        post_id: null,
        comment_id: null,
        filename: 'standalone-image.png',
        virus_scan_status: 'clean',
      };

      const signedUrl = 'https://storage.example.com/attachments/standalone-image.png?signature=ghi789&expires=1234567890';

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'attachments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAttachment,
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Mock storage signed URL generation
      mockSupabaseClient.storage.from.mockReturnValue({
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl },
          error: null,
        }),
      });

      // Act
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: validAttachmentId } });

      // Assert: Should return 302 redirect
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(signedUrl);
    });

    it('should generate temporary signed URLs with expiration', async () => {
      // Arrange: Test that signed URLs are temporary and expire
      const request = new NextRequest(
        `http://localhost:3000/api/attachments/${validAttachmentId}/download`,
        {
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockAttachment = {
        id: validAttachmentId,
        tenant_id: 'tenant-123',
        post_id: null,
        comment_id: null,
        filename: 'temp-url-test.pdf',
        virus_scan_status: 'clean',
      };

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'attachments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAttachment,
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Mock storage signed URL generation with expiration
      let createSignedUrlCalled = false;
      let requestedExpiration = 0;
      mockSupabaseClient.storage.from.mockReturnValue({
        createSignedUrl: jest.fn().mockImplementation((path, expiresIn) => {
          createSignedUrlCalled = true;
          requestedExpiration = expiresIn;
          return Promise.resolve({
            data: { signedUrl: `https://storage.example.com/${path}?expires=${Date.now() + expiresIn * 1000}` },
            error: null,
          });
        }),
      });

      // Act
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: validAttachmentId } });

      // Assert: Should generate temporary signed URL
      expect(response.status).toBe(302);
      expect(createSignedUrlCalled).toBe(true);
      expect(requestedExpiration).toBeGreaterThan(0);
      expect(requestedExpiration).toBeLessThanOrEqual(3600); // Should expire within 1 hour
      
      const location = response.headers.get('location');
      expect(location).toContain('expires=');
    });
  });

  describe('Multi-tenant Security', () => {
    it('should respect RLS policies for cross-tenant attachment access', async () => {
      // Arrange: User tries to access attachment from different tenant
      const request = new NextRequest(
        `http://localhost:3000/api/attachments/${validAttachmentId}/download`,
        {
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = {
        id: 'user-tenant-a',
        email: 'user@tenant-a.com',
      };

      // Mock authentication - user from different tenant
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock RLS preventing cross-tenant access
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'attachments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null, // RLS blocked access to different tenant's attachment
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: validAttachmentId } });

      // Assert: Should prevent cross-tenant access
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle storage signed URL generation errors gracefully', async () => {
      // Arrange: Mock storage error during signed URL generation
      const request = new NextRequest(
        `http://localhost:3000/api/attachments/${validAttachmentId}/download`,
        {
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockAttachment = {
        id: validAttachmentId,
        tenant_id: 'tenant-123',
        post_id: null,
        comment_id: null,
        filename: 'error-file.pdf',
        virus_scan_status: 'clean',
      };

      // Mock authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'attachments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAttachment,
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Mock storage error
      mockSupabaseClient.storage.from.mockReturnValue({
        createSignedUrl: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Storage service unavailable' },
        }),
      });

      // Act
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: validAttachmentId } });

      // Assert: Should return 500 Internal Server Error
      expect(response.status).toBe(500);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Internal Server Error',
        message: expect.any(String),
      });
    });

    it('should handle database query errors gracefully', async () => {
      // Arrange: Mock database error during attachment lookup
      const request = new NextRequest(
        `http://localhost:3000/api/attachments/${validAttachmentId}/download`,
        {
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

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
        if (table === 'attachments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database connection failed' },
                }),
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: validAttachmentId } });

      // Assert: Should return 500 Internal Server Error
      expect(response.status).toBe(500);
    });
  });

  describe('API Contract Validation', () => {
    it('should return 302 redirect matching OpenAPI specification exactly', async () => {
      // This test ensures the response exactly matches the API contract
      const request = new NextRequest(
        `http://localhost:3000/api/attachments/${validAttachmentId}/download`,
        {
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

      const mockAttachment = {
        id: validAttachmentId,
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
        post_id: 'post-456e4567-e89b-12d3-a456-426614174000',
        comment_id: null,
        filename: 'contract-test-file.pdf',
        original_filename: 'Contract Test Document.pdf',
        file_size: 4096,
        mime_type: 'application/pdf',
        virus_scan_status: 'clean',
        created_at: '2024-01-01T10:00:00.000Z',
      };

      const mockPost = {
        id: 'post-456e4567-e89b-12d3-a456-426614174000',
        tenant_id: 'tenant-123e4567-e89b-12d3-a456-426614174000',
      };

      const expectedSignedUrl = 'https://storage.supabase.co/object/sign/attachments/contract-test-file.pdf?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9&expires=1640995200';

      // Mock successful response
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'attachments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAttachment,
                  error: null,
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
        return mockSupabaseClient;
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: expectedSignedUrl },
          error: null,
        }),
      });

      // Act
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: validAttachmentId } });

      // Assert: Response matches OpenAPI specification exactly (302 redirect)
      expect(response.status).toBe(302);
      
      // Validate redirect headers
      const location = response.headers.get('location');
      expect(location).toBe(expectedSignedUrl);
      expect(location).toMatch(/^https?:\/\//); // Should be valid URL
      
      // The OpenAPI spec specifies 302 redirect, no response body expected
      // Some responses might be empty or minimal for redirects
    });

    it('should validate download security and access control flow', async () => {
      // Test the complete access control flow as specified in business logic
      const request = new NextRequest(
        `http://localhost:3000/api/attachments/${validAttachmentId}/download`,
        {
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        }
      );

      const mockUser = { id: 'security-test-user', email: 'security@example.com' };
      const mockAttachment = {
        id: validAttachmentId,
        tenant_id: 'tenant-security-test',
        post_id: 'post-security-test',
        comment_id: null,
        filename: 'security-test.pdf',
        virus_scan_status: 'clean',
      };
      const mockPost = {
        id: 'post-security-test',
        tenant_id: 'tenant-security-test',
      };

      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Track the security checks performed
      const securityChecks = {
        attachmentAccess: false,
        postAccess: false,
        virusScanCheck: false,
        signedUrlGeneration: false,
      };

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'attachments') {
          securityChecks.attachmentAccess = true;
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockAttachment,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'posts') {
          securityChecks.postAccess = true;
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
        return mockSupabaseClient;
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        createSignedUrl: jest.fn().mockImplementation(() => {
          securityChecks.signedUrlGeneration = true;
          return Promise.resolve({
            data: { signedUrl: 'https://secure.example.com/download' },
            error: null,
          });
        }),
      });

      // Act
      const { GET } = await import(`@/app/api/attachments/[attachmentId]/download/route`);
      const response = await GET(request, { params: { attachmentId: validAttachmentId } });

      // Assert: All security checks should have been performed
      expect(response.status).toBe(302);
      expect(securityChecks.attachmentAccess).toBe(true); // Attachment RLS check
      expect(securityChecks.postAccess).toBe(true); // Post access validation
      // Virus scan check is implicit in the attachment data validation
      expect(securityChecks.signedUrlGeneration).toBe(true); // Secure URL generation
    });
  });
});
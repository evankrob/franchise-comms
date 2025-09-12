/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

/**
 * Contract Test: POST /api/uploads
 * 
 * This test validates the API contract for file upload endpoint.
 * It must FAIL initially (TDD RED phase) since the endpoint doesn't exist yet.
 * 
 * API Contract from api-spec.yaml lines 616-645:
 * - Path: POST /uploads
 * - Security: Bearer Auth required
 * - Content-Type: multipart/form-data
 * - Required Fields: file (binary)
 * - Optional Fields: post_id (UUID), comment_id (UUID)
 * - Response 201: Attachment object with id, filename, file_size, mime_type, download_url, etc.
 * - Response 400: Invalid request (no file, invalid UUIDs)
 * - Response 401: Unauthorized when no valid token
 * - Response 413: File too large
 * 
 * Business Logic:
 * - Accepts file uploads for posts or comments
 * - Performs virus scanning (pending -> clean/infected status)
 * - Generates secure download URLs
 * - Tracks original filename and generated filename
 * - Must respect file size limits and allowed MIME types
 * - Must respect multi-tenant RLS policies
 */

// Mock Supabase for testing
jest.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: jest.fn(),
  getCurrentUser: jest.fn(),
}));

describe('Contract Test: POST /api/uploads', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    storage: {
      from: jest.fn().mockReturnThis(),
      upload: jest.fn(),
      getPublicUrl: jest.fn(),
    },
  };

  // Mock file data for testing
  const createMockFile = (filename: string, mimeType: string, size: number = 1024) => {
    const buffer = Buffer.alloc(size, 'test file content');
    return new File([buffer], filename, { type: mimeType });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Required', () => {
    it('should return 401 when no authorization header provided', async () => {
      // Arrange: Create multipart form request without auth header
      const formData = new FormData();
      formData.append('file', createMockFile('test.pdf', 'application/pdf'));

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        body: formData,
      });

      // Act: Import and call the route handler
      // This will FAIL initially since the route doesn't exist yet (TDD RED phase)
      const { POST } = await import('@/app/api/uploads/route');
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
      // Arrange: Create multipart form request with invalid token
      const formData = new FormData();
      formData.append('file', createMockFile('document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
        body: formData,
      });

      // Mock Supabase to return auth error
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid JWT' },
      });

      // Act: Call the route handler
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Should return 401 Unauthorized
      expect(response.status).toBe(401);
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when no file is provided', async () => {
      // Arrange: Create form request without file
      const formData = new FormData();
      // No file appended

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: formData,
      });

      // Mock successful authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Act
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Should return 400 Bad Request
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('file'),
      });
    });

    it('should return 400 when file is empty', async () => {
      // Arrange: Create form request with empty file
      const formData = new FormData();
      formData.append('file', createMockFile('empty.txt', 'text/plain', 0)); // 0 bytes

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: formData,
      });

      // Mock successful authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Act
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Should return 400 Bad Request for empty file
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('empty'),
      });
    });

    it('should return 400 for invalid post_id UUID format', async () => {
      // Arrange: Create form request with invalid post_id
      const formData = new FormData();
      formData.append('file', createMockFile('image.jpg', 'image/jpeg'));
      formData.append('post_id', 'invalid-uuid-format');

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: formData,
      });

      // Mock successful authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Act
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Should return 400 Bad Request for invalid UUID format
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('post_id'),
      });
    });

    it('should return 400 for invalid comment_id UUID format', async () => {
      // Arrange: Create form request with invalid comment_id
      const formData = new FormData();
      formData.append('file', createMockFile('video.mp4', 'video/mp4'));
      formData.append('comment_id', 'invalid-uuid-format');

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: formData,
      });

      // Mock successful authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Act
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Should return 400 Bad Request for invalid UUID format
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('comment_id'),
      });
    });

    it('should return 413 when file exceeds size limit', async () => {
      // Arrange: Create form request with oversized file (e.g., 100MB)
      const formData = new FormData();
      formData.append('file', createMockFile('huge-file.zip', 'application/zip', 100 * 1024 * 1024)); // 100MB

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: formData,
      });

      // Mock successful authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Act
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Should return 413 File Too Large
      expect(response.status).toBe(413);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'File Too Large',
        message: expect.any(String),
      });
    });

    it('should return 400 for unsupported MIME type', async () => {
      // Arrange: Create form request with unsupported file type
      const formData = new FormData();
      formData.append('file', createMockFile('malware.exe', 'application/x-msdownload')); // Executable file

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: formData,
      });

      // Mock successful authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Act
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Should return 400 Bad Request for unsupported file type
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('type'),
      });
    });
  });

  describe('Successful File Upload', () => {
    it('should upload file without post_id or comment_id successfully', async () => {
      // Arrange: Valid file upload request
      const formData = new FormData();
      const testFile = createMockFile('document.pdf', 'application/pdf', 2048);
      formData.append('file', testFile);

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: formData,
      });

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
      };

      const mockAttachment = {
        id: '789e0123-e89b-12d3-a456-426614174000',
        tenant_id: '456e7890-e89b-12d3-a456-426614174000',
        post_id: null,
        comment_id: null,
        filename: '789e0123-e89b-12d3-a456-426614174000.pdf',
        original_filename: 'document.pdf',
        file_size: 2048,
        mime_type: 'application/pdf',
        download_url: 'https://storage.example.com/attachments/789e0123-e89b-12d3-a456-426614174000.pdf',
        virus_scan_status: 'pending',
        created_at: '2024-01-01T10:00:00.000Z',
      };

      // Mock authentication and file operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock storage operations
      mockSupabaseClient.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'attachments/attachment-123.pdf' },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: mockAttachment.download_url },
        }),
      });

      // Mock database insert
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'attachments') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [mockAttachment],
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Should return 201 with attachment data
      expect(response.status).toBe(201);
      expect(response.headers.get('content-type')).toBe('application/json');
      
      const body = await response.json();
      expect(body).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        tenant_id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        post_id: null,
        comment_id: null,
        filename: expect.any(String),
        original_filename: 'document.pdf',
        file_size: 2048,
        mime_type: 'application/pdf',
        download_url: expect.stringMatching(/^https?:\/\//),
        virus_scan_status: 'pending',
        created_at: expect.any(String),
      });
    });

    it('should upload file with post_id successfully', async () => {
      // Arrange: Valid file upload for a post
      const postId = '550e8400-e29b-41d4-a716-446655440000';
      const formData = new FormData();
      formData.append('file', createMockFile('image.png', 'image/png', 1024));
      formData.append('post_id', postId);

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: formData,
      });

      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockPost = { id: postId, tenant_id: 'tenant-123' };

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock post access check
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
        if (table === 'attachments') {
          return {
            insert: jest.fn().mockImplementation((data) => {
              insertedData = data;
              return {
                select: jest.fn().mockResolvedValue({
                  data: [{ 
                    ...data, 
                    id: 'attachment-123',
                    download_url: 'https://example.com/file.png',
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

      // Mock storage upload
      mockSupabaseClient.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'attachments/image.png' },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/file.png' },
        }),
      });

      // Act
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Should link to post correctly
      expect(response.status).toBe(201);
      expect(insertedData).toMatchObject({
        tenant_id: mockPost.tenant_id,
        post_id: postId,
        comment_id: null,
        original_filename: 'image.png',
        mime_type: 'image/png',
        file_size: 1024,
      });
    });

    it('should upload file with comment_id successfully', async () => {
      // Arrange: Valid file upload for a comment
      const commentId = '550e8400-e29b-41d4-a716-446655440000';
      const formData = new FormData();
      formData.append('file', createMockFile('spreadsheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 4096));
      formData.append('comment_id', commentId);

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: formData,
      });

      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockComment = { id: commentId, tenant_id: 'tenant-123', post_id: 'post-456' };

      // Mock authentication and database operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock comment access check
      let insertedData: any = null;
      mockSupabaseClient.from.mockImplementation((table) => {
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
        if (table === 'attachments') {
          return {
            insert: jest.fn().mockImplementation((data) => {
              insertedData = data;
              return {
                select: jest.fn().mockResolvedValue({
                  data: [{ 
                    ...data, 
                    id: 'attachment-456',
                    download_url: 'https://example.com/spreadsheet.xlsx',
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

      // Mock storage upload
      mockSupabaseClient.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'attachments/spreadsheet.xlsx' },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/spreadsheet.xlsx' },
        }),
      });

      // Act
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Should link to comment correctly
      expect(response.status).toBe(201);
      expect(insertedData).toMatchObject({
        tenant_id: mockComment.tenant_id,
        post_id: null,
        comment_id: commentId,
        original_filename: 'spreadsheet.xlsx',
        file_size: 4096,
      });
    });

    it('should handle various supported file types correctly', async () => {
      // Test multiple supported MIME types
      const supportedFiles = [
        { filename: 'document.pdf', mimeType: 'application/pdf' },
        { filename: 'image.jpg', mimeType: 'image/jpeg' },
        { filename: 'image.png', mimeType: 'image/png' },
        { filename: 'document.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        { filename: 'spreadsheet.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        { filename: 'text.txt', mimeType: 'text/plain' },
      ];

      for (const fileInfo of supportedFiles) {
        const formData = new FormData();
        formData.append('file', createMockFile(fileInfo.filename, fileInfo.mimeType));

        const request = new NextRequest('http://localhost:3000/api/uploads', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid-token',
          },
          body: formData,
        });

        const mockUser = { id: 'user-123', email: 'test@example.com' };

        // Mock successful operations
        const { createSupabaseServerClient } = await import('@/lib/supabase-server');
        (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
        
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        mockSupabaseClient.storage.from.mockReturnValue({
          upload: jest.fn().mockResolvedValue({
            data: { path: `attachments/${fileInfo.filename}` },
            error: null,
          }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: { publicUrl: `https://example.com/${fileInfo.filename}` },
          }),
        });

        mockSupabaseClient.from.mockImplementation((table) => {
          if (table === 'attachments') {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockResolvedValue({
                  data: [{ 
                    id: `attachment-${fileInfo.filename}`,
                    mime_type: fileInfo.mimeType,
                    original_filename: fileInfo.filename 
                  }],
                  error: null,
                }),
              }),
            };
          }
          return mockSupabaseClient;
        });

        // Act
        const { POST } = await import('@/app/api/uploads/route');
        const response = await POST(request);

        // Assert: Each supported file type should upload successfully
        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.mime_type).toBe(fileInfo.mimeType);
        expect(body.original_filename).toBe(fileInfo.filename);
      }
    });
  });

  describe('Access Control and Security', () => {
    it('should return 404 when referenced post does not exist', async () => {
      // Arrange: Upload file for non-existent post
      const nonExistentPostId = '550e8400-e29b-41d4-a716-446655440099';
      const formData = new FormData();
      formData.append('file', createMockFile('test.pdf', 'application/pdf'));
      formData.append('post_id', nonExistentPostId);

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: formData,
      });

      const mockUser = { id: 'user-123', email: 'test@example.com' };

      // Mock authentication and post lookup
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
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Should return 404 Not Found
      expect(response.status).toBe(404);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Not Found',
        message: expect.stringContaining('post'),
      });
    });

    it('should return 403 when user cannot access referenced post due to RLS', async () => {
      // Arrange: Upload file for post user cannot access
      const restrictedPostId = '550e8400-e29b-41d4-a716-446655440000';
      const formData = new FormData();
      formData.append('file', createMockFile('secret.pdf', 'application/pdf'));
      formData.append('post_id', restrictedPostId);

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: formData,
      });

      const mockUser = { id: 'unauthorized-user', email: 'unauthorized@example.com' };

      // Mock authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock RLS blocking access
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
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Should return 403 Forbidden (or 404 to not leak existence)
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Multi-tenant Security', () => {
    it('should automatically set tenant_id from user membership', async () => {
      // Arrange: Upload file and verify tenant_id is set correctly
      const formData = new FormData();
      formData.append('file', createMockFile('tenant-file.pdf', 'application/pdf'));

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: formData,
      });

      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const expectedTenantId = '456e7890-e89b-12d3-a456-426614174000';

      // Mock authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock tenant lookup through membership
      let insertedData: any = null;
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { tenant: { id: expectedTenantId } },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'attachments') {
          return {
            insert: jest.fn().mockImplementation((data) => {
              insertedData = data;
              return {
                select: jest.fn().mockResolvedValue({
                  data: [{ ...data, id: 'attachment-123' }],
                  error: null,
                }),
              };
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Mock storage operations
      mockSupabaseClient.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'attachments/file.pdf' },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/file.pdf' },
        }),
      });

      // Act
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Should set correct tenant_id
      expect(response.status).toBe(201);
      expect(insertedData).toMatchObject({
        tenant_id: expectedTenantId,
        original_filename: 'tenant-file.pdf',
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle storage upload errors gracefully', async () => {
      // Arrange: Mock storage error during file upload
      const formData = new FormData();
      formData.append('file', createMockFile('error-file.pdf', 'application/pdf'));

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: formData,
      });

      const mockUser = { id: 'user-123', email: 'test@example.com' };

      // Mock authentication
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock storage error
      mockSupabaseClient.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Storage quota exceeded' },
        }),
      });

      // Act
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Should return 500 Internal Server Error
      expect(response.status).toBe(500);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Internal Server Error',
        message: expect.any(String),
      });
    });

    it('should handle database insertion errors gracefully', async () => {
      // Arrange: Mock database error during attachment record creation
      const formData = new FormData();
      formData.append('file', createMockFile('db-error.pdf', 'application/pdf'));

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: formData,
      });

      const mockUser = { id: 'user-123', email: 'test@example.com' };

      // Mock authentication and storage operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'attachments/file.pdf' },
          error: null,
        }),
      });

      // Mock database error
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'attachments') {
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
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Should return 500 Internal Server Error
      expect(response.status).toBe(500);
    });

    it('should handle malformed multipart form data', async () => {
      // Arrange: Request with malformed form data
      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'multipart/form-data; boundary=invalid',
        },
        body: 'malformed form data',
      });

      // Act
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Should return 400 Bad Request for malformed form data
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('form'),
      });
    });
  });

  describe('API Contract Validation', () => {
    it('should return response matching OpenAPI Attachment schema exactly', async () => {
      // This test ensures the response exactly matches the API contract
      const formData = new FormData();
      formData.append('file', createMockFile('contract-test.pdf', 'application/pdf', 1536));

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: formData,
      });

      const mockUser = {
        id: 'user-123e4567-e89b-12d3-a456-426614174000',
        email: 'contract@example.com',
        name: 'Contract User',
      };

      const mockAttachment = {
        id: '789e0123-e89b-12d3-a456-426614174000',
        tenant_id: '456e7890-e89b-12d3-a456-426614174000',
        post_id: null,
        comment_id: null,
        filename: '789e0123-e89b-12d3-a456-426614174000.pdf',
        original_filename: 'contract-test.pdf',
        file_size: 1536,
        mime_type: 'application/pdf',
        download_url: 'https://storage.example.com/attachments/789e0123-e89b-12d3-a456-426614174000.pdf',
        virus_scan_status: 'pending',
        created_at: '2024-01-01T10:00:00.000Z',
      };

      // Mock successful response
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'attachments/attachment-123.pdf' },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: mockAttachment.download_url },
        }),
      });

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'attachments') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [mockAttachment],
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseClient;
      });

      // Act
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Response structure matches OpenAPI Attachment schema exactly
      expect(response.status).toBe(201);
      expect(response.headers.get('content-type')).toBe('application/json');
      
      const body = await response.json();
      
      // Required fields from API spec (lines 187-220)
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('tenant_id');
      expect(body).toHaveProperty('filename');
      expect(body).toHaveProperty('file_size');
      expect(body).toHaveProperty('mime_type');
      
      // Optional fields from API spec
      expect(body).toHaveProperty('post_id');
      expect(body).toHaveProperty('comment_id');
      expect(body).toHaveProperty('original_filename');
      expect(body).toHaveProperty('download_url');
      expect(body).toHaveProperty('virus_scan_status');
      expect(body).toHaveProperty('created_at');
      
      // Validate data types and formats
      expect(typeof body.id).toBe('string');
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
      expect(typeof body.tenant_id).toBe('string');
      expect(body.tenant_id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
      expect(typeof body.filename).toBe('string');
      expect(typeof body.original_filename).toBe('string');
      expect(typeof body.file_size).toBe('number');
      expect(body.file_size).toBeGreaterThan(0);
      expect(typeof body.mime_type).toBe('string');
      expect(typeof body.download_url).toBe('string');
      expect(body.download_url).toMatch(/^https?:\/\//); // URI format
      expect(['pending', 'clean', 'infected']).toContain(body.virus_scan_status);
      expect(typeof body.created_at).toBe('string');
      expect(body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO date format
      
      // Validate nullable fields
      expect(body.post_id === null || typeof body.post_id === 'string').toBe(true);
      expect(body.comment_id === null || typeof body.comment_id === 'string').toBe(true);
      if (body.post_id) expect(body.post_id).toMatch(/^[0-9a-f-]{36}$/i);
      if (body.comment_id) expect(body.comment_id).toMatch(/^[0-9a-f-]{36}$/i);
      
      // No unexpected fields should be present
      const expectedKeys = [
        'id', 'tenant_id', 'post_id', 'comment_id', 'filename', 
        'original_filename', 'file_size', 'mime_type', 'download_url', 
        'virus_scan_status', 'created_at'
      ];
      const actualKeys = Object.keys(body);
      actualKeys.forEach(key => {
        expect(expectedKeys).toContain(key);
      });
    });

    it('should initiate virus scanning with pending status', async () => {
      // Test that uploaded files start with pending virus scan status
      const formData = new FormData();
      formData.append('file', createMockFile('virus-scan-test.pdf', 'application/pdf'));

      const request = new NextRequest('http://localhost:3000/api/uploads', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
        body: formData,
      });

      const mockUser = { id: 'user-123', email: 'test@example.com' };

      // Mock successful operations
      const { createSupabaseServerClient } = await import('@/lib/supabase-server');
      (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      let insertedScanStatus: string | null = null;
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'attachments') {
          return {
            insert: jest.fn().mockImplementation((data) => {
              insertedScanStatus = data.virus_scan_status;
              return {
                select: jest.fn().mockResolvedValue({
                  data: [{ 
                    ...data, 
                    id: 'attachment-virus-test',
                    virus_scan_status: 'pending' 
                  }],
                  error: null,
                }),
              };
            }),
          };
        }
        return mockSupabaseClient;
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'attachments/virus-test.pdf' },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/virus-test.pdf' },
        }),
      });

      // Act
      const { POST } = await import('@/app/api/uploads/route');
      const response = await POST(request);

      // Assert: Should set virus scan status to pending
      expect(response.status).toBe(201);
      expect(insertedScanStatus).toBe('pending');
      
      const body = await response.json();
      expect(body.virus_scan_status).toBe('pending');
    });
  });
});
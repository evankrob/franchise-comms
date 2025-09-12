import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

/**
 * POST /api/uploads
 * 
 * Handles file uploads for posts or comments.
 * Supports virus scanning, access control, and multi-tenant security.
 * 
 * Request:
 * - Content-Type: multipart/form-data
 * - Required: file (binary)
 * - Optional: post_id (UUID), comment_id (UUID)
 * 
 * Responses:
 * - 201: Attachment created successfully
 * - 400: Bad Request (validation errors)
 * - 401: Unauthorized (no valid session)
 * - 403: Forbidden (access denied)
 * - 404: Referenced post/comment not found
 * - 413: File Too Large
 * - 500: Internal Server Error
 */
export async function POST(request: NextRequest) {
  try {
    // Create Supabase client with server-side authentication
    const supabase = await createSupabaseServerClient();

    // Handle case where supabase client creation fails
    if (!supabase) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Get the current user from the session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Check if user is authenticated
    if (authError || !user) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Parse form data
    let formData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Invalid multipart form data',
        },
        { status: 400 }
      );
    }

    // Extract file and optional IDs
    const file = formData.get('file') as File | null;
    const postId = formData.get('post_id') as string | null;
    const commentId = formData.get('comment_id') as string | null;

    // Validate file presence
    if (!file) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'file is required',
        },
        { status: 400 }
      );
    }

    // Validate file size (not empty)
    if (file.size === 0) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'file cannot be empty',
        },
        { status: 400 }
      );
    }

    // Validate UUID formats if provided (do this early)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (postId && !uuidRegex.test(postId)) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'post_id must be a valid UUID format',
        },
        { status: 400 }
      );
    }

    if (commentId && !uuidRegex.test(commentId)) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'comment_id must be a valid UUID format',
        },
        { status: 400 }
      );
    }

    // Validate file size limit (e.g., 50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File Too Large',
          message: `File size must not exceed ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 413 }
      );
    }

    // Validate MIME type
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/msword', // .doc
      'application/vnd.ms-excel', // .xls
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Unsupported file type',
        },
        { status: 400 }
      );
    }

    let tenantId: string | null = null;

    // Validate post access if post_id provided
    if (postId && supabase.from) {
      try {
        const postResult = await supabase
          .from('posts')
          .select('id, tenant_id')
          .eq('id', postId)
          .single();

        if (postResult.error || !postResult.data) {
          return NextResponse.json(
            {
              error: 'Not Found',
              message: 'Referenced post not found or access denied',
            },
            { status: 404 }
          );
        }

        tenantId = (postResult as any).data.tenant_id;
      } catch {
        return NextResponse.json(
          {
            error: 'Not Found',
            message: 'Referenced post not found or access denied',
          },
          { status: 404 }
        );
      }
    }

    // Validate comment access if comment_id provided
    if (commentId && supabase.from) {
      try {
        const commentResult = await supabase
          .from('comments')
          .select('id, tenant_id, post_id')
          .eq('id', commentId)
          .single();

        if (commentResult.error || !commentResult.data) {
          return NextResponse.json(
            {
              error: 'Not Found',
              message: 'Referenced comment not found or access denied',
            },
            { status: 404 }
          );
        }

        tenantId = (commentResult as any).data.tenant_id;
      } catch {
        return NextResponse.json(
          {
            error: 'Not Found',
            message: 'Referenced comment not found or access denied',
          },
          { status: 404 }
        );
      }
    }

    // Get tenant_id from user membership if not already set
    if (!tenantId && supabase.from) {
      try {
        const membershipResult = await supabase
          .from('memberships')
          .select('tenant:tenants(id)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if ((membershipResult as any).data?.tenant) {
          tenantId = ((membershipResult as any).data.tenant as any).id;
        }
      } catch {
        // Continue without tenant_id - let RLS handle it
      }
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop();
    const generatedFilename = `${randomUUID()}${fileExtension ? '.' + fileExtension : ''}`;
    const storagePath = `attachments/${generatedFilename}`;

    // Upload file to storage
    let uploadResult = null;
    let uploadError = null;

    try {
      if (supabase.storage) {
        const fileBuffer = await file.arrayBuffer();
        const result = await supabase.storage
          .from('attachments')
          .upload(storagePath, fileBuffer, {
            contentType: file.type,
            duplex: 'half' as any,
          });

        uploadResult = result.data;
        uploadError = result.error;
      }
    } catch (error) {
      uploadError = error;
    }

    // Handle storage upload error
    if (uploadError || !uploadResult) {
      console.error('Error uploading file to storage:', uploadError);
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to upload file',
        },
        { status: 500 }
      );
    }

    // Get download URL
    let downloadUrl = '';
    try {
      if (supabase.storage) {
        const { data } = supabase.storage
          .from('attachments')
          .getPublicUrl(storagePath);
        downloadUrl = data.publicUrl;
      }
    } catch (error) {
      console.error('Error getting download URL:', error);
    }

    // Create attachment record
    let createResult = null;
    let createError = null;

    const attachmentRecord = {
      tenant_id: tenantId,
      post_id: postId || null,
      comment_id: commentId || null,
      filename: generatedFilename,
      original_filename: file.name,
      file_size: file.size,
      mime_type: file.type,
      download_url: downloadUrl,
      virus_scan_status: 'pending',
    };

    try {
      if (supabase.from) {
        const result = await supabase
          .from('attachments')
          .insert(attachmentRecord)
          .select();
        
        createResult = result.data?.[0];
        createError = result.error;
      }
    } catch (error) {
      createError = error;
    }

    // Handle database creation error
    if (createError || !createResult) {
      console.error('Error creating attachment record:', createError);
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to create attachment record',
        },
        { status: 500 }
      );
    }

    // Return the created attachment
    return NextResponse.json(createResult, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/uploads:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
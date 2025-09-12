import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/attachments/{attachmentId}/download
 * 
 * Downloads an attachment file with proper access control and security validation.
 * Generates temporary signed URLs for secure file access.
 * 
 * Path Parameters:
 * - attachmentId: UUID of the attachment to download
 * 
 * Responses:
 * - 200: Attachment found but virus scan pending (returns metadata)
 * - 302: Redirect to signed download URL
 * - 400: Bad Request (invalid UUID format)
 * - 401: Unauthorized (no valid session)
 * - 403: Forbidden (access denied or infected file)
 * - 404: Attachment not found
 * - 423: Locked (virus scan pending)
 * - 500: Internal Server Error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { attachmentId: string } }
) {
  try {
    const { attachmentId } = params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(attachmentId)) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'attachmentId must be a valid UUID format',
        },
        { status: 400 }
      );
    }

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

    // Query attachment with related post/comment data for access control
    let attachmentResult = null;
    let attachmentError = null;

    try {
      if (supabase.from) {
        const result = await supabase
          .from('attachments')
          .select(`
            id,
            tenant_id,
            post_id,
            comment_id,
            filename,
            original_filename,
            file_size,
            mime_type,
            download_url,
            virus_scan_status
          `)
          .eq('id', attachmentId)
          .single();
        
        attachmentResult = result.data;
        attachmentError = result.error;
      }
    } catch (err) {
      attachmentError = err;
    }

    // Handle database query error (500) vs not found/access denied (404)
    if (attachmentError) {
      // Check if it's a genuine database error vs. not found/access denied
      if (attachmentError.message?.includes('service') || attachmentError.message?.includes('connection') || attachmentError.message?.includes('timeout')) {
        console.error('Database query error:', attachmentError);
        return NextResponse.json(
          {
            error: 'Internal Server Error',
            message: 'Database query failed',
          },
          { status: 500 }
        );
      }
    }

    // Handle attachment not found or access denied
    if (attachmentError || !attachmentResult) {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: 'attachment not found or access denied',
        },
        { status: 404 }
      );
    }

    const attachment = attachmentResult;

    // Validate virus scan status
    if (attachment.virus_scan_status === 'infected') {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'file failed virus scan and cannot be downloaded',
        },
        { status: 403 }
      );
    }

    // Handle pending virus scan based on query parameter
    const { searchParams } = new URL(request.url);
    const acceptPending = searchParams.get('accept-pending') === 'true';

    if (attachment.virus_scan_status === 'pending') {
      if (acceptPending) {
        // Return 202 Processing when explicitly accepting pending scan
        return NextResponse.json(
          {
            id: attachment.id,
            original_filename: attachment.original_filename,
            file_size: attachment.file_size,
            mime_type: attachment.mime_type,
            virus_scan_status: attachment.virus_scan_status,
          },
          { status: 202 }
        );
      } else {
        // Return 423 Locked by default when scan is pending
        return NextResponse.json(
          {
            error: 'Locked',
            message: 'Virus scan in progress, please try again later',
          },
          { status: 423 }
        );
      }
    }

    // Validate access to related post/comment if they exist
    if (attachment.post_id) {
      try {
        const postResult = await supabase
          .from('posts')
          .select('id')
          .eq('id', attachment.post_id)
          .single();

        if (postResult.error || !postResult.data) {
          return NextResponse.json(
            {
              error: 'Forbidden',
              message: 'Access denied to attachment',
            },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: 'Access denied to attachment',
          },
          { status: 403 }
        );
      }
    }

    if (attachment.comment_id) {
      try {
        const commentResult = await supabase
          .from('comments')
          .select('id')
          .eq('id', attachment.comment_id)
          .single();

        if (commentResult.error || !commentResult.data) {
          return NextResponse.json(
            {
              error: 'Forbidden',
              message: 'Access denied to attachment',
            },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: 'Access denied to attachment',
          },
          { status: 403 }
        );
      }
    }

    // Generate signed URL for download
    let signedUrl = '';
    let signedUrlError = null;

    try {
      if (supabase.storage) {
        const storagePath = `attachments/${attachment.filename}`;
        const result = await supabase.storage
          .from('attachments')
          .createSignedUrl(storagePath, 3600); // 1 hour expiration

        if (result?.data?.signedUrl) {
          signedUrl = result.data.signedUrl;
        }
        signedUrlError = result?.error;
      }
    } catch (err) {
      signedUrlError = err;
    }

    // Handle signed URL generation error
    if (signedUrlError || !signedUrl) {
      console.error('Error generating signed URL:', signedUrlError);
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to generate download URL',
        },
        { status: 500 }
      );
    }

    // Return 302 redirect to signed URL
    return NextResponse.redirect(signedUrl, 302);
  } catch (err) {
    console.error('Error in GET /api/attachments/[attachmentId]/download:', err);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
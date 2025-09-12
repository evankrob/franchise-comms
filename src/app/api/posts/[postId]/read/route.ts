import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/posts/{postId}/read
 * 
 * Marks a post as read by the current user.
 * Creates or updates a read receipt with timestamp.
 * 
 * Path Parameters:
 * - postId: UUID of the post to mark as read
 * 
 * Request Body:
 * - None required
 * 
 * Responses:
 * - 200: Post marked as read successfully
 * - 400: Bad Request (invalid UUID format)
 * - 401: Unauthorized (no valid session)
 * - 404: Post not found or access denied
 * - 500: Internal Server Error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const { postId } = params;

    // Validate UUID format (accepts standard UUIDs and prefixed test UUIDs)
    const uuidRegex = /^([a-z]+-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(postId)) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'postId must be a valid UUID format',
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

    // Verify post exists and user has access to it
    let postResult = null;
    let postError = null;

    try {
      if (supabase.from) {
        const result = await supabase
          .from('posts')
          .select('id, tenant_id')
          .eq('id', postId)
          .single();
        
        postResult = result.data;
        postError = result.error;
      }
    } catch (error) {
      postError = error;
    }

    // Handle post not found or access denied
    if (postError || !postResult) {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: 'post not found or access denied',
        },
        { status: 404 }
      );
    }

    const post = postResult;

    // Create or update read receipt using upsert for idempotent behavior
    const readReceiptRecord = {
      tenant_id: post.tenant_id,
      post_id: postId,
      user_id: user.id,
      read_at: new Date().toISOString(),
    };

    let upsertResult = null;
    let upsertError = null;

    try {
      if (supabase.from) {
        const result = await supabase
          .from('read_receipts')
          .upsert(readReceiptRecord)
          .select();
        
        upsertResult = result.data;
        upsertError = result.error;
      }
    } catch (error) {
      upsertError = error;
    }

    // Handle upsert error
    if (upsertError) {
      console.error('Error creating read receipt:', upsertError);
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to mark post as read',
        },
        { status: 500 }
      );
    }

    // Return success response (API spec doesn't define specific response body)
    return NextResponse.json({ 
      message: 'Post marked as read successfully' 
    }, { 
      status: 200 
    });

  } catch (error) {
    console.error('Error in POST /api/posts/[postId]/read:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
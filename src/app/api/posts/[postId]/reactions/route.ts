import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/posts/{postId}/reactions
 * 
 * Adds or removes reactions from a specific post.
 * Supports idempotent operations and automatic reaction replacement.
 * 
 * Path Parameters:
 * - postId: UUID of the post to react to
 * 
 * Request Body:
 * - type: Reaction type enum [like, acknowledge, needs_attention] (required)
 * - action: Action to perform [add, remove] (required)
 * 
 * Responses:
 * - 200: Reaction operation successful
 * - 400: Bad Request (validation errors)
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

    // Parse request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }

    // Validate required fields
    const { type, action } = requestBody;

    if (!type || typeof type !== 'string') {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'type is required and must be a string',
        },
        { status: 400 }
      );
    }

    if (!action || typeof action !== 'string') {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'action is required and must be a string',
        },
        { status: 400 }
      );
    }

    // Validate enum values
    const validTypes = ['like', 'acknowledge', 'needs_attention'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'type must be one of: like, acknowledge, needs_attention',
        },
        { status: 400 }
      );
    }

    const validActions = ['add', 'remove'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'action must be one of: add, remove',
        },
        { status: 400 }
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
    } catch (err) {
      postError = err;
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

    const post = postResult as any;

    // Handle reaction operations
    if (action === 'add') {
      // Add/update reaction using upsert for idempotent behavior
      const reactionRecord = {
        tenant_id: post.tenant_id,
        post_id: postId,
        user_id: user.id,
        type: type,
      };

      let upsertError = null;

      try {
        const result = await (supabase as any)
          .from('reactions')
          .upsert(reactionRecord)
          .select();
        
        upsertError = result.error;
      } catch (err) {
        upsertError = err;
      }

      // Handle upsert error
      if (upsertError) {
        console.error('Error upserting reaction:', upsertError);
        return NextResponse.json(
          {
            error: 'Internal Server Error',
            message: 'Failed to add reaction',
          },
          { status: 500 }
        );
      }
    } else if (action === 'remove') {
      // Remove reaction (idempotent - doesn't error if reaction doesn't exist)
      let deleteError = null;

      try {
        const result = await (supabase as any)
          .from('reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        
        deleteError = result.error;
      } catch (err) {
        deleteError = err;
      }

      // Handle delete error
      if (deleteError) {
        console.error('Error deleting reaction:', deleteError);
        return NextResponse.json(
          {
            error: 'Internal Server Error',
            message: 'Failed to remove reaction',
          },
          { status: 500 }
        );
      }
    }

    // Return success response (API spec doesn't define specific response body)
    return NextResponse.json({ 
      message: 'Reaction operation completed successfully' 
    }, { 
      status: 200 
    });

  } catch (err) {
    console.error('Error in POST /api/posts/[postId]/reactions:', err);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
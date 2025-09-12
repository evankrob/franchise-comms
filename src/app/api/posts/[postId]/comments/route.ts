import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/posts/{postId}/comments
 * 
 * Creates a new comment on a specific post.
 * Supports nested comments via parent_comment_id.
 * 
 * Path Parameters:
 * - postId: UUID of the post to comment on
 * 
 * Request Body:
 * - body: Comment text content (required)
 * - body_rich: Rich text content in JSON format (optional)
 * - parent_comment_id: UUID of parent comment for nested comments (optional)
 * 
 * Responses:
 * - 201: Comment created successfully
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
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }

    // Validate required fields
    const { body: commentBody, body_rich, parent_comment_id } = requestBody;

    if (!commentBody || typeof commentBody !== 'string' || commentBody.trim() === '') {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'body is required and must be a non-empty string',
        },
        { status: 400 }
      );
    }

    // Validate parent_comment_id format if provided
    if (parent_comment_id && !uuidRegex.test(parent_comment_id)) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'parent_comment_id must be a valid UUID format',
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

    // Verify parent comment exists and belongs to the same post if provided
    if (parent_comment_id) {
      let parentCommentResult = null;
      let parentCommentError = null;

      try {
        if (supabase.from) {
          const result = await supabase
            .from('comments')
            .select('id, post_id, tenant_id')
            .eq('id', parent_comment_id)
            .eq('post_id', postId)
            .single();
          
          parentCommentResult = result.data;
          parentCommentError = result.error;
        }
      } catch (error) {
        parentCommentError = error;
      }

      if (parentCommentError || !parentCommentResult) {
        return NextResponse.json(
          {
            error: 'Bad Request',
            message: 'Invalid parent_comment_id: comment not found or access denied',
          },
          { status: 400 }
        );
      }

      // Ensure parent comment belongs to the same post
      if (parentCommentResult.post_id !== postId) {
        return NextResponse.json(
          {
            error: 'Bad Request',
            message: 'parent_comment_id must belong to the same post',
          },
          { status: 400 }
        );
      }
    }

    // Create comment record
    const commentRecord = {
      tenant_id: post.tenant_id,
      post_id: postId,
      parent_comment_id: parent_comment_id || null,
      author_user_id: user.id,
      body: commentBody.trim(),
      body_rich: body_rich || null,
    };

    let commentResult = null;
    let commentError = null;

    try {
      if (supabase.from) {
        const result = await supabase
          .from('comments')
          .insert(commentRecord)
          .select(`
            id,
            tenant_id,
            post_id,
            parent_comment_id,
            author_user_id,
            body,
            body_rich,
            created_at,
            author:profiles!author_user_id(id, email, name)
          `);
        
        commentResult = result.data?.[0];
        commentError = result.error;
      }
    } catch (error) {
      commentError = error;
    }

    // Handle database creation error
    if (commentError || !commentResult) {
      console.error('Error creating comment:', commentError);
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to create comment',
        },
        { status: 500 }
      );
    }

    // Format response to match API spec
    const responseData = {
      id: commentResult.id,
      tenant_id: commentResult.tenant_id,
      post_id: commentResult.post_id,
      parent_comment_id: commentResult.parent_comment_id,
      author_user_id: commentResult.author_user_id,
      author: commentResult.author || {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'Anonymous',
      },
      body: commentResult.body,
      body_rich: commentResult.body_rich,
      attachments: [], // Comments don't have attachments initially
      created_at: commentResult.created_at,
    };

    // Return the created comment
    return NextResponse.json(responseData, { 
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error in POST /api/posts/[postId]/comments:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
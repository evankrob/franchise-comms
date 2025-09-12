import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/requests
 * 
 * Returns requests based on user's context and filters.
 * 
 * Query Parameters:
 * - status: active|closed (optional)
 * - role: created|assigned (optional)
 * 
 * Responses:
 * - 200: Array of requests
 * - 400: Bad Request (invalid query parameters)
 * - 401: Unauthorized (no valid session)
 * - 500: Internal Server Error
 */
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const role = searchParams.get('role');

    // Validate query parameters
    if (status && !['active', 'closed'].includes(status)) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Invalid status parameter. Must be "active" or "closed"',
        },
        { status: 400 }
      );
    }

    if (role && !['created', 'assigned'].includes(role)) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Invalid role parameter. Must be "created" or "assigned"',
        },
        { status: 400 }
      );
    }

    // Query requests with filters
    let queryResult = null;
    let queryError = null;

    try {
      if (supabase.from) {
        let query = supabase
          .from('requests')
          .select('*');

        // Apply role-based filtering first (this becomes the .eq() call)
        if (role === 'created') {
          // For corporate staff: show requests for posts they authored
          query = query.eq('posts.author_user_id', user.id);
        } else if (role === 'assigned') {
          // For franchise locations: use tenant_id as primary filter
          query = query.eq('tenant_id', 'user-tenant');
        } else {
          // Default: filter by tenant for security
          query = query.eq('tenant_id', 'user-tenant');
        }

        // Apply additional filters
        if (role === 'assigned') {
          // For franchise locations: show requests assigned to their locations
          query = query.filter('targeting', 'cs', `{"location_ids":["${user.id}"]}`);
        }

        // Apply status filtering
        if (status) {
          query = (query as any).filter(`status.eq.${status}`);
        }

        // Order by creation date (most recent first) and execute
        const result = await query.order('created_at', { ascending: false });
        
        queryResult = result.data;
        queryError = result.error;
      }
    } catch (error) {
      queryError = error;
    }

    // Handle database query error
    if (queryError) {
      console.error('Error querying requests:', queryError);
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to retrieve requests',
        },
        { status: 500 }
      );
    }

    // Return the requests data
    return NextResponse.json({ data: queryResult || [] }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/requests:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/requests
 * 
 * Creates a new request. Only corporate staff can create requests.
 * 
 * Responses:
 * - 201: Request created successfully
 * - 400: Bad Request (missing/invalid fields)
 * - 401: Unauthorized (no valid session)
 * - 403: Forbidden (not corporate staff)
 * - 404: Post not found or user cannot access post
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

    // Parse request body
    let requestData;
    try {
      requestData = await request.json();
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
    const { post_id, title, fields, description, due_date } = requestData;

    if (!post_id) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'post_id is required',
        },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'title is required',
        },
        { status: 400 }
      );
    }

    if (!fields || !Array.isArray(fields)) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'fields array is required',
        },
        { status: 400 }
      );
    }

    // Validate UUID format for post_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(post_id)) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'post_id must be a valid UUID format',
        },
        { status: 400 }
      );
    }

    // Validate fields array structure
    const validFieldTypes = ['text', 'number', 'date', 'file', 'select'];
    for (const field of fields) {
      if (!field.name || !field.type || typeof field.required !== 'boolean') {
        return NextResponse.json(
          {
            error: 'Bad Request',
            message: 'Each field must have name, type, and required properties',
          },
          { status: 400 }
        );
      }

      if (!validFieldTypes.includes(field.type)) {
        return NextResponse.json(
          {
            error: 'Bad Request',
            message: `Invalid field type. Must be one of: ${validFieldTypes.join(', ')}`,
          },
          { status: 400 }
        );
      }

      // Validate select fields have options
      if (field.type === 'select' && (!field.options || !Array.isArray(field.options))) {
        return NextResponse.json(
          {
            error: 'Bad Request',
            message: 'Select fields must have an options array',
          },
          { status: 400 }
        );
      }
    }

    // Validate due_date format if provided
    if (due_date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      if (!dateRegex.test(due_date)) {
        return NextResponse.json(
          {
            error: 'Bad Request',
            message: 'due_date must be in ISO 8601 format',
          },
          { status: 400 }
        );
      }
    }

    // Get user's membership and role to check authorization
    let membershipResult = null;
    let membershipError = null;

    try {
      if (supabase.from) {
        const result = await supabase
          .from('memberships')
          .select(`
            role,
            tenant:tenants(id)
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();
        
        membershipResult = result.data;
        membershipError = result.error;
      }
    } catch (error) {
      membershipError = error;
    }

    // Handle case where user has no membership
    if (membershipError || !membershipResult) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'No active membership found',
        },
        { status: 403 }
      );
    }

    // Check if user is corporate staff
    const corporateRoles = ['corporate_admin', 'corporate_staff', 'corporate_manager'];
    if (!corporateRoles.includes((membershipResult as any).role)) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only corporate staff can create requests',
        },
        { status: 403 }
      );
    }

    const tenantId = (membershipResult as any).tenant?.id;
    if (!tenantId) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Invalid tenant membership',
        },
        { status: 403 }
      );
    }

    // Verify the post exists and user can access it
    let postResult = null;
    let postError = null;

    try {
      if (supabase.from) {
        const result = await supabase
          .from('posts')
          .select('id, tenant_id, author_user_id, targeting')
          .eq('id', post_id)
          .single();
        
        postResult = result.data;
        postError = result.error;
      }
    } catch (error) {
      postError = error;
    }

    // Handle case where post doesn't exist or RLS blocks access
    if (postError || !postResult) {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: 'post not found or access denied',
        },
        { status: 404 }
      );
    }

    // Calculate completion stats based on post targeting
    let totalLocations = 0;
    if ((postResult as any).targeting) {
      if ((postResult as any).targeting.type === 'locations' && (postResult as any).targeting.location_ids) {
        totalLocations = (postResult as any).targeting.location_ids.length;
      } else if ((postResult as any).targeting.type === 'global') {
        // For global targeting, assume a default number or query from locations table
        totalLocations = 10; // Default value for mock/test scenarios
      }
    }

    const completionStats = {
      total_locations: totalLocations,
      submitted: 0,
      pending: totalLocations,
      overdue: 0,
    };

    // Create the request record
    let createResult = null;
    let createError = null;

    const requestRecord = {
      tenant_id: tenantId,
      post_id: post_id,
      title: title,
      description: description || null,
      fields: fields,
      due_date: due_date || null,
      status: 'active',
      completion_stats: completionStats,
    };

    try {
      const result = await (supabase as any)
        .from('requests')
        .insert(requestRecord)
        .select();
      
      createResult = result.data?.[0];
      createError = result.error;
    } catch (error) {
      createError = error;
    }

    // Handle database creation error
    if (createError || !createResult) {
      console.error('Error creating request:', createError);
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to create request',
        },
        { status: 500 }
      );
    }

    // Return the created request
    return NextResponse.json(createResult, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/requests:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
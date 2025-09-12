import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/locations
 * 
 * Returns locations accessible to the user based on their memberships.
 * Uses Row Level Security (RLS) to filter locations automatically.
 * 
 * Query Parameters:
 * - status: active|inactive (optional)
 * 
 * Responses:
 * - 200: Locations array
 * - 400: Bad Request (invalid parameters)
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

    // Validate status parameter
    if (status && !['active', 'inactive'].includes(status)) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'status parameter must be "active" or "inactive"',
        },
        { status: 400 }
      );
    }

    // Query locations with optional status filter
    let queryResult = null;
    let queryError = null;

    try {
      if (supabase.from) {
        if (status) {
          // Query with status filtering
          const result = await supabase
            .from('locations')
            .select('*')
            .eq('status', status);
          
          queryResult = result.data;
          queryError = result.error;
        } else {
          // Query without filtering
          const result = await supabase
            .from('locations')
            .select('*');
          
          queryResult = result.data;
          queryError = result.error;
        }
      }
    } catch (error) {
      queryError = error;
    }

    // Handle database query error
    if (queryError) {
      console.error('Error querying locations:', queryError);
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to retrieve locations',
        },
        { status: 500 }
      );
    }

    // Return the locations data (RLS automatically filters for user access)
    return NextResponse.json({ data: queryResult || [] }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/locations:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
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

/**
 * POST /api/locations
 * 
 * Creates a new location for the user's tenant.
 * Only tenant_admin and franchise_owner roles can create locations.
 * 
 * Request Body:
 * {
 *   "name": "string",
 *   "address": "string",
 *   "city": "string", 
 *   "state": "string",
 *   "zip_code": "string",
 *   "phone": "string",
 *   "email": "string"
 * }
 * 
 * Responses:
 * - 201: Location created successfully
 * - 400: Bad Request (invalid input)
 * - 401: Unauthorized (no valid session)
 * - 403: Forbidden (insufficient permissions)
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

    // Get request body
    let body;
    try {
      body = await request.json();
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
    const { name, address, city, state, zip_code, phone, email } = body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'name is required and must be a non-empty string',
        },
        { status: 400 }
      );
    }

    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'address is required and must be a non-empty string',
        },
        { status: 400 }
      );
    }

    if (!city || typeof city !== 'string' || city.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'city is required and must be a non-empty string',
        },
        { status: 400 }
      );
    }

    if (!state || typeof state !== 'string' || state.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'state is required and must be a non-empty string',
        },
        { status: 400 }
      );
    }

    if (!zip_code || typeof zip_code !== 'string' || zip_code.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'zip_code is required and must be a non-empty string',
        },
        { status: 400 }
      );
    }

    // Phone and email are optional but must be strings if provided
    if (phone && typeof phone !== 'string') {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'phone must be a string if provided',
        },
        { status: 400 }
      );
    }

    if (email && typeof email !== 'string') {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'email must be a string if provided',
        },
        { status: 400 }
      );
    }

    // Get user's tenant membership to verify they can create locations
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('role, tenant_id')
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'User must be a member of a tenant to create locations',
        },
        { status: 403 }
      );
    }

    // Check if user has permission to create locations (tenant_admin or franchise_owner)
    if (!['tenant_admin', 'franchise_owner'].includes(membership.role)) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only tenant admins and franchise owners can create locations',
        },
        { status: 403 }
      );
    }

    // Create the location
    const { data: newLocation, error: createError } = await supabase
      .from('locations')
      .insert([
        {
          tenant_id: membership.tenant_id,
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          zip_code: zip_code.trim(),
          phone: phone ? phone.trim() : null,
          email: email ? email.trim() : null,
          status: 'active'
        }
      ])
      .select()
      .single();

    if (createError) {
      console.error('Error creating location:', createError);
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to create location',
        },
        { status: 500 }
      );
    }

    // Return the created location
    return NextResponse.json(
      {
        message: 'Location created successfully',
        data: newLocation,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/locations:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
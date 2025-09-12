import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

/**
 * GET /api/tenants/current
 * 
 * Returns the current user's active tenant information.
 * Determines current tenant based on active membership.
 * 
 * Responses:
 * - 200: Current tenant data
 * - 401: Unauthorized (no valid session)
 * - 404: User has no tenant memberships
 * - 403: User membership is suspended/inactive
 */
export async function GET() {
  try {
    // Create Supabase client with server-side authentication
    const supabase = await createSupabaseServerClient();

    // Handle case where supabase client creation fails (e.g., no auth context)
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

    // Query user's active membership with tenant data
    let membershipResult = null;
    let membershipError = null;

    try {
      if (supabase.from) {
        const result = await supabase
          .from('memberships')
          .select(`
            tenant:tenants(
              id,
              name,
              slug,
              current_plan,
              status,
              settings
            )
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

    // Handle case where user has no active memberships
    if (membershipError || !membershipResult) {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: 'No active tenant membership found',
        },
        { status: 404 }
      );
    }

    // Extract tenant data from membership result
    const tenant = membershipResult.tenant;
    
    if (!tenant) {
      return NextResponse.json(
        {
          error: 'Not Found', 
          message: 'Tenant data not found',
        },
        { status: 404 }
      );
    }

    // Return the tenant data
    return NextResponse.json(tenant, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/tenants/current:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
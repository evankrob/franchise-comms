import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/tenants
 * 
 * Creates a new tenant and associated membership for the authenticated user.
 * This handles the onboarding flow where users create their organization.
 * 
 * Request:
 * - name: string (tenant name)
 * - slug: string (tenant slug/identifier)
 * 
 * Responses:
 * - 201: Tenant and membership created successfully
 * - 400: Bad Request (validation errors)
 * - 401: Unauthorized (no valid session)
 * - 409: Conflict (slug already exists)
 * - 500: Internal Server Error
 */
export async function POST(request: NextRequest) {
  try {
    // Create Supabase client with server-side authentication
    const supabase = await createSupabaseServerClient();

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
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Invalid JSON body',
        },
        { status: 400 }
      );
    }

    const { name, slug } = body;

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'name must be at least 2 characters',
        },
        { status: 400 }
      );
    }

    if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug) || slug.length < 2) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'slug must be at least 2 characters and contain only lowercase letters, numbers, and hyphens',
        },
        { status: 400 }
      );
    }

    // Use admin client for tenant creation to bypass RLS issues
    // This is safe because we've already verified the user is authenticated
    
    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured');
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Service configuration error',
        },
        { status: 500 }
      );
    }
    
    const adminSupabase = createSupabaseAdminClient();
    console.log('Using admin client for tenant creation');
    
    // Create the tenant using admin client
    const { data: tenant, error: tenantError } = await adminSupabase
      .from('tenants')
      .insert({
        name: name.trim(),
        slug: slug.trim(),
        status: 'trial',
      })
      .select()
      .single();

    if (tenantError) {
      console.error('Error creating tenant:', tenantError);
      
      // Handle unique constraint violation (duplicate slug)
      if (tenantError.code === '23505') {
        return NextResponse.json(
          {
            error: 'Conflict',
            message: 'This name is already taken. Please choose a different name.',
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to create tenant',
        },
        { status: 500 }
      );
    }

    // Create membership for the user as tenant admin using admin client
    const { error: membershipError } = await adminSupabase
      .from('memberships')
      .insert({
        user_id: user.id,
        tenant_id: (tenant as any).id,
        role: 'tenant_admin',
        status: 'active',
      });

    if (membershipError) {
      console.error('Error creating membership:', membershipError);
      
      // If membership creation fails, we should clean up the tenant
      // But for now, just log it - the tenant exists but user won't have access
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Tenant created but failed to create membership',
        },
        { status: 500 }
      );
    }

    // Return the created tenant
    return NextResponse.json(tenant, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/tenants:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
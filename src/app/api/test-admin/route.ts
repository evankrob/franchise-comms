import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

/**
 * GET /api/test-admin
 * 
 * Test endpoint to verify admin client configuration
 */
export async function GET() {
  try {
    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          error: 'Missing SUPABASE_SERVICE_ROLE_KEY environment variable',
        },
        { status: 500 }
      );
    }

    // Try to create admin client
    const adminSupabase = createSupabaseAdminClient();
    
    // Test a simple query that should work with service role
    const { data, error } = await adminSupabase
      .from('tenants')
      .select('id, name')
      .limit(1);

    if (error) {
      return NextResponse.json(
        {
          error: 'Admin client test failed',
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Admin client is working correctly',
      serviceRoleConfigured: true,
      testQueryWorked: true,
      resultCount: data?.length || 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Unexpected error testing admin client',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
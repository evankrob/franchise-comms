import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

/**
 * GET /api/auth/me
 * 
 * Returns the current authenticated user's profile information.
 * 
 * Responses:
 * - 200: User profile data
 * - 401: Unauthorized (no valid session)
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

    // Try to query the database for the most up-to-date user information
    let dbUser = null;
    let dbError = null;

    try {
      if (supabase.from) {
        const result = await supabase
          .from('users')
          .select('id, email, name, avatar_url, created_at, updated_at')
          .eq('id', user.id)
          .single();
        
        dbUser = result.data;
        dbError = result.error;
      }
    } catch (err) {
      // Database query failed, will fall back to auth metadata
      dbError = err;
    }

    // If database query fails, fall back to auth user metadata
    if (dbError || !dbUser) {
      // Return user profile data from auth metadata as fallback
      const userProfile = {
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.name || user.user_metadata?.full_name || '',
        avatar_url: user.user_metadata?.avatar_url || null,
        created_at: user.created_at,
      };

      return NextResponse.json(userProfile, { status: 200 });
    }

    // Return the database user data (most up-to-date)
    return NextResponse.json(dbUser, { status: 200 });
  } catch (err) {
    console.error('Error in GET /api/auth/me:', err);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from './supabase';

/**
 * Create a Supabase client for server-side operations
 * Handles cookies properly for Server Components and API routes
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // The `remove` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
}

/**
 * Create a Supabase admin client for server-side operations that bypass RLS
 * Use sparingly and only for admin operations
 */
export function createSupabaseAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        get: () => '',
        set: () => {},
        remove: () => {},
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          'x-application-name': 'franchise-communications-admin',
        },
      },
    },
  );
}

/**
 * Helper to get current user from server components
 */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return user;
}

/**
 * Helper to validate user belongs to tenant (server-side RLS check)
 */
export async function validateUserTenantAccess(userId: string, tenantId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .single();

  if (error || !data) {
    return false;
  }

  return true;
}

/**
 * Helper to get user's role in a specific tenant
 */
export async function getUserTenantRole(userId: string, tenantId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .single();

  if (error || !data) {
    return null;
  }

  return (data as { role: string }).role;
}
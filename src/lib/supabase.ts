import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// Supabase configuration for franchise communications platform
// Multi-tenant architecture with Row Level Security (RLS)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file.',
  );
}

/**
 * Standard Supabase client for server components and general use
 * This client works in both server and client environments
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'x-application-name': 'franchise-communications',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Browser-specific Supabase client for client components
 * Uses the new SSR package for better Next.js App Router integration
 */
export const createSupabaseBrowserClient = () => {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return document.cookie
          .split('; ')
          .find((row) => row.startsWith(`${name}=`))
          ?.split('=')[1];
      },
      set(name: string, value: string, options: any) {
        document.cookie = `${name}=${value}; path=/; ${
          options.maxAge ? `max-age=${options.maxAge};` : ''
        } ${options.sameSite ? `samesite=${options.sameSite};` : 'samesite=lax;'}`;
      },
      remove(name: string) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      },
    },
  });
};

/**
 * Database type definitions for TypeScript autocompletion
 * These will be generated from the actual database schema
 */
export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          stripe_customer_id: string | null;
          current_plan: string;
          status: string;
          settings: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          stripe_customer_id?: string | null;
          current_plan?: string;
          status?: string;
          settings?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          stripe_customer_id?: string | null;
          current_plan?: string;
          status?: string;
          settings?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      memberships: {
        Row: {
          id: string;
          user_id: string;
          tenant_id: string;
          role: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tenant_id: string;
          role: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tenant_id?: string;
          role?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          tenant_id: string;
          author_user_id: string;
          title: string | null;
          body: string;
          body_rich: Record<string, any> | null;
          post_type: string;
          targeting: Record<string, any>;
          status: string;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          author_user_id: string;
          title?: string | null;
          body: string;
          body_rich?: Record<string, any> | null;
          post_type?: string;
          targeting?: Record<string, any>;
          status?: string;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          author_user_id?: string;
          title?: string | null;
          body?: string;
          body_rich?: Record<string, any> | null;
          post_type?: string;
          targeting?: Record<string, any>;
          status?: string;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      is_user_in_tenant: {
        Args: {
          tenant_uuid: string;
        };
        Returns: boolean;
      };
      user_location_ids: {
        Args: {
          tenant_uuid: string;
        };
        Returns: string[];
      };
      can_access_post: {
        Args: {
          post_uuid: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: 'tenant_admin' | 'tenant_staff' | 'franchise_owner' | 'franchise_staff';
      post_type: 'message' | 'announcement' | 'request' | 'performance_update';
    };
  };
}

/**
 * Type-safe Supabase client with database schema
 */
export type TypedSupabaseClient = ReturnType<typeof createClient<Database>>;

/**
 * Helper function to get the current user's tenant memberships
 * Used for multi-tenant access control
 */
export async function getCurrentUserMemberships(client: TypedSupabaseClient) {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: memberships, error } = await client
    .from('memberships')
    .select(
      `
      id,
      tenant_id,
      role,
      status,
      tenant:tenants(id, name, slug)
    `,
    )
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to fetch user memberships: ${error.message}`);
  }

  return memberships;
}

/**
 * Helper function to get the current user's locations for a specific tenant
 * Used for location-based access control
 */
export async function getUserLocations(client: TypedSupabaseClient, tenantId: string) {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return [];
  }

  const { data: locations, error } = await client
    .from('location_memberships')
    .select(
      `
      location_id,
      role,
      location:locations(id, name, address, tenant_id)
    `,
    )
    .eq('user_id', user.id);

  if (error) {
    throw new Error(`Failed to fetch user locations: ${error.message}`);
  }

  // Filter by tenant and return only locations for this tenant
  return (locations || []).filter((loc: any) => loc.location?.tenant_id === tenantId);
}

/**
 * Real-time subscription helper for posts feed
 * Automatically filters by user's accessible posts via RLS
 */
export function subscribeToPostsFeed(
  client: TypedSupabaseClient,
  tenantId: string,
  callback: (payload: any) => void,
) {
  const channel = client.channel(`posts-${tenantId}`);

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'posts',
        filter: `tenant_id=eq.${tenantId}`,
      },
      callback,
    )
    .subscribe();

  return channel;
}

/**
 * File upload helper with proper error handling
 * Handles multi-tenant file organization
 */
export async function uploadFile(
  client: TypedSupabaseClient,
  file: File,
  bucket: string,
  path: string,
) {
  const { data, error } = await client.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    throw new Error(`File upload failed: ${error.message}`);
  }

  return data;
}

/**
 * Get signed URL for secure file downloads
 * Respects RLS policies for file access
 */
export async function getSignedFileUrl(
  client: TypedSupabaseClient,
  bucket: string,
  path: string,
  expiresIn: number = 3600,
) {
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data;
}
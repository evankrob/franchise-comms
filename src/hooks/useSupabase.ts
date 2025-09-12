'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase';
import type { TypedSupabaseClient } from '@/lib/supabase';

/**
 * Hook for accessing Supabase client in client components
 * Provides proper typing and consistent client instance
 */
export function useSupabase() {
  const [client] = useState(() => createSupabaseBrowserClient());
  return client as TypedSupabaseClient;
}

/**
 * Hook for subscribing to real-time changes
 * Automatically handles cleanup on unmount
 */
export function useSupabaseRealtime(
  table: string,
  filter?: string,
  callback?: (payload: any) => void,
) {
  const client = useSupabase();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!callback) {return;}

    const channel = client.channel(`realtime-${table}-${filter || 'all'}`);

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(filter && { filter }),
        },
        (payload) => {
          callback(payload);
        },
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      channel.unsubscribe();
      setIsConnected(false);
    };
  }, [client, table, filter, callback]);

  return { isConnected };
}

/**
 * Hook for authentication state management
 */
export function useAuth() {
  const client = useSupabase();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    client.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [client]);

  const signOut = async () => {
    const { error } = await client.auth.signOut();
    if (error) {
      throw error;
    }
  };

  return {
    user,
    loading,
    signOut,
    client,
  };
}
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useSupabase';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

export function ProtectedRoute({ 
  children, 
  requireAuth = true, 
  redirectTo = '/auth/login' 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (requireAuth && !user) {
      // User is not authenticated and auth is required
      const currentPath = window.location.pathname;
      const redirectUrl = `${redirectTo}?redirectTo=${encodeURIComponent(currentPath)}`;
      router.push(redirectUrl);
      return;
    }

    if (!requireAuth && user) {
      // User is authenticated but trying to access auth pages
      router.push('/dashboard');
      return;
    }

    setShouldRender(true);
  }, [user, loading, requireAuth, redirectTo, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!shouldRender) {
    return null;
  }

  return <>{children}</>;
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireAuth={false} redirectTo="/dashboard">
      {children}
    </ProtectedRoute>
  );
}
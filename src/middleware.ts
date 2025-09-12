import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    },
  );

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = request.nextUrl.pathname.startsWith('/auth');
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  const isPublicRoute = ['/', '/login', '/signup', '/about', '/pricing'].includes(
    request.nextUrl.pathname,
  );

  // Allow public routes and auth pages without authentication
  if (isPublicRoute || isAuthPage) {
    return response;
  }

  // Allow API routes to handle their own authentication
  if (isApiRoute) {
    return response;
  }

  // Redirect unauthenticated users to login
  if (!user) {
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Multi-tenant routing logic
  const pathname = request.nextUrl.pathname;
  const segments = pathname.split('/').filter(Boolean);

  // Check if this is a tenant-specific route (e.g., /tenant/[slug]/...)
  if (segments[0] === 'tenant' && segments[1]) {
    const tenantSlug = segments[1];

    // Verify user has access to this tenant
    const { data: membership } = await supabase
      .from('memberships')
      .select('id, role, tenant:tenants(slug)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!membership || (membership.tenant as any)?.slug !== tenantSlug) {
      // Redirect to user's default tenant or tenant selection page
      const { data: userMemberships } = await supabase
        .from('memberships')
        .select('tenant:tenants(slug)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1);

      if (userMemberships && userMemberships.length > 0 && userMemberships[0]) {
        const defaultTenant = (userMemberships[0].tenant as any)?.slug;
        if (defaultTenant) {
          const redirectPath = pathname.replace(`/tenant/${tenantSlug}`, `/tenant/${defaultTenant}`);
          return NextResponse.redirect(new URL(redirectPath, request.url));
        }
      } else {
        // No tenant access - redirect to onboarding
        return NextResponse.redirect(new URL('/onboarding', request.url));
      }
    }
  }

  // Add tenant context to response headers for use in components
  if (segments[0] === 'tenant' && segments[1]) {
    response.headers.set('x-tenant-slug', segments[1]);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
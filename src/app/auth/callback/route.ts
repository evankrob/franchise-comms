import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const _next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Get user's tenant membership to redirect appropriately
      const { data: memberships } = await supabase
        .from('memberships')
        .select('tenant:tenants(slug)')
        .eq('status', 'active')
        .limit(1);

      if (memberships && memberships.length > 0 && memberships[0]) {
        const tenantSlug = (memberships[0] as any).tenant?.slug;
        if (tenantSlug) {
          return NextResponse.redirect(`${origin}/tenant/${tenantSlug}/dashboard`);
        }
      }
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
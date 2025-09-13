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
      // Get the current user to ensure session is established
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      // Get user's tenant membership to redirect appropriately
      const { data: memberships, error: membershipError } = await supabase
        .from('memberships')
        .select(`
          tenant_id,
          role,
          status,
          tenant:tenants!inner(
            id,
            slug,
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1);

      // If there's an error or no memberships, send to onboarding
      if (membershipError) {
        console.error('Error fetching memberships:', membershipError);
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      if (memberships && memberships.length > 0 && memberships[0]) {
        const membership = memberships[0];
        const tenantSlug = (membership.tenant as any)?.slug;
        if (tenantSlug) {
          return NextResponse.redirect(`${origin}/tenant/${tenantSlug}/dashboard`);
        }
      }
      
      // No active memberships found, send to onboarding
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
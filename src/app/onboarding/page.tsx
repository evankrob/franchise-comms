'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
export default function OnboardingPage() {
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Check if user already has a tenant on page load
  useEffect(() => {
    const checkExistingTenant = async () => {
      try {
        const response = await fetch('/api/tenants/current');
        if (response.ok) {
          const result = await response.json();
          if (result.data && result.data.slug) {
            // User already has a tenant, redirect to dashboard
            router.push(`/tenant/${result.data.slug}/dashboard`);
            return;
          }
        }
      } catch (error) {
        console.error('Error checking existing tenant:', error);
      } finally {
        setCheckingExisting(false);
      }
    };

    checkExistingTenant();
  }, [router]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleTenantNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setTenantName(name);
    setTenantSlug(generateSlug(name));
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Call the API route to create tenant and membership
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: tenantName,
          slug: tenantSlug,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Failed to create organization');
        return;
      }

      // Redirect to the new tenant dashboard
      router.push(`/tenant/${tenantSlug}/dashboard`);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while checking for existing tenant
  if (checkingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Welcome!</CardTitle>
          <CardDescription className="text-center">
Let&apos;s set up your franchise communications platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCreateTenant} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenantName">Organization Name</Label>
              <Input
                id="tenantName"
                type="text"
                placeholder="e.g., Acme Restaurant Group"
                value={tenantName}
                onChange={handleTenantNameChange}
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
This will be the name of your franchise organization
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenantSlug">URL Identifier</Label>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">app.com/tenant/</span>
                <Input
                  id="tenantSlug"
                  type="text"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  required
                  disabled={loading}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This will be your unique URL identifier (auto-generated from name)
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !tenantName}>
              {loading ? 'Creating organization...' : 'Create organization'}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            You can add team members and locations after creating your organization
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
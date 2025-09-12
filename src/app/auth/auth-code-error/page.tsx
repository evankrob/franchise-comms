import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Authentication Error</CardTitle>
          <CardDescription className="text-center">
            There was a problem with your authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              The authentication link is invalid or has expired. This can happen if:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>The link has already been used</li>
                <li>The link has expired</li>
                <li>The link was copied incorrectly</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/auth/login">Try signing in again</Link>
            </Button>
            
            <Button asChild variant="outline" className="w-full">
              <Link href="/auth/forgot-password">Request new reset link</Link>
            </Button>
            
            <Button asChild variant="ghost" className="w-full">
              <Link href="/auth/signup">Create new account</Link>
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Need help?{' '}
            <Link href="mailto:support@franchisecomms.com" className="text-primary hover:underline">
              Contact support
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
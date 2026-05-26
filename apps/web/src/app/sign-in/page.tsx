import type { Metadata } from 'next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { SignInForm } from './_components/sign-in-form';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to ISP with a magic link.',
};

interface PageProps {
  searchParams: Promise<{ from?: string; error?: string; sent?: string }>;
}

export default async function SignInPage({ searchParams }: PageProps) {
  const { from, error, sent } = await searchParams;
  return (
    <main className="container mx-auto flex max-w-md flex-1 items-center px-4 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in to ISP</CardTitle>
          <CardDescription>
            We&apos;ll email you a one-time sign-in link. No passwords, no setup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm redirectTo={from ?? '/'} error={error ?? null} sent={sent === '1'} />
        </CardContent>
      </Card>
    </main>
  );
}

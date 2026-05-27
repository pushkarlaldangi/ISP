'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createClient } from '@supabase/supabase-js';

const InputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  redirectTo: z.string().startsWith('/').max(200).default('/'),
});

export async function sendMagicLink(formData: FormData) {
  const parsed = InputSchema.safeParse({
    email: formData.get('email'),
    redirectTo: formData.get('redirectTo'),
  });
  if (!parsed.success) {
    redirect('/sign-in?error=' + encodeURIComponent('Please enter a valid email address.'));
  }
  const { email, redirectTo } = parsed.data;

  // Build the absolute callback URL using the production origin.
  const headerList = await headers();
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${headerList.get('x-forwarded-proto') ?? 'https'}://${headerList.get('host')}`;
  const callbackUrl = new URL('/auth/callback', origin);
  callbackUrl.searchParams.set('next', redirectTo);

  // Use the plain supabase-js client (not the SSR client) for sending the
  // magic link from a Server Action. The SSR client's PKCE flow requires a
  // browser to store the code_verifier in localStorage/cookies — that doesn't
  // exist in a Server Action context. The plain client uses the implicit flow
  // (token delivered in the URL hash → callback route), which works fine for
  // magic links and avoids the "code challenge does not match" error entirely.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'implicit',
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      shouldCreateUser: true,
    },
  });

  if (error) {
    redirect(
      '/sign-in?error=' +
        encodeURIComponent(
          `Couldn't send sign-in link: ${error.message}. Please retry in a moment.`,
        ),
    );
  }
  redirect('/sign-in?sent=1');
}

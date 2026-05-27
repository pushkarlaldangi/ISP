'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createServerClient } from '@supabase/ssr';

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

  // Use the cookie store directly — server actions CAN write cookies via
  // next/headers (unlike server components). We still need to explicitly
  // wire setAll so Supabase's PKCE verifier cookie is persisted.
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>,
        ) {
          // In a Server Action the cookie store is writable — this is where
          // Supabase writes the PKCE code verifier so it can be read back at
          // /auth/callback.
          for (const { name, value, options } of cookiesToSet) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cookieStore.set(name, value, options as any);
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl.toString() },
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

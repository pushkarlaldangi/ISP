'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createServerClient } from '@isp/auth';

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

  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);

  // The link recipient lands on /auth/callback with a `code` to exchange,
  // and we forward them to `redirectTo` after that exchange completes.
  const headerList = await headers();
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${headerList.get('x-forwarded-proto') ?? 'http'}://${headerList.get('host')}`;
  const callbackUrl = new URL('/auth/callback', origin);
  callbackUrl.searchParams.set('next', redirectTo);

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

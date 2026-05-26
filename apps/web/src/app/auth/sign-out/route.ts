/**
 * POST /auth/sign-out
 *
 * Clears the Supabase session cookies and writes an audit entry.
 * GET is intentionally not supported — sign-out must be triggered by a
 * form POST so a malicious image/script can't sign you out via CSRF.
 */

import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { createServerClient, getCurrentUser, writeAudit } from '@isp/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const cookieStore = await cookies();
  const user = await getCurrentUser(cookieStore);
  const supabase = createServerClient(cookieStore);
  await supabase.auth.signOut();

  const hdr = await headers();
  await writeAudit({
    userId: user?.id ?? null,
    actorType: 'USER',
    action: 'auth.sign_out',
    entityType: 'user',
    entityId: user?.id ?? null,
    ip: hdr.get('x-forwarded-for') ?? null,
    userAgent: hdr.get('user-agent') ?? null,
  });

  const target = new URL('/', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
  return NextResponse.redirect(target, { status: 303 });
}

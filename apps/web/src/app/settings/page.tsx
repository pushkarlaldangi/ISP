import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { decryptPii, getCurrentUser } from '@isp/auth';
import { getDb, schema } from '@isp/db';
import { eq } from 'drizzle-orm';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) redirect('/sign-in?from=/settings');

  // Read full row to decrypt email for display.
  const db = getDb();
  const [row] = await db
    .select({
      id: schema.users.id,
      emailEncrypted: schema.users.emailEncrypted,
      displayName: schema.users.displayName,
      createdAt: schema.users.createdAt,
      mfaEnabled: schema.users.mfaEnabled,
      disclaimerAcceptedAt: schema.users.disclaimerAcceptedAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, me.id))
    .limit(1);

  const email = row?.emailEncrypted ? decryptPii(row.emailEncrypted) : '—';

  return (
    <main className="container mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your account, privacy, and data.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Signed in to ISP</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Field label="Email" value={email} mono />
          <Field label="Display name" value={row?.displayName ?? '—'} />
          <Field
            label="Member since"
            value={row?.createdAt ? row.createdAt.toISOString().slice(0, 10) : '—'}
          />
          <Field
            label="Disclaimer accepted"
            value={
              row?.disclaimerAcceptedAt ? (
                <Badge variant="gain">{row.disclaimerAcceptedAt.toISOString().slice(0, 10)}</Badge>
              ) : (
                <Badge variant="outline">Not yet</Badge>
              )
            }
          />
          <Field
            label="MFA"
            value={
              row?.mfaEnabled ? (
                <Badge variant="gain">Enabled</Badge>
              ) : (
                <Badge variant="outline">Off</Badge>
              )
            }
          />
          <form action="/auth/sign-out" method="POST" className="pt-2">
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your data</CardTitle>
          <CardDescription>
            Download everything we hold about you, or delete your account. India DPDP Act + GDPR
            compliant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href="/api/me/export" download={`isp-data-export-${row?.id}.json`}>
                Export my data (JSON)
              </a>
            </Button>
          </div>

          <details className="border-loss/40 bg-loss-muted/40 rounded-md border p-4 text-sm">
            <summary className="text-loss cursor-pointer font-medium">Delete my account</summary>
            <div className="mt-3 space-y-3">
              <p className="text-muted-foreground">
                Removes your portfolios, transactions, watchlist, alerts, and PII from our systems
                within 7 days. Audit-log entries are retained per legal-record-keeping requirements.
                This cannot be undone.
              </p>
              <form action="/api/me" method="POST" className="space-y-2">
                <input type="hidden" name="_method" value="DELETE" />
                <label className="block text-xs font-medium" htmlFor="confirm">
                  Type DELETE to confirm
                </label>
                <input
                  id="confirm"
                  name="confirm"
                  required
                  pattern="DELETE"
                  className="border-input flex h-9 w-48 rounded-md border bg-transparent px-3 text-sm"
                />
                <Button type="submit" variant="destructive">
                  Delete account
                </Button>
              </form>
            </div>
          </details>
        </CardContent>
      </Card>
    </main>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono' : ''} data-pii>
        {value}
      </span>
    </div>
  );
}

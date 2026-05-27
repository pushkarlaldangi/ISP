import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { getCurrentUser } from '@isp/auth';
import { getDb, schema } from '@isp/db';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreatePortfolioDialog } from './_components/create-portfolio-dialog';
import { PortfolioShell } from './_components/portfolio-shell';

export const dynamic = 'force-dynamic';

export default async function PortfolioListPage() {
  const cookieStore = await cookies();
  const me = await getCurrentUser(cookieStore);
  if (!me) redirect('/sign-in?from=/portfolio');

  const db = getDb();

  const [userRow] = await db
    .select({ disclaimerAcceptedAt: schema.users.disclaimerAcceptedAt })
    .from(schema.users)
    .where(eq(schema.users.id, me.id))
    .limit(1);

  const disclaimerAccepted = !!userRow?.disclaimerAcceptedAt;

  const portfolios = await db
    .select()
    .from(schema.portfolios)
    .where(eq(schema.portfolios.userId, me.id))
    .orderBy(schema.portfolios.createdAt);

  if (portfolios.length === 1 && disclaimerAccepted) {
    redirect(`/portfolio/${portfolios[0]!.id}`);
  }

  return (
    <PortfolioShell disclaimerAccepted={disclaimerAccepted}>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Portfolios</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Track your mutual fund investments across multiple portfolios
            </p>
          </div>
          <CreatePortfolioDialog />
        </div>

        {portfolios.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-20 text-center">
            <div className="text-4xl">📊</div>
            <h2 className="text-lg font-semibold">No portfolios yet</h2>
            <p className="text-muted-foreground max-w-xs text-sm">
              Create your first portfolio to start tracking your mutual fund investments.
            </p>
            <CreatePortfolioDialog label="Create your first portfolio" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {portfolios.map((p) => (
              <Link key={p.id} href={`/portfolio/${p.id}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    {p.isDefault && (
                      <span className="bg-primary/10 text-primary w-fit rounded-full px-2 py-0.5 text-xs font-medium">
                        Default
                      </span>
                    )}
                  </CardHeader>
                  <CardContent>
                    {p.description && (
                      <p className="text-muted-foreground text-sm">{p.description}</p>
                    )}
                    <p className="text-muted-foreground mt-2 text-xs">
                      Created {new Date(p.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </PortfolioShell>
  );
}

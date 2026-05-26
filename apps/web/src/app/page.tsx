import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function HomePage() {
  return (
    <main className="container mx-auto max-w-5xl px-4 py-12 sm:py-20">
      <section className="space-y-5">
        <Badge variant="outline" className="rounded-full">
          <Sparkles className="mr-1 h-3 w-3" aria-hidden /> Live intraday NAV
        </Badge>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Indian mutual funds, with the NAV the market is already pricing.
        </h1>
        <p className="text-muted-foreground max-w-2xl text-balance text-lg">
          Most platforms wait until 9 PM to show you yesterday&apos;s NAV. ISP estimates
          today&apos;s every 30 seconds — combining each fund&apos;s last-disclosed equity holdings
          with live stock prices.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild>
            <Link href="/funds">
              Browse funds <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/portfolio">Track a portfolio</Link>
          </Button>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="space-y-2 p-6">
            <p className="text-sm font-medium">Live NAV</p>
            <p className="text-muted-foreground text-sm">
              Recalculates intraday from each fund&apos;s holdings, weighted by live equity prices.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-6">
            <p className="text-sm font-medium">Real portfolios</p>
            <p className="text-muted-foreground text-sm">
              Enter transactions or import your CAMS / KFinTech statement. Get P&amp;L, XIRR, and
              day-change without waiting for the close.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-6">
            <p className="text-sm font-medium">Transparent sources</p>
            <p className="text-muted-foreground text-sm">
              Backed by AMFI, MFAPI, and Yahoo Finance — every confidence badge tells you exactly
              what we know.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

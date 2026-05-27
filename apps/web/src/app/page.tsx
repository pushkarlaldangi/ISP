import Link from 'next/link';
import { ArrowRight, BarChart2, Shield, Sparkles, TrendingUp, Zap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const FEATURES = [
  {
    icon: Zap,
    title: 'Live estimated NAV',
    description:
      "Recalculated every 30 seconds from each fund's disclosed equity holdings weighted by live NSE prices. See where your NAV is heading before 9 PM.",
  },
  {
    icon: BarChart2,
    title: 'Real portfolio tracking',
    description:
      'Enter transactions manually or import your CAMS / KFinTech CAS PDF. Get total P&L, XIRR, day-change, and fund-level breakdown — all with live NAV.',
  },
  {
    icon: TrendingUp,
    title: 'Holdings deep-dive',
    description:
      'Browse sector allocation, top positions by weight, and historical NAV charts for all ~14,000 Indian mutual funds synced daily from AMFI.',
  },
  {
    icon: Shield,
    title: 'Private & encrypted',
    description:
      'Your email and portfolio data are encrypted at the application layer. Audit-logged access, DPDP-compliant data export and deletion, no ads.',
  },
];

const STATS = [
  { label: 'Funds tracked', value: '14,000+' },
  { label: 'NAV update interval', value: '30s' },
  { label: 'Data sources', value: 'AMFI · NSE · Yahoo' },
  { label: 'Cost to you', value: 'Free' },
];

export default function HomePage() {
  return (
    <main className="container mx-auto max-w-5xl px-4 py-12 sm:py-20">
      {/* Hero */}
      <section className="space-y-5 text-center sm:text-left">
        <Badge variant="outline" className="rounded-full">
          <Sparkles className="mr-1 h-3 w-3" aria-hidden /> Live intraday NAV
        </Badge>

        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Indian mutual funds, <span className="text-primary">priced by the market right now.</span>
        </h1>

        <p className="text-muted-foreground mx-auto max-w-2xl text-balance text-lg sm:mx-0">
          Most platforms show yesterday&apos;s NAV at 9 PM. ISP estimates today&apos;s every 30
          seconds — combining each fund&apos;s last-disclosed equity holdings with live stock
          prices.
        </p>

        <div className="flex flex-wrap justify-center gap-2 pt-2 sm:justify-start">
          <Button asChild size="lg">
            <Link href="/funds">
              Browse funds <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/portfolio">Track my portfolio</Link>
          </Button>
        </div>
      </section>

      {/* Stats strip */}
      <section
        className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4"
        aria-label="Platform statistics"
      >
        {STATS.map(({ label, value }) => (
          <div key={label} className="bg-muted/30 rounded-xl border px-4 py-3 text-center">
            <p className="text-xl font-bold tabular-nums">{value}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">{label}</p>
          </div>
        ))}
      </section>

      {/* Features */}
      <section className="mt-16" aria-labelledby="features-heading">
        <h2 id="features-heading" className="sr-only">
          Features
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="transition-shadow hover:shadow-md">
              <CardContent className="space-y-2 p-6">
                <div className="bg-primary/10 mb-3 inline-flex rounded-lg p-2.5">
                  <Icon className="text-primary h-5 w-5" aria-hidden />
                </div>
                <p className="font-semibold">{title}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary/5 mt-16 rounded-2xl border px-6 py-10 text-center">
        <h2 className="text-2xl font-bold">Start tracking in 30 seconds</h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
          Sign in with your email — no password needed. Then search for any fund or import your CAS
          statement.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild size="lg">
            <Link href="/sign-in">Get started free</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/funds">Browse without signing in</Link>
          </Button>
        </div>
        <p className="text-muted-foreground mt-4 text-xs">
          ISP is a tracking tool only. Not SEBI-registered investment advice.
        </p>
      </section>
    </main>
  );
}

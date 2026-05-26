import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-muted-foreground text-sm uppercase tracking-wider">ISP</p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Indian mutual funds, with live intraday NAV.
        </h1>
        <p className="text-muted-foreground max-w-2xl text-balance text-lg">
          Most platforms show you the previous day&apos;s NAV. This one estimates today&apos;s,
          every 30 seconds, by combining each fund&apos;s last-disclosed equity holdings with live
          stock prices.
        </p>
      </header>

      <section className="bg-card rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">Phase 0 — foundation in place</h2>
        <ul className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2">
          <li>• Turborepo monorepo, pnpm workspaces</li>
          <li>• TypeScript strict across all packages</li>
          <li>• Drizzle schema for funds, NAV, holdings, portfolios</li>
          <li>• Pure financial-logic core (NAV, P&amp;L, XIRR) with tests</li>
          <li>• AMFI + MFAPI + Yahoo provider adapters</li>
          <li>• Tailwind design tokens with semantic gain/loss colors</li>
        </ul>
      </section>

      <section className="bg-card rounded-lg border p-6">
        <h2 className="mb-3 text-lg font-semibold">Next up</h2>
        <p className="text-muted-foreground text-sm">
          Phase 1 wires daily NAV sync from AMFI into the database, then Phase 2 ships the fund
          browse + detail pages. See{' '}
          <Link className="underline underline-offset-2" href="/funds">
            /funds
          </Link>{' '}
          (currently empty) and the project PLAN.md for the full roadmap.
        </p>
      </section>

      <footer className="text-muted-foreground mt-auto text-xs">
        Portfolio tracking only. Not investment advice. Not a SEBI-Registered Investment Advisor.
      </footer>
    </main>
  );
}

import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="bg-background/40 border-t">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        <p className="text-muted-foreground text-xs">
          Portfolio tracking only &mdash; not investment advice. ISP is not a SEBI-Registered
          Investment Advisor. Live NAV is a directional estimate based on last-disclosed holdings
          and delayed market prices; verify with your AMC before transacting.
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          <em>
            Mutual fund investments are subject to market risks. Please read all scheme-related
            documents carefully before investing.
          </em>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="text-muted-foreground">
            &copy; {new Date().getFullYear()} ISP &middot; Data from AMFI, MFAPI &amp; Yahoo Finance
          </span>
          <Link
            href="/help"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Help &amp; FAQ
          </Link>
          <Link
            href="/terms"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/disclaimer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            SEBI Disclaimer
          </Link>
        </div>
      </div>
    </footer>
  );
}

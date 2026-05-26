export function SiteFooter() {
  return (
    <footer className="bg-background/40 border-t">
      <div className="text-muted-foreground container mx-auto max-w-6xl px-4 py-6 text-xs">
        <p>
          Portfolio tracking only. Not investment advice. Not a SEBI-Registered Investment Advisor.
          Live NAV is an estimate based on last-disclosed holdings + delayed market data; verify
          with your AMC before transacting.
        </p>
        <p className="mt-2">
          © {new Date().getFullYear()} ISP. Data from AMFI, MFAPI, and Yahoo Finance.
        </p>
      </div>
    </footer>
  );
}
